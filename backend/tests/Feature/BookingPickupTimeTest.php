<?php

use App\Http\Requests\Booking\StoreBookingRequest;
use App\Http\Requests\Delivery\DeliveryRoutesRequest;
use App\Http\Requests\Payment\CreatePayPalOrderRequest;
use App\Http\Requests\Payment\RevisePayPalOrderRequest;
use App\Services\PayPalClient;
use App\Support\BookingAgreement;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

afterEach(fn () => CarbonImmutable::setTestNow());

it('accepts an elapsed pickup for delivery quotes and checkout when the pickup date is still today', function (string $requestClass, string $clock, string $start, string $end, ?string $errorField) {
    CarbonImmutable::setTestNow(CarbonImmutable::parse($clock)->utc());
    $rules = array_intersect_key((new $requestClass)->rules(), array_flip(['rental_start_at', 'rental_end_at']));
    $validator = Validator::make(['rental_start_at' => $start, 'rental_end_at' => $end], $rules);
    if ($errorField === null && $requestClass === StoreBookingRequest::class
        && CarbonImmutable::parse($start)->lte(CarbonImmutable::now())) {
        $errorField = 'rental_start_at';
    }
    expect($validator->passes())->toBe($errorField === null);
    if ($errorField) {
        expect($validator->errors()->has($errorField))->toBeTrue();
    }
})->with([
    StoreBookingRequest::class, CreatePayPalOrderRequest::class,
    RevisePayPalOrderRequest::class, DeliveryRoutesRequest::class,
])->with([
    'earlier today' => ['2026-11-15T12:00:00+08:00', '2026-11-15T09:00:00+08:00', '2026-11-16T09:00:00+08:00', null],
    'exact current time' => ['2026-11-15T12:00:00+08:00', '2026-11-15T12:00:00+08:00', '2026-11-16T12:00:00+08:00', null],
    'future day' => ['2026-11-15T12:00:00+08:00', '2026-11-16T09:00:00+08:00', '2026-11-17T09:00:00+08:00', null],
    'Manila midnight in previous UTC day' => ['2026-11-15T00:15:00+08:00', '2026-11-15T00:00:00+08:00', '2026-11-16T00:00:00+08:00', null],
    'late Manila day already tomorrow in device timezone' => ['2026-11-15T23:59:00+08:00', '2026-11-15T01:00:00+08:00', '2026-11-16T01:00:00+08:00', null],
    'previous Manila date' => ['2026-11-15T00:15:00+08:00', '2026-11-14T23:59:00+08:00', '2026-11-16T00:00:00+08:00', 'rental_start_at'],
    'ended interval' => ['2026-11-15T12:00:00+08:00', '2026-11-15T09:00:00+08:00', '2026-11-15T11:00:00+08:00', 'rental_end_at'],
    'return exactly now' => ['2026-11-15T12:00:00+08:00', '2026-11-15T09:00:00+08:00', '2026-11-15T12:00:00+08:00', 'rental_end_at'],
    'return not after pickup' => ['2026-11-15T12:00:00+08:00', '2026-11-16T09:00:00+08:00', '2026-11-16T09:00:00+08:00', 'rental_end_at'],
    'invalid pickup' => ['2026-11-15T12:00:00+08:00', 'invalid', '2026-11-16T09:00:00+08:00', 'rental_start_at'],
]);

it('creates and captures a full PayPal payment around the tentative pickup without moving the return deadline', function (string $orderClock, string $captureClock) {
    $this->seed(RoleAndPermissionSeeder::class);
    CarbonImmutable::setTestNow(CarbonImmutable::parse($orderClock)->utc());
    Http::preventStrayRequests();
    $user = customerUser();
    $vehicle = availableVehicle();
    $this->mock(PayPalClient::class, function ($mock) {
        $mock->shouldReceive('createOrder')->once()->andReturn([
            'id' => 'TENTATIVE-PICKUP', 'status' => 'CREATED',
            'links' => [['rel' => 'approve', 'href' => 'https://www.sandbox.paypal.com/checkoutnow?token=TENTATIVE-PICKUP']],
        ]);
        $mock->shouldReceive('captureOrder')->once()->andReturn([
            'id' => 'TENTATIVE-PICKUP', 'status' => 'COMPLETED',
            'purchase_units' => [['payments' => ['captures' => [[
                'id' => 'TENTATIVE-CAPTURE', 'status' => 'COMPLETED',
                'amount' => ['currency_code' => 'PHP', 'value' => '3500.00'],
            ]]]]],
        ]);
    });
    Sanctum::actingAs($user);
    $this->postJson('/api/mobile/paypal/orders', [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => '2026-11-15T09:00:00+08:00', 'rental_end_at' => '2026-11-16T09:00:00+08:00',
        'driver_option' => 'self_drive', 'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage', 'return_location' => 'Jamjade Garage',
        'payment_option' => 'full_payment', 'customer_signature' => 'Test Customer', 'terms_version' => BookingAgreement::VERSION,
        'reviewed_pricing' => ['price_per_day' => 3500, 'subtotal' => 3500, 'delivery_fee' => 0, 'delivery_toll_fee' => 0, 'owner_driver_fee' => 0, 'total_amount' => 3500],
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
        'app_return_url' => 'mobilefrontend://paypal/return', 'app_cancel_url' => 'mobilefrontend://paypal/cancel',
    ])->assertCreated()->assertJsonPath('data.orderId', 'TENTATIVE-PICKUP');

    CarbonImmutable::setTestNow(CarbonImmutable::parse($captureClock)->utc());
    $this->postJson('/api/mobile/paypal/orders/TENTATIVE-PICKUP/capture')->assertOk()
        ->assertJsonPath('data.status', 'Confirmed')->assertJsonPath('data.paymentStatus', 'Paid')
        ->assertJsonPath('data.rentalStartAt', '2026-11-15T01:00:00.000000Z')
        ->assertJsonPath('data.rentalEndAt', '2026-11-16T01:00:00.000000Z');
})->with([
    'pickup passes during PayPal approval' => ['2026-11-15T08:55:00+08:00', '2026-11-15T12:00:00+08:00'],
    'checkout retry after pickup time' => ['2026-11-15T12:00:00+08:00', '2026-11-15T12:00:00+08:00'],
    'capture after the pickup date and before return' => ['2026-11-15T23:55:00+08:00', '2026-11-16T00:05:00+08:00'],
]);
