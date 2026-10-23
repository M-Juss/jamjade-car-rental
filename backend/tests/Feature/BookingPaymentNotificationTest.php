<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\PayPalCheckout;
use App\Services\BookingEmailService;
use App\Services\BookingService;
use App\Services\NotificationService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    Mail::fake();
    config([
        'services.paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        'services.paypal.client_id' => 'sandbox-client-id',
        'services.paypal.client_secret' => 'sandbox-client-secret',
    ]);
});

function notificationCheckout(float $amount = 3500, BookingStatus $status = BookingStatus::Pending): PayPalCheckout
{
    $user = customerUser();
    $booking = Booking::create([
        'booking_code' => 'BK-NOTICE-001',
        'user_id' => $user->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(4), 'rental_end_at' => now()->addDays(5),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Rental office', 'return_location' => 'Rental office',
        'status' => $status, 'payment_status' => PaymentStatus::Unpaid,
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500,
        'remaining_balance' => 3500, 'terms_accepted_at' => now(),
    ]);

    return PayPalCheckout::create([
        'booking_id' => $booking->id, 'user_id' => $user->id,
        'purpose' => $amount < 3500 ? 'down_payment' : 'full_payment',
        'status' => 'created', 'amount' => $amount, 'currency' => 'PHP',
        'provider_order_id' => 'SUMMARY-ORDER-1',
    ]);
}

function fakeNotificationCapture(float $amount): void
{
    Http::fake([
        'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response(['access_token' => 'example-token']),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/SUMMARY-ORDER-1/capture' => Http::response([
            'status' => 'COMPLETED', 'purchase_units' => [['payments' => ['captures' => [[
                'id' => 'SUMMARY-CAPTURE-1', 'status' => 'COMPLETED',
                'amount' => ['currency_code' => 'PHP', 'value' => number_format($amount, 2, '.', '')],
            ]]]]],
        ]),
    ]);
}

it('combines checkout confirmation payment and balance information into one notification', function (float $amount) {
    $checkout = notificationCheckout($amount);
    fakeNotificationCapture($amount);
    Sanctum::actingAs($checkout->booking->user);

    $this->postJson('/api/mobile/paypal/orders/SUMMARY-ORDER-1/capture')->assertOk();
    $notification = Notification::sole();
    expect($notification->title)->toBe('Booking confirmed')
        ->and($notification->data['payment_id'])->toBe($checkout->id)
        ->and($notification->data['amount'])->toEqual($amount)
        ->and($notification->message)->toContain('PHP '.number_format($amount, 2))
        ->and($notification->full_message)->toContain('is confirmed.');

    if ($amount < 3500) {
        expect($notification->action_label)->toBe('Pay Remaining Balance')
            ->and($notification->data['action'])->toBe('pay_balance')
            ->and($notification->data['remaining_balance'])->toEqual(3500 - $amount)
            ->and($notification->data['due_at'])->toBe($checkout->booking->fresh()->balance_due_at->toISOString())
            ->and($notification->full_message)->toContain('due by', 'cancelled', 'non-refundable');
    } else {
        expect($notification->action_label)->toBe('View Booking')
            ->and($notification->data['action'])->toBe('view_booking')
            ->and($notification->full_message)->toContain('fully paid');
    }

    $this->getJson('/api/mobile/notifications')->assertOk()->assertJsonCount(1, 'data');
    $this->postJson('/api/mobile/paypal/orders/SUMMARY-ORDER-1/capture')->assertOk();
    $this->assertDatabaseCount('notifications', 1);
})->with([3500.0, 1750.0]);

it('updates the same read notification after document delivery and resends without changing its payment action', function () {
    $checkout = notificationCheckout(1750);
    fakeNotificationCapture(1750);
    Sanctum::actingAs($checkout->booking->user);
    $this->postJson('/api/mobile/paypal/orders/SUMMARY-ORDER-1/capture')->assertOk();
    $notification = Notification::sole();
    app(NotificationService::class)->markAsRead($notification, $checkout->booking->user);
    $readAt = $notification->fresh()->read_at;
    $document = BookingPaymentDocument::sole();
    $service = app(BookingEmailService::class);

    $service->markSent($document, $document->delivery_token);
    expect($notification->fresh()->full_message)->toContain('sent to your email', 'due by')
        ->and($notification->fresh()->data['documents_sent'])->toBeTrue()
        ->and($notification->fresh()->data['action'])->toBe('pay_balance')
        ->and($notification->fresh()->read_at->equalTo($readAt))->toBeTrue();

    $service->markSent($document, $document->delivery_token);
    expect($service->sendDocument($document, true))->toBeTrue();
    $service->markSent($document->fresh(), $document->fresh()->delivery_token);
    $this->assertDatabaseCount('notifications', 1);
    expect(substr_count($notification->fresh()->full_message, 'sent to your email'))->toBe(1);
});

it('keeps the payment success notification when email delivery fails and adds delivery details only after retry succeeds', function () {
    $checkout = notificationCheckout();
    fakeNotificationCapture(3500);
    Sanctum::actingAs($checkout->booking->user);
    $this->postJson('/api/mobile/paypal/orders/SUMMARY-ORDER-1/capture')->assertOk();
    $document = BookingPaymentDocument::sole();
    $service = app(BookingEmailService::class);
    $service->markFailed($document, 'Example transport failure', $document->delivery_token);

    expect(Notification::sole()->full_message)->not->toContain('sent to your email')
        ->and($document->fresh()->delivery_status)->toBe('failed');
    expect($service->sendDocument($document))->toBeTrue();
    $service->markSent($document->fresh(), $document->fresh()->delivery_token);
    expect(Notification::sole()->full_message)->toContain('sent to your email');
});

it('uses a payment notification for an existing booking without claiming it was just confirmed', function () {
    $checkout = notificationCheckout(status: BookingStatus::Confirmed);
    fakeNotificationCapture(3500);
    Sanctum::actingAs($checkout->booking->user);

    $this->postJson('/api/mobile/paypal/orders/SUMMARY-ORDER-1/capture')->assertOk();
    expect(Notification::sole()->title)->toBe('Payment completed');
});

it('keeps later payment summaries separate and attaches delayed emails to the matching payment', function () {
    $checkout = notificationCheckout(1750);
    fakeNotificationCapture(1750);
    Sanctum::actingAs($checkout->booking->user);
    $this->postJson('/api/mobile/paypal/orders/SUMMARY-ORDER-1/capture')->assertOk();
    $firstNotice = Notification::sole();
    $firstDocument = BookingPaymentDocument::sole();
    $booking = $checkout->booking->fresh();
    $payment = Payment::create([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id,
        'provider' => 'paypal', 'purpose' => 'remaining_balance', 'status' => 'completed',
        'amount' => 1750, 'currency' => 'PHP', 'completed_at' => now(),
    ]);
    $booking->update(['payment_status' => PaymentStatus::Paid, 'remaining_balance' => 0, 'balance_due_at' => null]);
    $secondNotice = app(NotificationService::class)->createForCustomerPayment($booking, $payment);
    $email = app(BookingEmailService::class);
    $email->queueForPayment($payment);
    $secondDocument = BookingPaymentDocument::where('payment_id', $payment->id)->sole();

    $email->markSent($secondDocument, $secondDocument->delivery_token);
    expect($secondNotice->fresh()->full_message)->toContain('fully paid', 'sent to your email')
        ->and($firstNotice->fresh()->full_message)->not->toContain('sent to your email');
    $email->markSent($firstDocument, $firstDocument->delivery_token);

    $this->assertDatabaseCount('notifications', 2);
    expect($firstNotice->fresh()->full_message)->toContain('due by', 'sent to your email')
        ->and($secondNotice->fresh()->data['payment_id'])->toBe($payment->id);
});

it('combines confirmation and balance details for bookings created with a recorded payment', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = app(BookingService::class)->create($user, [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDays(4)->format('Y-m-d H:i'),
        'rental_end_at' => now()->addDays(5)->format('Y-m-d H:i'),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Rental office', 'return_location' => 'Rental office',
        'driver_option' => 'self_drive', 'payment_method' => 'GCash', 'down_payment_amount' => 1750,
        'customer_signature' => 'signed', 'terms_version' => '2026-10-15',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ]);

    $notification = Notification::sole();
    expect($notification->booking_id)->toBe($booking->id)
        ->and($notification->title)->toBe('Booking confirmed')
        ->and($notification->data['remaining_balance'])->toEqual(1750)
        ->and($notification->full_message)->toContain('due by');
});
