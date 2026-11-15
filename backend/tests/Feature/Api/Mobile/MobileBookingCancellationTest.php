<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\PayPalCheckout;
use App\Models\User;
use App\Services\BookingCancellationService;
use App\Services\BookingService;
use App\Services\PayPalClient;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
});

function mobileUnpaidBooking(array $overrides = []): Booking
{
    return Booking::create(array_replace([
        'booking_code' => 'BK-CANCEL-'.strtoupper(bin2hex(random_bytes(3))),
        'user_id' => customerUser()->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => 'self_drive', 'rental_start_at' => now()->addDays(3), 'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage',
        'status' => BookingStatus::Pending, 'payment_status' => PaymentStatus::Unpaid,
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500,
        'down_payment_amount' => 0, 'remaining_balance' => 3500,
    ], $overrides));
}

function mobileCancellationCheckout(Booking $booking, array $overrides = []): PayPalCheckout
{
    return PayPalCheckout::create(array_replace([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id,
        'payment_option' => 'full_payment', 'status' => 'created', 'amount' => 3500, 'currency' => 'PHP',
        'provider_order_id' => 'CANCEL-ORDER-'.bin2hex(random_bytes(3)),
        'approval_url' => 'https://www.sandbox.paypal.com/checkoutnow',
    ], $overrides));
}

it('lets the owner cancel an unpaid pending booking and retires uncaptured orders', function (string $reference) {
    $booking = mobileUnpaidBooking();
    $checkout = mobileCancellationCheckout($booking);
    Sanctum::actingAs($booking->user);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonPath('data.canCancelUnpaid', true);
    $this->getJson('/api/mobile/bookings')->assertOk()->assertJsonPath('data.0.canCancelUnpaid', true);
    $id = $reference === 'code' ? $booking->booking_code : $booking->id;
    $this->postJson("/api/mobile/bookings/{$id}/cancel", ['reason' => '  Change of plans  ', 'refund_mode' => 'full', 'refund_amount' => 3500])
        ->assertOk()->assertJsonPath('data.status', 'Cancelled')->assertJsonPath('data.canCancelUnpaid', false)
        ->assertJsonPath('data.canReviseUnpaid', false)
        ->assertJsonPath('data.cancellation.kind', 'customer_unpaid')->assertJsonPath('data.cancellation.reason', 'Change of plans')
        ->assertJsonPath('data.cancellation.refundStatus', 'not_eligible')->assertJsonPath('data.cancellation.refundAmount', 0);
    expect($checkout->fresh()->status)->toBe('abandoned')
        ->and($booking->fresh()->status)->toBe(BookingStatus::Cancelled)
        ->and($booking->cancellation->recorded_by)->toBe($booking->user_id)
        ->and($booking->cancellation->reviewed_at)->toBeNull()
        ->and($booking->events()->where('event_type', 'status_changed')->count())->toBe(1);
    $this->assertDatabaseCount('booking_payment_documents', 0);
    $this->assertDatabaseHas('notifications', ['booking_id' => $booking->id, 'title' => 'Booking cancelled']);

    $this->mock(PayPalClient::class, fn ($mock) => $mock->shouldNotReceive('captureOrder'));
    $this->postJson('/api/mobile/paypal/orders/'.$checkout->provider_order_id.'/capture')->assertUnprocessable();
    $this->postJson("/api/mobile/bookings/{$id}/cancel", ['reason' => 'Again'])->assertForbidden();
    expect($booking->events()->where('event_type', 'status_changed')->count())->toBe(1);
})->with(['code', 'id']);

it('allows a pending booking with no payment attempts to be cancelled', function () {
    $booking = mobileUnpaidBooking();
    Sanctum::actingAs($booking->user);
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => 'No longer needed'])->assertOk();
});

it('blocks paid or non-pending bookings despite a direct mobile request', function (BookingStatus $status, PaymentStatus $payment) {
    $booking = mobileUnpaidBooking(['status' => $status, 'payment_status' => $payment]);
    Sanctum::actingAs($booking->user);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonPath('data.canCancelUnpaid', false);
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => 'Change of plans'])->assertForbidden();
    expect($booking->fresh()->status)->toBe($status)->and($booking->cancellation)->toBeNull();
})->with([
    [BookingStatus::Pending, PaymentStatus::Paid], [BookingStatus::Pending, PaymentStatus::Partial],
    [BookingStatus::Confirmed, PaymentStatus::Unpaid], [BookingStatus::Confirmed, PaymentStatus::Paid],
    [BookingStatus::Ongoing, PaymentStatus::Unpaid], [BookingStatus::Returned, PaymentStatus::Unpaid],
    [BookingStatus::Completed, PaymentStatus::Unpaid], [BookingStatus::Rejected, PaymentStatus::Unpaid],
]);

it('blocks every unresolved or completed payment attempt and preserves its evidence', function (array $payment) {
    $booking = mobileUnpaidBooking();
    $checkout = mobileCancellationCheckout($booking, $payment);
    Sanctum::actingAs($booking->user);
    $this->getJson('/api/mobile/bookings/'.$booking->booking_code)->assertOk()->assertJsonPath('data.canCancelUnpaid', false);
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => 'Change of plans'])
        ->assertUnprocessable()->assertJsonValidationErrors('booking');
    expect($booking->fresh()->status)->toBe(BookingStatus::Pending)->and($booking->cancellation)->toBeNull()
        ->and($checkout->fresh()->status)->toBe($payment['status']);
})->with([
    [['status' => 'creating']], [['status' => 'approved']], [['status' => 'capturing']], [['status' => 'completed']],
    [['status' => 'failed', 'provider_response' => ['details' => [['issue' => 'UNKNOWN_FAILURE']]]]],
    [['status' => 'created', 'capture_first_started_at' => now()]],
    [['status' => 'created', 'provider_transaction_id' => 'UNCERTAIN-CAPTURE']],
]);

it('allows cancellation after an explicitly unapproved first capture', function () {
    $booking = mobileUnpaidBooking();
    mobileCancellationCheckout($booking, ['status' => 'failed', 'capture_first_started_at' => now(),
        'provider_response' => ['details' => [['issue' => 'ORDER_NOT_APPROVED']]]]);
    Sanctum::actingAs($booking->user);
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => 'No longer needed'])->assertOk();
});

it('validates a trimmed required reason with the authoritative length limit', function (mixed $reason) {
    $booking = mobileUnpaidBooking();
    Sanctum::actingAs($booking->user);
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => $reason])
        ->assertUnprocessable()->assertJsonValidationErrors('reason');
    expect($booking->fresh()->status)->toBe(BookingStatus::Pending);
})->with([null, '', '   ', str_repeat('x', 1001), [['array']]]);

it('accepts the maximum reason length using Unicode characters', function (string $reason) {
    $booking = mobileUnpaidBooking();
    Sanctum::actingAs($booking->user);
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => $reason])
        ->assertOk()->assertJsonPath('data.cancellation.reason', $reason);
})->with(['ASCII boundary' => [str_repeat('x', 1000)], 'Unicode boundary' => [str_repeat('🚗', 1000)]]);

it('does not let customers cancel another customer booking', function () {
    $booking = mobileUnpaidBooking();
    Sanctum::actingAs(customerUser());
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => 'Change of plans'])->assertNotFound();
    expect($booking->fresh()->status)->toBe(BookingStatus::Pending);
});

it('also enforces ownership at the service boundary', function () {
    $booking = mobileUnpaidBooking();
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Cancelled, customerUser(),
        'Change of plans', ['cancellation_kind' => 'customer_unpaid']))->toThrow(AuthorizationException::class);
    expect($booking->fresh()->status)->toBe(BookingStatus::Pending);
});

it('blocks an inactive Customer account', function () {
    $booking = mobileUnpaidBooking();
    $booking->user->update(['is_active' => false]);
    Sanctum::actingAs($booking->user);
    $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => 'Change of plans'])->assertForbidden();
});

it('requires Customer authentication for mobile cancellation', function (string $role) {
    $booking = mobileUnpaidBooking();
    if ($role !== 'guest') {
        $user = User::factory()->create();
        $user->assignRole($role);
        Sanctum::actingAs($user);
    }
    $response = $this->postJson('/api/mobile/bookings/'.$booking->booking_code.'/cancel', ['reason' => 'Change of plans']);
    $role === 'guest' ? $response->assertUnauthorized() : $response->assertForbidden();
})->with(['guest', 'driver', 'staff', 'admin']);

it('rolls cancellation and order abandonment back together when recording fails', function () {
    $booking = mobileUnpaidBooking();
    $checkout = mobileCancellationCheckout($booking);
    $this->mock(BookingCancellationService::class, fn ($mock) => $mock->shouldReceive('record')->once()->andThrow(new RuntimeException('Recording unavailable')));
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Cancelled, $booking->user,
        'Change of plans', ['cancellation_kind' => 'customer_unpaid']))->toThrow(RuntimeException::class);
    expect($booking->fresh()->status)->toBe(BookingStatus::Pending)->and($checkout->fresh()->status)->toBe('created');
    expect($booking->events()->count())->toBe(0)->and($booking->cancellation)->toBeNull();
});
