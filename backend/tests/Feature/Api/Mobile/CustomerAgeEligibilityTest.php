<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\PayPalCheckout;
use App\Models\User;
use App\Support\CustomerAgePolicy;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('reports unpaid customer charges as a booking lock in the mobile profile summary', function () {
    $user = customerUser();
    Sanctum::actingAs($user);

    $this->getJson('/api/mobile/profile')
        ->assertOk()
        ->assertJsonPath('data.bookingSummary.hasOutstandingBalance', false);

    $booking = Booking::create([
        'booking_code' => 'BK-BALANCE-LOCK',
        'user_id' => $user->id,
        'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->subDays(2),
        'rental_end_at' => now()->subDay(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => RentalType::SelfDrive->value,
        'status' => BookingStatus::Returned,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 1000,
        'remaining_balance' => 2500,
        'total_amount' => 3500,
    ]);
    $booking->additionalCharges()->create([
        'type' => 'cleaning',
        'description' => 'Interior cleaning',
        'amount' => 500,
        'responsibility' => 'customer',
        'responsible_user_id' => $user->id,
        'payment_status' => PaymentStatus::Unpaid,
        'created_by' => $user->id,
    ]);

    $this->getJson('/api/mobile/profile')
        ->assertOk()
        ->assertJsonPath('data.bookingSummary.hasOutstandingBalance', true);
});

it('accepts customers on their eighteenth birthday and rejects younger profile birthdates', function () {
    $user = User::factory()->create();
    $user->assignRole(UserRole::Customer->value);
    Sanctum::actingAs($user);

    $eligibleBirthdate = CustomerAgePolicy::latestEligibleBirthdate();

    $this->putJson('/api/mobile/profile', [
        'first_name' => 'Eligible',
        'last_name' => 'Customer',
        'phone_number' => '09185550191',
        'birthdate' => $eligibleBirthdate,
        'address' => 'Dasmarinas, Cavite',
    ])
        ->assertOk()
        ->assertJsonPath('data.birthdate', $eligibleBirthdate);

    $underageBirthdate = CarbonImmutable::parse($eligibleBirthdate)
        ->addDay()
        ->toDateString();

    $this->putJson('/api/mobile/profile', [
        'birthdate' => $underageBirthdate,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('birthdate')
        ->assertJsonPath('errors.birthdate.0', CustomerAgePolicy::MESSAGE);
});

it('rejects profile completion when a stored birthdate belongs to a minor', function () {
    $user = User::factory()->create();
    $user->assignRole(UserRole::Customer->value);
    $user->customerProfile()->create([
        'first_name' => 'Young',
        'last_name' => 'Customer',
        'birthdate' => CarbonImmutable::parse(CustomerAgePolicy::latestEligibleBirthdate())
            ->addDay()
            ->toDateString(),
        'address' => 'Dasmarinas, Cavite',
    ]);
    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/profile/complete', [
        'driving_intent' => 'owner_driver',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('birthdate')
        ->assertJsonPath('errors.birthdate.0', CustomerAgePolicy::MESSAGE);

    expect($user->customerProfile->fresh()->profile_completed_at)->toBeNull();
});

it('blocks minors from owner-driver bookings through standard and PayPal checkout paths', function () {
    $user = customerUser();
    $user->customerProfile()->update([
        'birthdate' => CarbonImmutable::parse(CustomerAgePolicy::latestEligibleBirthdate())
            ->addDay()
            ->toDateString(),
    ]);
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $bookingPayload = [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDays(3)->toDateTimeString(),
        'rental_end_at' => now()->addDays(4)->toDateTimeString(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Makati, Metro Manila',
        'driver_option' => 'owners_driver',
        'rental_type' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'customer_signature' => 'Young Customer',
        'terms_version' => '2026-07-29',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ];

    $this->postJson('/api/mobile/bookings', [
        ...$bookingPayload,
        'down_payment_amount' => 10000,
        'payment_method' => 'GCash',
        'transaction_id' => 'AGE-BLOCK-STANDARD',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('booking')
        ->assertJsonPath('errors.booking.0', CustomerAgePolicy::MESSAGE);

    $this->postJson('/api/mobile/paypal/orders', [
        ...$bookingPayload,
        'payment_option' => 'full_payment',
        'app_return_url' => 'exp://127.0.0.1:8081/--/paypal/return',
        'app_cancel_url' => 'exp://127.0.0.1:8081/--/paypal/cancel',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('booking')
        ->assertJsonPath('errors.booking.0', CustomerAgePolicy::MESSAGE);

    expect(Booking::query()->where('user_id', $user->id)->exists())->toBeFalse();
});

it('fails closed when a customer without a birthdate attempts to book', function () {
    $user = User::factory()->create();
    $user->assignRole(UserRole::Customer->value);
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/bookings', [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDays(3)->toDateTimeString(),
        'rental_end_at' => now()->addDays(4)->toDateTimeString(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Makati, Metro Manila',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'down_payment_amount' => 10000,
        'payment_method' => 'GCash',
        'customer_signature' => 'Profile Incomplete',
        'terms_version' => '2026-07-29',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('booking')
        ->assertJsonPath('errors.booking.0', CustomerAgePolicy::MESSAGE);
});

it('blocks capture of a pre-existing unpaid PayPal booking for a minor', function () {
    $user = customerUser();
    $user->customerProfile()->update([
        'birthdate' => CarbonImmutable::parse(CustomerAgePolicy::latestEligibleBirthdate())
            ->addDay()
            ->toDateString(),
    ]);
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-AGE-PENDING',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::OwnersDriver,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Makati, Metro Manila',
        'driver_option' => RentalType::OwnersDriver->value,
        'owner_driver_coverage' => 'metro_manila',
        'status' => BookingStatus::Pending,
        'payment_status' => PaymentStatus::Unpaid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'delivery_fee' => 900,
        'owner_driver_fee' => 700,
        'down_payment_amount' => 0,
        'remaining_balance' => 5100,
        'total_amount' => 5100,
        'customer_signature' => 'Young Customer',
        'terms_version' => '2026-07-29',
        'terms_accepted_at' => now(),
    ]);
    PayPalCheckout::create([
        'booking_id' => $booking->id,
        'user_id' => $user->id,
        'paypal_order_id' => 'LEGACY-MINOR-ORDER',
        'payment_option' => 'full_payment',
        'amount' => 5100,
        'currency' => 'PHP',
        'status' => 'created',
    ]);
    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/paypal/orders/LEGACY-MINOR-ORDER/capture')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('booking')
        ->assertJsonPath('errors.booking.0', CustomerAgePolicy::MESSAGE);

    expect($booking->fresh()->status)->toBe(BookingStatus::Pending)
        ->and($booking->successfulPayments()->exists())->toBeFalse()
        ->and($booking->paypalCheckouts()->exists())->toBeTrue();
});
