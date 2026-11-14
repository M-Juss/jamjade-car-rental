<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Payment;
use App\Models\User;
use App\Services\BookingCancellationService;
use App\Services\BookingPaymentDocumentService;
use App\Services\BookingService;
use App\Services\PaymentDeadlineService;
use App\Services\PaymentService;
use App\Services\ReportService;
use App\Services\TelematicsHandoverEligibilityService;
use App\Support\BookingAgreement;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    Mail::fake();
    config(['mail.booking_confirmations_queue' => false]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-16T10:00:00+08:00')->utc());
});

afterEach(fn () => CarbonImmutable::setTestNow());

function policyBooking(): Booking
{
    return Booking::create([
        'booking_code' => 'BK-POL-'.strtoupper(bin2hex(random_bytes(3))),
        'user_id' => customerUser()->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => CarbonImmutable::parse('2026-10-19T14:00:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-20T14:00:00+08:00')->utc(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage',
        'status' => BookingStatus::Confirmed, 'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500,
        'total_amount' => 3500, 'remaining_balance' => 0,
        'terms_version' => BookingAgreement::VERSION, 'terms_accepted_at' => now(), 'customer_signature' => 'Signed Renter',
    ]);
}

function policyPayment(Booking $booking, float $amount = 3500): Payment
{
    return Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id, 'provider' => 'manual',
        'purpose' => 'full_payment', 'status' => 'completed', 'amount' => $amount, 'currency' => 'PHP', 'completed_at' => now(),
    ]);
}

function policyAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

it('sets the balance cutoff at the beginning of the rental date in Manila', function () {
    $booking = policyBooking();
    expect(BookingAgreement::balanceDeadline($booking->rental_start_at)->toISOString())->toBe('2026-10-18T16:00:00.000000Z');
    $booking->update(['payment_status' => PaymentStatus::Partial, 'remaining_balance' => 1750, 'balance_due_at' => BookingAgreement::balanceDeadline($booking->rental_start_at)]);
    policyPayment($booking, 1750);
    app(PaymentDeadlineService::class)->process(CarbonImmutable::parse('2026-10-18T23:59:59+08:00'));
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
    app(PaymentDeadlineService::class)->process(CarbonImmutable::parse('2026-10-19T00:00:00+08:00'));
    expect($booking->fresh()->status)->toBe(BookingStatus::Cancelled)
        ->and($booking->fresh()->cancellation->kind)->toBe('payment_deadline')
        ->and($booking->successfulCustomerPayments()->sum('amount'))->toBe(1750);
});

it('accepts handover eligibility on a later booked day but never before the start or at the end', function () {
    $booking = policyBooking();
    $service = app(TelematicsHandoverEligibilityService::class);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-19T13:59:59+08:00')->utc());
    expect($service->evaluate($booking)['rentalPeriodEligible'])->toBeTrue();
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-19T14:00:00+08:00')->utc());
    expect($service->evaluate($booking)['rentalPeriodEligible'])->toBeTrue();
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-20T09:00:00+08:00')->utc());
    expect($service->evaluate($booking)['rentalPeriodEligible'])->toBeTrue();
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-20T14:00:00+08:00')->utc());
    expect($service->evaluate($booking)['rentalPeriodEligible'])->toBeFalse()
        ->and($booking->fresh()->rental_end_at->toISOString())->toBe('2026-10-20T06:00:00.000000Z');
});

it('rejects early no-show classification and retains all payments for a reviewed no-show after the interval', function () {
    $booking = policyBooking();
    policyPayment($booking);
    $admin = policyAdmin();
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-19T18:00:00+08:00')->utc());
    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/no-show", ['reason' => 'No collection recorded'])->assertUnprocessable();
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-20T14:00:00+08:00')->utc());
    $this->postJson("/admin/bookings/{$booking->id}/no-show", ['reason' => 'Reserved period ended, no collection or cancellation recorded'])->assertOk()
        ->assertJsonPath('data.cancellation.kind', 'no_show')->assertJsonPath('data.cancellation.refundStatus', 'not_eligible');
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/refund-review", ['amount' => 1000, 'reason' => 'Override'])->assertUnprocessable();
    expect($booking->successfulCustomerPayments()->sum('amount'))->toBe(3500)
        ->and($booking->fresh()->payment_status)->toBe(PaymentStatus::Paid);
});

it('does not expose mobile cancellation for pending or confirmed bookings', function (BookingStatus $status) {
    $booking = policyBooking();
    $booking->update(['status' => $status]);
    policyPayment($booking);
    Sanctum::actingAs($booking->user);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/cancel", ['reason' => 'Change of plans'])->assertNotFound();
    $this->postJson("/api/mobile/bookings/{$booking->id}/cancel", ['reason' => 'Change of plans'])->assertNotFound();
    $this->postJson("/admin/bookings/{$booking->id}/cancel", ['reason' => 'Change of plans'])->assertForbidden();
    expect($booking->fresh()->status)->toBe($status)
        ->and($booking->fresh()->cancellation)->toBeNull()
        ->and($booking->successfulCustomerPayments()->sum('amount'))->toBe(3500);
})->with([BookingStatus::Pending, BookingStatus::Confirmed]);

it('rejects cancellation by customers and Drivers at the service boundary', function (string $role) {
    $booking = policyBooking();
    $actor = $role === 'customer' ? $booking->user : createDriverUser();
    $actor->givePermissionTo('manage bookings');
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Cancelled, $actor, 'Change of plans'))
        ->toThrow(HttpException::class);
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($booking->fresh()->cancellation)->toBeNull();
})->with(['customer', 'driver']);

it('requires a management cancellation reason and never promises a refund automatically', function (string $role) {
    $booking = policyBooking();
    policyPayment($booking);
    $actor = User::factory()->create();
    $actor->assignRole($role);
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/cancel", [])->assertUnprocessable()->assertJsonValidationErrors('reason');
    $this->postJson("/admin/bookings/{$booking->id}/cancel", ['reason' => 'Documented emergency'])->assertOk()
        ->assertJsonPath('data.cancellation.kind', 'management')
        ->assertJsonPath('data.cancellation.refundStatus', 'pending_review')->assertJsonPath('data.cancellation.refundAmount', null);
})->with(['admin', 'staff']);

it('keeps historical customer cancellation records eligible for Admin refund review', function () {
    $booking = policyBooking();
    policyPayment($booking);
    $booking->update(['status' => BookingStatus::Cancelled]);
    $booking->cancellation()->create([
        'kind' => 'customer', 'reason' => 'Historical cancellation', 'recorded_by' => $booking->user_id,
    ]);

    $this->actingAs(policyAdmin());
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/refund-review", [
        'amount' => 1000, 'reason' => 'Historical refund approved',
    ])->assertOk()
        ->assertJsonPath('data.cancellation.kind', 'customer')
        ->assertJsonPath('data.cancellation.refundStatus', 'approved');
});

it('permits only Admin to decide a refund and requires actual-return confirmation without a reference', function () {
    $booking = policyBooking();
    policyPayment($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Cancelled, policyAdmin(), 'Emergency');
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)->postJson("/admin/bookings/{$booking->id}/refund-review", ['amount' => 2000, 'reason' => 'Emergency accepted'])->assertForbidden();
    $this->actingAs(policyAdmin());
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/refund-review", ['amount' => 3500.01, 'reason' => 'Too much'])->assertUnprocessable()->assertJsonValidationErrors('amount');
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/refund-review", ['amount' => 2000.50, 'reason' => 'Partial refund approved'])->assertOk()->assertJsonPath('data.cancellation.refundStatus', 'approved');
    $this->postJson("/admin/bookings/{$booking->id}/record-refund", [])->assertUnprocessable();
    expect($booking->fresh()->cancellation->refunded_at)->toBeNull();
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/record-refund", ['confirmed' => true])->assertOk()->assertJsonPath('data.cancellation.refundStatus', 'refunded')->assertJsonPath('data.cancellation.refundAmount', 2000.5);
    verifiedOwnerWrite($this, 'POST', "/admin/bookings/{$booking->id}/record-refund", ['confirmed' => true])->assertOk();
    expect($booking->events()->where('event_type', 'refund_recorded')->count())->toBe(1)
        ->and($booking->successfulCustomerPayments()->sum('amount'))->toBe(3500);
    $report = app(ReportService::class)->analytics('all_time');
    expect($report['refundSummary']['amountReturned'])->toBe(2000.5)->and($report['refundSummary']['netReceipts'])->toBe(1499.5);
});

it('allows zero or full refund decisions and prevents changing a completed decision', function (float $amount) {
    $booking = policyBooking();
    policyPayment($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Cancelled, policyAdmin(), 'Emergency');
    $admin = policyAdmin();
    $reviewed = app(BookingCancellationService::class)->review($booking, $admin, ['amount' => $amount, 'reason' => 'Owner decision']);
    expect((float) $reviewed->cancellation->refund_amount)->toBe($amount);
    expect(fn () => app(BookingCancellationService::class)->review($booking, $admin, ['amount' => 100, 'reason' => 'Second decision']))->toThrow(ValidationException::class);
})->with([0.0, 3500.0]);

it('excludes driver and incomplete payments from the refundable amount', function () {
    $booking = policyBooking();
    policyPayment($booking, 1000);
    $driver = createDriverUser();
    Payment::create(['booking_id' => $booking->id, 'user_id' => $driver->id, 'provider' => 'manual', 'purpose' => 'driver_outstanding', 'status' => 'completed', 'amount' => 9000, 'currency' => 'PHP']);
    $pending = policyPayment($booking, 9000);
    $pending->update(['status' => 'pending']);
    app(BookingService::class)->transition($booking, BookingStatus::Cancelled, policyAdmin(), 'Emergency');
    expect(fn () => app(BookingCancellationService::class)->review($booking, policyAdmin(), ['amount' => 1001, 'reason' => 'Owner decision']))->toThrow(ValidationException::class);
});

it('issues a matching receipt pair for each payment while preserving the accepted agreement', function () {
    $booking = policyBooking();
    $payment = policyPayment($booking, 1750);
    $documents = app(BookingPaymentDocumentService::class);
    $first = $documents->issue($payment);
    $documents->render($first);
    $bytes = Storage::disk('local')->get($first->rental_information_path);
    $confirmation = $first->context;
    $html = view('pdf.bookings.rental-information', compact('confirmation'))->render();
    expect($html)->not->toContain('Invoice', 'INV-', '10,000.00', 'five (5) days')
        ->toContain('Total Paid as of Issue', 'Remaining Balance as of Issue', 'PHP 1,750.00')
        ->toContain('before the rental start date begins', 'no-show', 'Signed Renter');
    $booking->update(['payment_status' => PaymentStatus::Partial, 'remaining_balance' => 1750]);
    app(PaymentService::class)->record($booking, $booking->user, ['amount' => 1750, 'payment_method' => 'GCash']);
    $last = BookingPaymentDocument::latest('id')->first();
    expect($last->rental_information_path)->not->toBe($first->rental_information_path)
        ->and($last->context['rentalSnapshot'])->toBe($first->context['rentalSnapshot'])
        ->and($last->context['receipt']['reference'])->not->toBe($first->context['receipt']['reference'])
        ->and(Storage::disk('local')->get($first->rental_information_path))->toBe($bytes);
    $confirmation = $last->context;
    $receipt = view('pdf.bookings.payment-receipt', compact('confirmation'))->render();
    expect($receipt)->toContain('Rental Purchased', 'Fully Paid', 'Settlement Status as of Payment', 'PHP 1,750.00', 'PHP 0.00');
});

it('saves agreed details before checkout without issuing documents and rejects a changed reviewed price', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $data = [
        'vehicle_id' => $vehicle->id, 'rental_start_at' => '2026-10-19T14:00:00+08:00', 'rental_end_at' => '2026-10-20T14:00:00+08:00',
        'driver_option' => 'self_drive', 'pickup_location_type' => 'shop', 'customer_signature' => 'Signed Renter', 'terms_version' => BookingAgreement::VERSION,
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
        'reviewed_pricing' => ['price_per_day' => 1, 'subtotal' => 1, 'delivery_fee' => 0, 'delivery_toll_fee' => 0, 'owner_driver_fee' => 0, 'total_amount' => 1],
    ];
    expect(fn () => app(BookingService::class)->createAwaitingPayPalPayment($user, $data))->toThrow(ValidationException::class);
    $data['reviewed_pricing']['price_per_day'] = (float) $vehicle->price_per_day;
    $data['reviewed_pricing']['subtotal'] = (float) $vehicle->price_per_day;
    $data['reviewed_pricing']['total_amount'] = (float) $vehicle->price_per_day;
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($user, $data);
    $original = $booking->terms->rental_context;
    expect(BookingPaymentDocument::count())->toBe(0)->and(Storage::disk('local')->allFiles())->toBe([]);
    $vehicle->update(['name' => 'Later changed name']);
    $payment = policyPayment($booking, (float) $booking->total_amount);
    $document = app(BookingPaymentDocumentService::class)->issue($payment);
    expect($document->context['rentalSnapshot']['vehicle'])->toBe($original['vehicle']);
});

it('cancels a confirmed booking and approves its full paid amount atomically', function () {
    $owner = policyAdmin();
    $owner->assignRole('owner');
    $booking = policyBooking();
    policyPayment($booking, 1750);
    $this->actingAs($owner)->getJson('/admin/bookings?search='.$booking->booking_code)
        ->assertOk()->assertJsonPath('data.0.customerPaidAmount', 1750);
    $this->actingAs($owner)->postJson("/admin/bookings/{$booking->id}/cancel", [
        'reason' => 'Customer requested cancellation.', 'refund_mode' => 'full',
    ])->assertOk()->assertJsonPath('data.cancellation.refundStatus', 'approved');
    expect($booking->fresh()->status)->toBe(BookingStatus::Cancelled);
    expect((float) $booking->fresh()->cancellation->refund_amount)->toBe(1750.0);
    expect($booking->fresh()->cancellation->refunded_at)->toBeNull();
    expect($booking->payments()->where('status', 'completed')->count())->toBe(1);
});

it('accepts positive custom refunds and rolls back cancellation when the paid ceiling is exceeded', function () {
    $owner = policyAdmin();
    $owner->assignRole('owner');
    $booking = policyBooking();
    policyPayment($booking, 1750);
    $this->actingAs($owner)->postJson("/admin/bookings/{$booking->id}/cancel", [
        'reason' => 'Customer requested cancellation.', 'refund_mode' => 'custom', 'refund_amount' => '1750.01',
    ])->assertUnprocessable()->assertJsonValidationErrors('refund_amount');
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
    expect($booking->fresh()->cancellation)->toBeNull();
    $this->postJson("/admin/bookings/{$booking->id}/cancel", [
        'reason' => 'Customer requested cancellation.', 'refund_mode' => 'custom', 'refund_amount' => '500.25',
    ])->assertOk();
    expect((float) $booking->fresh()->cancellation->refund_amount)->toBe(500.25);
});

it('rejects zero negative missing or overly precise custom refunds', function ($amount) {
    $owner = policyAdmin();
    $owner->assignRole('owner');
    $booking = policyBooking();
    policyPayment($booking);
    $this->actingAs($owner)->postJson("/admin/bookings/{$booking->id}/cancel", [
        'reason' => 'Customer cancellation.', 'refund_mode' => 'custom', 'refund_amount' => $amount,
    ])->assertUnprocessable()->assertJsonValidationErrors('refund_amount');
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
})->with(['zero' => '0', 'negative' => '-1', 'empty' => '', 'too precise' => '10.001']);

it('prevents staff from approving a cancellation refund and protects admin approval with owner verification', function () {
    $booking = policyBooking();
    policyPayment($booking);
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $payload = ['reason' => 'Customer cancellation.', 'refund_mode' => 'full'];
    $this->actingAs($staff)->postJson("/admin/bookings/{$booking->id}/cancel", $payload)->assertForbidden();
    $owner = policyAdmin();
    $owner->assignRole('owner');
    $this->actingAs(policyAdmin())->postJson("/admin/bookings/{$booking->id}/cancel", $payload)->assertStatus(428);
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
});

it('does not approve a refund from driver payments or cancel a pending booking through the combined action', function () {
    $owner = policyAdmin();
    $owner->assignRole('owner');
    $booking = policyBooking();
    $payment = policyPayment($booking);
    $payment->update(['purpose' => 'driver_outstanding']);
    $this->actingAs($owner)->postJson("/admin/bookings/{$booking->id}/cancel", [
        'reason' => 'Cancellation.', 'refund_mode' => 'full',
    ])->assertUnprocessable();
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed);
    $booking->update(['status' => BookingStatus::Pending]);
    $payment->update(['purpose' => 'full_payment']);
    $this->postJson("/admin/bookings/{$booking->id}/cancel", [
        'reason' => 'Cancellation.', 'refund_mode' => 'full',
    ])->assertUnprocessable();
    expect($booking->fresh()->status)->toBe(BookingStatus::Pending);
});
