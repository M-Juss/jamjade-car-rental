<?php

use App\Http\Requests\Payment\CreatePayPalOrderRequest;
use App\Models\User;
use App\Services\BookingService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

function ownersDriverBookingPayload(array $overrides = []): array
{
    return array_merge([
        'vehicle_id' => availableVehicle()->id,
        'rental_start_at' => now()->addDays(3)->setTime(9, 30)->format('Y-m-d H:i'),
        'rental_end_at' => now()->addDays(5)->setTime(9, 30)->format('Y-m-d H:i'),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Dasmarinas, Cavite',
        'return_location' => 'Dasmarinas, Cavite',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
    ], $overrides);
}

it('waives the delivery fee when the owner-s driver pickup is the Jamjade Garage', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = app(BookingService::class)->createAwaitingPayPalPayment($user, ownersDriverBookingPayload([
        'vehicle_id' => $vehicle->id,
        'pickup_location' => BookingService::JAMJADE_GARAGE,
        'return_location' => BookingService::JAMJADE_GARAGE,
    ]));

    expect($booking->delivery_fee)->toBe('0.00')
        ->and($booking->pickup_location)->toBe('Jamjade Garage');
});

it('uses the accepted delivery quote for a specific delivery location', function () {
    $user = customerUser();
    $booking = app(BookingService::class)->createAwaitingPayPalPayment(
        $user,
        withTestDeliveryQuote($user, ownersDriverBookingPayload(['pickup_location_type' => 'delivery']), 254)
    );

    expect($booking->delivery_fee)->toBe('254.00');
});

it('derives the delivery time from the rental start time', function () {
    $user = customerUser();
    $booking = app(BookingService::class)->createAwaitingPayPalPayment(
        $user,
        ownersDriverBookingPayload(['rental_start_at' => now()->addDays(3)->setTime(9, 30)->format('Y-m-d H:i')])
    );

    expect($booking->delivery_time)->toBe('09:30')
        ->and($booking->duration_days)->toBe(2);
});

it('accepts an owners-driver booking payload without a delivery_time', function () {
    $payload = ownersDriverBookingPayload([
        'payment_option' => 'down_payment',
        'app_return_url' => 'exp://return',
        'app_cancel_url' => 'exp://cancel',
    ]);

    $request = CreatePayPalOrderRequest::create('/api/mobile/paypal/orders', 'POST', $payload);
    $request->setContainer(app());
    $request->setRedirector(app('redirect'));
    $request->validateResolved();

    expect(true)->toBeTrue();
});

it('still rejects an owners-driver booking for a customer that cannot book', function () {
    $user = User::factory()->create();
    $user->assignRole('customer');

    try {
        app(BookingService::class)->createAwaitingPayPalPayment(
            $user,
            ownersDriverBookingPayload()
        );
        expect(true)->toBeFalse('Expected a validation exception.');
    } catch (ValidationException $exception) {
        expect($exception->validator->errors()->has('booking'))->toBeTrue();
    }
});
