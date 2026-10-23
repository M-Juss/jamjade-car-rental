<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingPaymentDocument;
use App\Models\Payment;
use App\Services\BookingPaymentDocumentService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function receiptBooking(): Booking
{
    return Booking::create([
        'booking_code' => 'BK-RECEIPT-'.bin2hex(random_bytes(3)),
        'user_id' => customerUser()->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive, 'rental_start_at' => now()->addDays(4), 'rental_end_at' => now()->addDays(5),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Rental office', 'return_location' => 'Rental office',
        'status' => BookingStatus::Confirmed, 'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500,
        'remaining_balance' => 2500, 'balance_due_at' => now()->addDays(3),
    ]);
}

function receiptPayment(Booking $booking, array $overrides = []): Payment
{
    return Payment::create(array_merge([
        'booking_id' => $booking->id, 'user_id' => $booking->user_id, 'provider' => 'paypal',
        'purpose' => 'down_payment', 'status' => 'completed', 'amount' => 1000, 'currency' => 'PHP',
        'provider_order_id' => 'ORDER-'.bin2hex(random_bytes(3)),
        'provider_transaction_id' => 'CAPTURE-'.bin2hex(random_bytes(3)), 'completed_at' => now(),
    ], $overrides));
}

it('returns the exact captured payment snapshot and keeps older receipts unchanged', function () {
    $booking = receiptBooking();
    $first = receiptPayment($booking);
    $documents = app(BookingPaymentDocumentService::class);
    $receipt = $documents->issue($first);
    Sanctum::actingAs($booking->user);
    $endpoint = "/api/mobile/paypal/orders/{$first->provider_order_id}/receipt";
    $before = $this->getJson($endpoint)->assertOk()
        ->assertJsonPath('data.id', $receipt->id)
        ->assertJsonPath('data.receiptReference', sprintf('RCP-%05d', $first->id))
        ->assertJsonMissingPath('data.invoiceReference')->assertJsonMissingPath('data.invoiceTotal')
        ->assertJsonPath('data.agreedRentalTotal', 3500)
        ->assertJsonPath('data.amount', 1000)
        ->assertJsonPath('data.remainingBalance', 2500)
        ->assertJsonPath('data.balanceDueAt', $booking->balance_due_at->toISOString())
        ->assertJsonPath('data.downloadReady', false)
        ->assertJsonMissingPath('data.context')->assertJsonMissingPath('data.receipt_path')
        ->assertJsonMissingPath('data.customer')->assertJsonMissingPath('data.signatureImage')->json('data');

    $second = receiptPayment($booking, ['amount' => 2500, 'purpose' => 'remaining_balance']);
    $booking->update(['payment_status' => PaymentStatus::Paid, 'remaining_balance' => 0, 'balance_due_at' => null]);
    $newReceipt = $documents->issue($second);
    $booking->vehicle->update(['name' => 'Changed after payment']);
    $this->getJson($endpoint)->assertOk()->assertJsonPath('data', $before);
    $this->getJson("/api/mobile/paypal/orders/{$second->provider_order_id}/receipt")->assertOk()
        ->assertJsonPath('data.id', $newReceipt->id)->assertJsonPath('data.amount', 2500)
        ->assertJsonPath('data.remainingBalance', 0)->assertJsonPath('data.totalPaid', 3500)
        ->assertJsonPath('data.agreedRentalTotal', $before['agreedRentalTotal']);
    expect(BookingPaymentDocument::count())->toBe(2);
});

it('serves only the retained PDF bytes and never regenerates missing issued files', function () {
    $booking = receiptBooking();
    $receipt = app(BookingPaymentDocumentService::class)->issue(receiptPayment($booking));
    $receipt->update(['delivery_token' => 'issued-token']);
    Sanctum::actingAs($booking->user);
    $endpoint = "/api/mobile/receipts/{$receipt->id}/download";
    $this->getJson($endpoint)->assertConflict();
    expect(Storage::disk('local')->exists($receipt->receipt_path))->toBeFalse();
    $bytes = '%PDF-1.4 synthetic retained receipt';
    Storage::disk('local')->put($receipt->receipt_path, $bytes);
    $response = $this->get($endpoint)->assertOk()->assertHeader('Content-Type', 'application/pdf')
        ->assertHeader('X-Content-Type-Options', 'nosniff')->assertDownload($receipt->receipt_filename);
    expect($response->streamedContent())->toBe($bytes);
    $this->getJson("/api/mobile/receipts/{$receipt->id}")->assertOk()->assertJsonPath('data.downloadReady', true);
});

it('does not expose another customer receipt, order, download, or booking list', function () {
    $booking = receiptBooking();
    $payment = receiptPayment($booking);
    $receipt = app(BookingPaymentDocumentService::class)->issue($payment);
    Sanctum::actingAs(customerUser());
    foreach (["receipts/{$receipt->id}", "receipts/{$receipt->id}/download", "paypal/orders/{$payment->provider_order_id}/receipt", "bookings/{$booking->booking_code}/receipts"] as $path) {
        $this->getJson('/api/mobile/'.$path)->assertNotFound();
    }
});

it('requires authentication and the Customer role for receipt reads', function () {
    foreach (['receipts/1', 'receipts/1/download', 'bookings/1/receipts', 'paypal/orders/ORDER/receipt'] as $path) {
        $this->getJson('/api/mobile/'.$path)->assertUnauthorized();
    }
    $driver = createDriverUser();
    Sanctum::actingAs($driver);
    foreach (['receipts/1', 'receipts/1/download', 'bookings/1/receipts', 'paypal/orders/ORDER/receipt'] as $path) {
        $this->getJson('/api/mobile/'.$path)->assertForbidden();
    }
});

it('does not present incomplete or Driver payments as customer receipts', function (array $overrides) {
    $booking = receiptBooking();
    $payment = receiptPayment($booking, $overrides);
    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/paypal/orders/{$payment->provider_order_id}/receipt")->assertNotFound();
    expect(BookingPaymentDocument::count())->toBe(0);
})->with([
    [['status' => 'pending']], [['status' => 'failed']], [['purpose' => 'driver_outstanding']],
    [['currency' => 'USD']], [['amount' => 0]],
]);

it('allows a completed payment to retry receipt loading without capturing or issuing another payment', function () {
    $booking = receiptBooking();
    $payment = receiptPayment($booking);
    Sanctum::actingAs($booking->user);
    $endpoint = "/api/mobile/paypal/orders/{$payment->provider_order_id}/receipt";
    $this->getJson($endpoint)->assertConflict();
    $receipt = app(BookingPaymentDocumentService::class)->issue($payment);
    $this->getJson($endpoint)->assertOk()->assertJsonPath('data.id', $receipt->id);
    $this->getJson($endpoint)->assertOk()->assertJsonPath('data.id', $receipt->id);
    expect(Payment::count())->toBe(1)->and(BookingPaymentDocument::count())->toBe(1);
});

it('paginates issued receipts and returns an intentional empty state', function () {
    $booking = receiptBooking();
    Sanctum::actingAs($booking->user);
    $endpoint = "/api/mobile/bookings/{$booking->booking_code}/receipts";
    $this->getJson($endpoint)->assertOk()->assertJsonCount(0, 'data');
    for ($index = 0; $index < 11; $index++) {
        app(BookingPaymentDocumentService::class)->issue(receiptPayment($booking));
    }
    $this->getJson($endpoint)->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.last_page', 2);
    $this->getJson($endpoint.'?page=2')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson($endpoint.'?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');
});

it('preserves access to an issued receipt after a refund or booking cancellation', function () {
    $booking = receiptBooking();
    $payment = receiptPayment($booking);
    $receipt = app(BookingPaymentDocumentService::class)->issue($payment);
    $payment->update(['status' => 'refunded']);
    $booking->update(['status' => BookingStatus::Cancelled]);
    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/receipts/{$receipt->id}")->assertOk()->assertJsonPath('data.amount', 1000);
});

it('does not mix a receipt with a payment from a different booking', function () {
    $booking = receiptBooking();
    $payment = receiptPayment($booking);
    $receipt = app(BookingPaymentDocumentService::class)->issue($payment);
    $other = receiptBooking();
    $payment->update(['booking_id' => $other->id]);
    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/receipts/{$receipt->id}")->assertNotFound();
});
