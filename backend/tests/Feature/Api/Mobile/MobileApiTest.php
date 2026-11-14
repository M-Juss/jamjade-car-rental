<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\UserRole;
use App\Enums\VehicleStatus;
use App\Mail\BookingConfirmationMail;
use App\Mail\VerifyMobileRegistrationMail;
use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\Payment;
use App\Models\PayPalCheckout;
use App\Models\TelematicsTrip;
use App\Models\User;
use App\Services\BookingService;
use App\Services\PaymentDeadlineService;
use App\Services\PayPalClient;
use App\Support\BookingAgreement;
use App\Support\PayPalAppUrl;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('bridges PayPal browser callbacks back to the mobile app', function () {
    $returnUrl = 'exp://192.168.1.50:8081/--/paypal/return';
    $returnTarget = PayPalAppUrl::encode($returnUrl);
    $cancelUrl = 'exp://192.168.1.50:8081/--/paypal/cancel';
    $cancelTarget = PayPalAppUrl::encode($cancelUrl);

    $this->get("/paypal/return/{$returnTarget}?token=PAYPAL-ORDER-1&PayerID=PAYER-1")
        ->assertOk()
        ->assertHeader('Cache-Control', 'must-revalidate, no-cache, no-store, private')
        ->assertSee('Payment Approved')
        ->assertSee(
            'exp://192.168.1.50:8081/--/paypal/return?token=PAYPAL-ORDER-1&amp;PayerID=PAYER-1',
            false
        );

    $this->get("/paypal/cancel/{$cancelTarget}?token=PAYPAL-ORDER-1")
        ->assertOk()
        ->assertSee('Payment Cancelled')
        ->assertSee(
            'exp://192.168.1.50:8081/--/paypal/cancel?token=PAYPAL-ORDER-1',
            false
        );
});

it('accepts only configured web PayPal callback origins', function () {
    config(['services.paypal.app_callback_origins' => ['http://localhost:8081']]);

    expect(PayPalAppUrl::isAllowed('http://localhost:8081/paypal/return'))->toBeTrue()
        ->and(PayPalAppUrl::isAllowed('https://localhost:8081/paypal/return'))->toBeFalse()
        ->and(PayPalAppUrl::isAllowed('http://untrusted.example/paypal/return'))->toBeFalse();
});

it('starts mobile registration with an email verification code and no account or token', function () {
    Mail::fake();

    $response = $this->postJson('/api/mobile/register', [
        'email' => 'new.customer@example.com',
        'password' => 'Abcdefgh1!',
        'password_confirmation' => 'Abcdefgh1!',
        'device_name' => 'pest-registration-device',
    ]);

    $response->assertStatus(202)
        ->assertJsonPath('success', true)
        ->assertJsonStructure(['data' => ['registrationId', 'email', 'expiresAt', 'resendAvailableAt']])
        ->assertJsonMissingPath('data.token')
        ->assertJsonMissingPath('data.user');

    $registrationId = $response->json('data.registrationId');
    $this->assertDatabaseMissing('users', ['email' => 'new.customer@example.com']);
    $this->assertDatabaseHas('pending_mobile_registrations', ['id' => $registrationId, 'email' => 'new.customer@example.com']);
    expect(Mail::sent(VerifyMobileRegistrationMail::class))->toHaveCount(1);

    $code = Mail::sent(VerifyMobileRegistrationMail::class)->first()->code;
    $verified = $this->postJson('/api/mobile/register/verify', [
        'registration_id' => $registrationId,
        'code' => $code,
    ])->assertCreated()
        ->assertJsonPath('data.tokenType', 'Bearer')
        ->assertJsonPath('data.user.isActive', true)
        ->assertJsonStructure(['data' => ['token', 'user']]);

    $this->assertDatabaseHas('users', [
        'email' => 'new.customer@example.com',
        'phone_number' => null,
    ]);
    $this->assertDatabaseMissing('pending_mobile_registrations', ['id' => $registrationId]);

    $this->withToken($verified->json('data.token'))
        ->getJson('/api/mobile/me')
        ->assertOk()
        ->assertJsonPath('data.user.email', 'new.customer@example.com');
});

it('returns a JSON unauthorized response for protected mobile endpoints', function () {
    $this->getJson('/api/mobile/profile')
        ->assertUnauthorized()
        ->assertJsonPath('message', 'Unauthenticated.');
});

it('logs in a mobile customer with sanctum token auth', function () {
    customerUser(['email' => 'login.customer@example.com', 'phone_number' => '09181234568']);

    $response = $this->postJson('/api/mobile/login', [
        'login' => 'login.customer@example.com',
        'password' => 'password123',
        'device_name' => 'pest-device',
    ]);

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonStructure(['data' => ['token', 'user']]);
});

it('completes the mobile profile and enforces self-drive age eligibility', function () {
    $user = User::factory()->create();
    $user->assignRole(UserRole::Customer->value);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/mobile/profile/complete', [
        'first_name' => 'Young',
        'last_name' => 'Renter',
        'birthdate' => now()->subYears(16)->toDateString(),
        'address' => 'Cavite',
        'wants_self_drive' => true,
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('success', false);
});

it('persists each mobile onboarding step to the customer profile', function () {
    Mail::fake();
    $registration = $this->postJson('/api/mobile/register', [
        'email' => 'onboarding.customer@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'device_name' => 'onboarding-device',
    ])->assertStatus(202);

    $code = Mail::sent(VerifyMobileRegistrationMail::class)->first()->code;
    $verified = $this->postJson('/api/mobile/register/verify', [
        'registration_id' => $registration->json('data.registrationId'),
        'code' => $code,
    ])->assertCreated();

    $this->withToken($verified->json('data.token'))
        ->putJson('/api/mobile/profile', [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'phone_number' => '09185550101',
            'birthdate' => '1999-04-10',
            'address' => 'Dasmarinas, Cavite',
        ])
        ->assertOk()
        ->assertJsonPath('data.firstName', 'Maria');

    $this->postJson('/api/mobile/profile/emergency-contact/skip')
        ->assertOk();

    $this->postJson('/api/mobile/profile/complete', [
        'driving_intent' => 'owner_driver',
    ])
        ->assertOk()
        ->assertJsonPath('data.drivingIntent', 'owner_driver')
        ->assertJsonMissingPath('data.passportRequired');

    $this->assertDatabaseHas('users', [
        'email' => 'onboarding.customer@example.com',
        'name' => 'Maria Santos',
        'phone_number' => '09185550101',
    ]);

    $this->assertDatabaseHas('customer_profiles', [
        'first_name' => 'Maria',
        'last_name' => 'Santos',
        'driving_intent' => 'owner_driver',
    ]);

    expect(
        User::where('email', 'onboarding.customer@example.com')
            ->firstOrFail()
            ->customerProfile
            ->emergency_contact_skipped_at
    )->not->toBeNull();
});

it('rejects web admin accounts from mobile token login outside RC mode', function () {
    $user = User::factory()->create([
        'email' => 'mobile.denied@example.com',
        'password' => 'password123',
    ]);
    $user->assignRole(UserRole::Admin->value);

    $this->postJson('/api/mobile/login', [
        'email' => 'mobile.denied@example.com',
        'password' => 'password123',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.login.0', 'This account does not have mobile customer access.');
});

it('lets guests list only available mobile vehicles', function () {
    $vehicle = availableVehicle();
    availableVehicle([
        'name' => 'Unavailable Test Vehicle',
        'status' => VehicleStatus::Maintenance,
    ]);
    $vehicle->images()->create([
        'image_path' => 'https://images.unsplash.com/photo-later-primary-image',
        'is_primary' => true,
        'sort_order' => 1,
    ]);

    $response = $this->getJson('/api/mobile/vehicles');

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.0.cardImage', 'https://images.unsplash.com/photo-1549924231-f129b911e442')
        ->assertJsonPath('data.0.images.0', 'https://images.unsplash.com/photo-1549924231-f129b911e442')
        ->assertJsonMissing(['name' => 'Unavailable Test Vehicle'])
        ->assertJsonCount(1, 'data')
        ->assertJsonStructure(['data' => [['name', 'pricePerDay', 'cardImage', 'images']], 'meta' => ['total']]);

    $vehicle = $response->json('data.0');

    expect(Schema::hasColumn('vehicles', 'plate_number'))->toBeTrue();

    expect(array_key_exists('year', $vehicle))->toBeFalse()
        ->and(array_key_exists('plateNumber', $vehicle))->toBeFalse()
        ->and(array_key_exists('mileage', $vehicle))->toBeFalse()
        ->and(array_key_exists('type', $vehicle))->toBeFalse()
        ->and(array_key_exists('location', $vehicle))->toBeFalse();
});

it('lets guests view available vehicle details but not unavailable vehicles', function () {
    $availableVehicle = availableVehicle();
    $unavailableVehicle = availableVehicle([
        'name' => 'Maintenance Vehicle',
        'status' => VehicleStatus::Maintenance,
    ]);

    $this->getJson("/api/mobile/vehicles/{$availableVehicle->id}")
        ->assertOk()
        ->assertJsonPath('data.id', (string) $availableVehicle->id)
        ->assertJsonPath('data.status', VehicleStatus::Available->value);

    $this->getJson("/api/mobile/vehicles/{$unavailableVehicle->id}")
        ->assertNotFound();
});

it('requires authentication before a guest can create a booking', function () {
    $vehicle = availableVehicle();

    $this->postJson('/api/mobile/bookings', [
        'vehicle_id' => $vehicle->id,
    ])->assertUnauthorized();
});

it('validates mobile collection filters and pagination limits', function () {
    Sanctum::actingAs(customerUser());

    $this->getJson('/api/mobile/vehicles?status=unknown&per_page=101')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status', 'per_page']);

    $this->getJson('/api/mobile/bookings?status=unknown&per_page=0')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['status', 'per_page']);

    $this->getJson('/api/mobile/notifications?category=unknown&per_page=101')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['category', 'per_page']);
});

it('returns confirmed booking date ranges for the specific vehicle', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $start = now()->addDays(5)->startOfDay();
    $end = now()->addDays(7)->startOfDay();

    Booking::create([
        'booking_code' => 'BK-BLOCKED-DATES',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => $start,
        'rental_end_at' => $end,
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'down_payment_amount' => 2100,
        'remaining_balance' => 4900,
        'total_amount' => 7000,
        'confirmed_at' => now(),
    ]);

    Sanctum::actingAs($user);

    $this->getJson("/api/mobile/vehicles/{$vehicle->id}")
        ->assertOk()
        ->assertJsonPath('data.unavailableDateRanges.0.startDate', $start->toDateString())
        ->assertJsonPath('data.unavailableDateRanges.0.endDate', $end->toDateString());
});

it('creates a booking with backend pricing and down payment validation', function () {
    $user = customerUser();
    $user->emergencyContacts()->delete();
    $vehicle = availableVehicle();
    $vehicle->update(['color' => 'Silver']);
    Sanctum::actingAs($user);

    $payload = [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDays(3)->toDateTimeString(),
        'rental_end_at' => now()->addDays(4)->toDateTimeString(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage - Cavite',
        'return_location' => 'Jamjade Garage - Cavite',
        'driver_option' => 'self_drive',
        'down_payment_amount' => 1750,
        'payment_method' => 'GCash',
        'transaction_id' => 'GCASH-TEST-1',
        'customer_signature' => 'Juan Dela Cruz',
        'terms_version' => '2026-06-07',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ];

    $this->postJson('/api/mobile/profile/emergency-contact/skip')->assertOk();
    $this->getJson('/api/mobile/profile')
        ->assertOk()
        ->assertJsonPath('data.selfDriveAvailability.canSelfDrive', false)
        ->assertJsonPath('data.profile.selfDriveReviewStatus', 'emergency_contact_required')
        ->assertJsonPath('data.profile.verificationStatus', 'approved');
    $this->postJson('/api/mobile/bookings', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('driver_option')
        ->assertJsonPath('errors.driver_option.0', 'Add an emergency contact in your profile before booking a self-drive vehicle.');
    $this->assertDatabaseCount('bookings', 0);

    $this->postJson('/api/mobile/profile/emergency-contact', [
        'name' => 'Maria Dela Cruz',
        'relationship' => 'Parent',
        'phone_number' => '09123456789',
    ])->assertOk();
    $this->getJson('/api/mobile/profile')
        ->assertOk()
        ->assertJsonPath('data.selfDriveAvailability.canSelfDrive', true)
        ->assertJsonPath('data.profile.selfDriveReviewStatus', 'eligible');

    $response = $this->postJson('/api/mobile/bookings', $payload);

    $response->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', 'Confirmed')
        ->assertJsonPath('data.color', 'Silver')
        ->assertJsonPath('data.paymentStatus', 'Partially Paid');

    expect($response->json('data.bookingCode'))->toMatch('/^BK-\d{5}$/');

    $this->getJson('/api/mobile/bookings/'.$response->json('data.bookingCode'))
        ->assertOk()
        ->assertJsonPath('data.color', 'Silver');

    $this->getJson('/api/mobile/bookings')
        ->assertOk()
        ->assertJsonPath('data.0.color', 'Silver');

    $this->assertDatabaseHas('bookings', [
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'status' => BookingStatus::Confirmed->value,
    ]);
});

it('rejects a pickup time that has already passed today', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/bookings', [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->subMinute()->format('Y-m-d H:i'),
        'rental_end_at' => now()->addDay()->format('Y-m-d H:i'),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage - Cavite',
        'return_location' => 'Jamjade Garage - Cavite',
        'driver_option' => 'self_drive',
        'down_payment_amount' => 1750,
        'payment_method' => 'GCash',
        'transaction_id' => 'GCASH-PAST-TIME',
        'customer_signature' => 'Juan Dela Cruz',
        'terms_version' => '2026-06-07',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('rental_start_at');
});

it('rejects booking dates that overlap a confirmed booking for the same vehicle', function () {
    $user = customerUser();
    $otherCustomer = customerUser(['email' => 'existing.booking@example.com']);
    $vehicle = availableVehicle();
    $start = now()->addDays(5)->startOfDay();
    $end = now()->addDays(7)->startOfDay();

    Booking::create([
        'booking_code' => 'BK-EXISTING-CONFIRMED',
        'user_id' => $otherCustomer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => $start,
        'rental_end_at' => $end,
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'down_payment_amount' => 7000,
        'remaining_balance' => 0,
        'total_amount' => 7000,
        'confirmed_at' => now(),
    ]);

    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/bookings', [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => $start->addDay()->toDateTimeString(),
        'rental_end_at' => $end->addDay()->toDateTimeString(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage - Cavite',
        'return_location' => 'Jamjade Garage - Cavite',
        'driver_option' => 'self_drive',
        'down_payment_amount' => 1500,
        'payment_method' => 'GCash',
        'transaction_id' => 'GCASH-OVERLAP',
        'customer_signature' => 'Juan Dela Cruz',
        'terms_version' => '2026-06-10',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('rental_start_at');
});

it('derives and stores delivery details for owner driver bookings', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $start = now()->addDays(3);
    $expectedDeliveryTime = $start->copy()->setTimezone('Asia/Manila')->format('H:i');

    $payload = [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => $start->toDateTimeString(),
        'rental_end_at' => now()->addDays(4)->toDateTimeString(),
        'pickup_location_type' => 'delivery',
        'pickup_location' => 'Dasmarinas, Cavite',
        'return_location' => 'Dasmarinas, Cavite',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'down_payment_amount' => 2600,
        'payment_method' => 'GCash',
        'transaction_id' => 'GCASH-DELIVERY-1',
        'customer_signature' => 'Juan Dela Cruz',
        'terms_version' => '2026-06-10',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ];

    $this->postJson('/api/mobile/bookings', withTestDeliveryQuote($user, $payload))
        ->assertCreated()
        ->assertJsonPath('data.pickupType', 'Delivery')
        ->assertJsonPath('data.deliveryTime', $expectedDeliveryTime)
        ->assertJsonPath('data.deliveryTimeLabel', CarbonImmutable::parse($expectedDeliveryTime)->format('g:i A'))
        ->assertJsonPath('data.returnLocation', 'Dasmarinas, Cavite')
        ->assertJsonPath('data.deliveryFee', 900)
        ->assertJsonPath('data.ownerDriverFee', 700)
        ->assertJsonPath('data.totalAmount', 5100);

    $this->assertDatabaseHas('bookings', [
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'pickup_location_type' => 'delivery',
        'return_location' => 'Dasmarinas, Cavite',
        'delivery_fee' => 900,
        'owner_driver_fee' => 700,
    ]);
});

it('calculates outside Manila owner driver coverage only by rental day', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $this->postJson('/api/mobile/bookings', withTestDeliveryQuote($user, [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDays(3)->startOfDay()->toDateTimeString(),
        'rental_end_at' => now()->addDays(5)->startOfDay()->toDateTimeString(),
        'pickup_location_type' => 'delivery',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Dasmarinas, Cavite',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'outside_manila',
        'down_payment_amount' => 5000,
        'payment_method' => 'GCash',
        'transaction_id' => 'GCASH-OUTSIDE-1',
        'customer_signature' => 'Juan Dela Cruz',
        'terms_version' => '2026-06-13',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ]))
        ->assertCreated()
        ->assertJsonPath('data.durationDays', 2)
        ->assertJsonPath('data.ownerDriverFee', 2000)
        ->assertJsonPath('data.outsideManilaFee', 0)
        ->assertJsonPath('data.totalAmount', 9900);
});

it('enforces fulfillment options from the selected driver option', function () {
    $user = customerUser();
    $user->emergencyContacts()->delete();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $basePayload = [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now()->addDays(3)->toDateTimeString(),
        'rental_end_at' => now()->addDays(4)->toDateTimeString(),
        'pickup_location' => 'Dasmarinas, Cavite',
        'return_location' => 'Makati, Metro Manila',
        'down_payment_amount' => 2500,
        'payment_method' => 'GCash',
        'customer_signature' => 'Juan Dela Cruz',
        'terms_version' => '2026-06-13',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
    ];

    $this->postJson('/api/mobile/bookings', [
        ...$basePayload,
        'pickup_location_type' => 'delivery',
        'delivery_time' => '09:00',
        'driver_option' => 'self_drive',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('pickup_location_type');

    $this->postJson('/api/mobile/bookings', [
        ...$basePayload,
        'pickup_location_type' => 'shop',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
    ])
        ->assertCreated()
        ->assertJsonPath('data.pickupLocation', 'Jamjade Garage')
        ->assertJsonPath('data.deliveryFee', 0);
});

it('requires full payment when the rental starts less than two calendar days away', function (int $leadDays) {
    Http::fake();

    $user = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/mobile/paypal/orders', [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now('Asia/Manila')->addDays($leadDays)->toDateString(),
        'rental_end_at' => now('Asia/Manila')->addDays($leadDays + 1)->toDateString(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Makati, Metro Manila',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'payment_option' => 'down_payment',
        'customer_signature' => '[[{"x":1,"y":1},{"x":2,"y":2}]]',
        'terms_version' => '2026-06-13',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
        'app_return_url' => 'exp://192.168.1.50:8081/--/paypal/return',
        'app_cancel_url' => 'exp://192.168.1.50:8081/--/paypal/cancel',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors('payment_option')
        ->assertJsonPath(
            'errors.payment_option.0',
            'Down payment is available only when the rental date is at least two days from today.'
        );

    expect(Booking::count())->toBe(0)
        ->and(PayPalCheckout::count())->toBe(0);
    Http::assertNothingSent();
})->with([0, 1]);

it('creates and captures a PayPal sandbox order in PHP', function (?string $callbackOrigin, string $expectedOrigin) {
    Mail::fake();
    Storage::fake('local');

    config([
        'services.paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        'services.paypal.client_id' => 'sandbox-client-id',
        'services.paypal.client_secret' => 'sandbox-client-secret',
        'services.paypal.return_url' => null,
        'services.paypal.cancel_url' => null,
        'services.paypal.callback_origin' => $callbackOrigin,
    ]);

    Http::fake([
        'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
            'access_token' => 'sandbox-access-token',
            'token_type' => 'Bearer',
        ]),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders' => Http::response([
            'id' => 'PAYPAL-ORDER-TEST-1',
            'status' => 'CREATED',
            'links' => [[
                'href' => 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-TEST-1',
                'rel' => 'payer-action',
                'method' => 'GET',
            ]],
        ], 201),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/PAYPAL-ORDER-TEST-1/capture' => Http::response([
            'id' => 'PAYPAL-ORDER-TEST-1',
            'status' => 'COMPLETED',
            'purchase_units' => [[
                'payments' => [
                    'captures' => [[
                        'id' => 'PAYPAL-CAPTURE-TEST-1',
                        'status' => 'COMPLETED',
                        'amount' => [
                            'currency_code' => 'PHP',
                            'value' => '2550.00',
                        ],
                    ]],
                ],
            ]],
        ]),
    ]);

    $user = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);

    $createResponse = $this->postJson('http://192.168.1.50:8000/api/mobile/paypal/orders', withTestDeliveryQuote($user, [
        'vehicle_id' => $vehicle->id,
        'rental_start_at' => now('Asia/Manila')->addDays(2)->toDateString(),
        'rental_end_at' => now('Asia/Manila')->addDays(3)->toDateString(),
        'pickup_location_type' => 'delivery',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Makati, Metro Manila',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'payment_option' => 'down_payment',
        'customer_signature' => '[[{"x":1,"y":1},{"x":2,"y":2}]]',
        'terms_version' => '2026-06-09',
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
        'app_return_url' => 'exp://192.168.1.50:8081/--/paypal/return',
        'app_cancel_url' => 'exp://192.168.1.50:8081/--/paypal/cancel',
    ]));

    $createResponse->assertCreated()
        ->assertJsonPath('data.orderId', 'PAYPAL-ORDER-TEST-1')
        ->assertJsonPath('data.amount', 2550)
        ->assertJsonPath('data.currency', 'PHP');

    $checkout = PayPalCheckout::firstOrFail();
    $booking = $checkout->booking;

    expect($booking->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and((float) $booking->down_payment_amount)->toBe(0.0)
        ->and((float) $booking->delivery_fee)->toBe(900.0)
        ->and((float) $booking->owner_driver_fee)->toBe(700.0)
        ->and((float) $booking->total_amount)->toBe(5100.0)
        ->and((float) $booking->remaining_balance)->toBe(5100.0);

    $this->getJson('/api/mobile/bookings')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.bookingCode', $booking->booking_code)
        ->assertJsonPath('data.0.statusKey', BookingStatus::Pending->value)
        ->assertJsonPath('data.0.paymentStatusKey', PaymentStatus::Unpaid->value);

    $orderRequest = Http::recorded(
        fn ($request) => $request->url() === 'https://api-m.sandbox.paypal.com/v2/checkout/orders'
    )->first()[0];

    expect($orderRequest['purchase_units'][0]['amount']['currency_code'])->toBe('PHP')
        ->and($orderRequest['purchase_units'][0]['amount']['value'])->toBe('2550.00')
        ->and($orderRequest['payment_source']['paypal']['experience_context']['return_url'])
        ->toBe(
            $expectedOrigin.'/paypal/return/'.
            PayPalAppUrl::encode('exp://192.168.1.50:8081/--/paypal/return')
        )
        ->and($orderRequest['payment_source']['paypal']['experience_context']['cancel_url'])
        ->toBe(
            $expectedOrigin.'/paypal/cancel/'.
            PayPalAppUrl::encode('exp://192.168.1.50:8081/--/paypal/cancel')
        );

    $this->postJson('/api/mobile/paypal/orders/PAYPAL-ORDER-TEST-1/capture')
        ->assertOk()
        ->assertJsonPath('data.bookingCode', $booking->booking_code)
        ->assertJsonPath('data.status', 'Confirmed')
        ->assertJsonPath('data.paymentStatusKey', PaymentStatus::Partial->value)
        ->assertJsonPath('data.deliveryFee', 900)
        ->assertJsonPath('data.ownerDriverFee', 700)
        ->assertJsonPath('data.returnLocation', 'Dasmarinas, Cavite')
        ->assertJsonPath('data.remainingBalance', 2550)
        ->assertJsonPath('data.balanceDueAt', BookingAgreement::balanceDeadline($booking->rental_start_at)->toISOString());

    $this->assertDatabaseHas('payments', [
        'booking_id' => $booking->id,
        'provider' => 'paypal',
        'purpose' => 'down_payment',
        'status' => 'completed',
        'amount' => 2550,
        'provider_order_id' => 'PAYPAL-ORDER-TEST-1',
        'provider_transaction_id' => 'PAYPAL-CAPTURE-TEST-1',
        'currency' => 'PHP',
    ]);

    $this->assertDatabaseHas('bookings', [
        'id' => $booking->id,
        'status' => BookingStatus::Confirmed->value,
    ]);

    $this->getJson('/api/mobile/bookings')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.bookingCode', $booking->booking_code);

    $this->assertDatabaseHas('notifications', [
        'booking_id' => $booking->id,
        'title' => 'Booking confirmed',
        'action_label' => 'Pay Remaining Balance',
    ]);

    $this->assertDatabaseHas('booking_confirmation_emails', [
        'booking_id' => $booking->id,
        'status' => 'queued',
        'sent_at' => null,
    ]);

    Mail::assertSent(
        BookingConfirmationMail::class,
        fn (BookingConfirmationMail $mail) => $mail->hasTo($user->email)
            && str_starts_with($mail->envelope()->subject, "{$booking->booking_code} | Rental Information and Payment Receipt | RCP-")
            && count($mail->attachments()) === 2
            && Storage::disk('local')->exists($mail->document->rental_information_path)
            && Storage::disk('local')->exists($mail->document->receipt_path)
    );
})->with([
    'direct Laravel request' => [null, 'http://192.168.1.50:8000'],
    'public portal proxy' => ['https://portal.example.test', 'https://portal.example.test'],
]);

it('pays an existing booking remaining balance with a new PayPal order', function () {
    config([
        'services.paypal.base_url' => 'https://api-m.sandbox.paypal.com',
        'services.paypal.client_id' => 'sandbox-client-id',
        'services.paypal.client_secret' => 'sandbox-client-secret',
        'services.paypal.return_url' => 'mobilefrontend://paypal/return',
        'services.paypal.cancel_url' => 'mobilefrontend://paypal/cancel',
    ]);

    Http::fake([
        'https://api-m.sandbox.paypal.com/v1/oauth2/token' => Http::response([
            'access_token' => 'sandbox-access-token',
            'token_type' => 'Bearer',
        ]),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders' => Http::response([
            'id' => 'PAYPAL-BALANCE-ORDER-1',
            'status' => 'CREATED',
            'links' => [[
                'href' => 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-BALANCE-ORDER-1',
                'rel' => 'payer-action',
                'method' => 'GET',
            ]],
        ], 201),
        'https://api-m.sandbox.paypal.com/v2/checkout/orders/PAYPAL-BALANCE-ORDER-1/capture' => Http::response([
            'id' => 'PAYPAL-BALANCE-ORDER-1',
            'status' => 'COMPLETED',
            'purchase_units' => [[
                'payments' => [
                    'captures' => [[
                        'id' => 'PAYPAL-BALANCE-CAPTURE-1',
                        'status' => 'COMPLETED',
                        'amount' => [
                            'currency_code' => 'PHP',
                            'value' => '2450.00',
                        ],
                    ]],
                ],
            ]],
        ]),
    ]);

    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-00011',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(4),
        'rental_end_at' => now()->addDays(5),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Pending,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 1050,
        'remaining_balance' => 2450,
        'balance_due_at' => now()->addDays(3),
        'total_amount' => 3500,
    ]);
    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $user->id,
        'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Partial,
        'amount' => 1050,
        'transaction_id' => 'PAYPAL-DOWN-PAYMENT',
        'paid_at' => now(),
    ]);
    Sanctum::actingAs($user);

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/orders", [
        'app_return_url' => 'mobilefrontend://paypal/return',
        'app_cancel_url' => 'mobilefrontend://paypal/cancel',
    ])
        ->assertCreated()
        ->assertJsonPath('data.orderId', 'PAYPAL-BALANCE-ORDER-1')
        ->assertJsonPath('data.amount', 2450)
        ->assertJsonPath('data.currency', 'PHP');

    // A dismissed or failed checkout must be removable so the customer is not
    // permanently blocked by the one-open-checkout guard.
    $this->postJson('/api/mobile/paypal/orders/PAYPAL-BALANCE-ORDER-1/abandon')
        ->assertOk();

    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/orders", [
        'app_return_url' => 'mobilefrontend://paypal/return',
        'app_cancel_url' => 'mobilefrontend://paypal/cancel',
    ])
        ->assertCreated()
        ->assertJsonPath('data.orderId', 'PAYPAL-BALANCE-ORDER-1');

    $this->postJson('/api/mobile/paypal/orders/PAYPAL-BALANCE-ORDER-1/capture')
        ->assertOk()
        ->assertJsonPath('data.status', 'Confirmed')
        ->assertJsonPath('data.paymentStatus', 'Paid')
        ->assertJsonPath('data.remainingBalance', 0)
        ->assertJsonPath('data.balanceDueAt', null);

    $this->assertDatabaseHas('payments', [
        'booking_id' => $booking->id,
        'provider_transaction_id' => 'PAYPAL-BALANCE-CAPTURE-1',
        'amount' => 2450,
    ]);
});

it('reminds customers and cancels overdue partial bookings without refunding the down payment', function () {
    $now = CarbonImmutable::parse('2026-06-09 10:00:00', config('app.timezone'));
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-00012',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => $now->addHours(36),
        'rental_end_at' => $now->addHours(60),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 1050,
        'remaining_balance' => 2450,
        'balance_due_at' => $now->addHours(12),
        'total_amount' => 3500,
        'confirmed_at' => $now->subHour(),
    ]);
    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $user->id,
        'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Partial,
        'amount' => 1050,
        'transaction_id' => 'NON-REFUNDABLE-DOWN-PAYMENT',
        'paid_at' => $now->subDay(),
    ]);

    $service = app(PaymentDeadlineService::class);
    expect($service->process($now))->toBe(['reminded' => 1, 'cancelled' => 0]);
    expect($service->process($now->addHours(13)))->toBe(['reminded' => 0, 'cancelled' => 1]);

    $booking->refresh();

    expect($booking->status)->toBe(BookingStatus::Cancelled)
        ->and($booking->payment_status)->toBe(PaymentStatus::Partial)
        ->and((float) $booking->down_payment_amount)->toBe(1050.0)
        ->and($booking->payments()->count())->toBe(1);

    $this->assertDatabaseHas('notifications', [
        'booking_id' => $booking->id,
        'title' => 'Booking cancelled - unpaid balance',
    ]);
});

it('uploads all supported customer document formats for review', function () {
    Storage::fake('public');
    $customer = documentCustomerUser();
    Sanctum::actingAs($customer);

    $licenseResponse = $this->post('/api/mobile/documents/upload', [
        'privacy_notice_version' => 'document-privacy-v1',
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'document_number' => 'N01-23-456789',
        'expires_at' => now()->addYear()->toDateString(),
        'front_file' => UploadedFile::fake()->image('license-front.jpg')->size(512),
        'back_file' => UploadedFile::fake()->image('license-back.jpg')->size(512),
    ], ['Accept' => 'application/json']);

    $billingResponse = $this->post('/api/mobile/documents/upload', [
        'privacy_notice_version' => 'document-privacy-v1',
        'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'file' => UploadedFile::fake()->image('billing.jpg')->size(512),
    ], ['Accept' => 'application/json']);

    foreach ([$licenseResponse, $billingResponse] as $response) {
        $response->assertCreated()
            ->assertJsonPath('data.status', 'Pending');
    }

    $licenseResponse
        ->assertJsonPath('data.documentNumber', 'N01-23-456789')
        ->assertJsonPath('data.statusKey', 'pending');
    $billingResponse
        ->assertJsonPath('data.documentType', CustomerDocument::PROOF_OF_BILLING)
        ->assertJsonPath('data.name', 'Proof of Address')
        ->assertJsonPath('data.backFileUrl', null);
    $this->assertDatabaseCount('customer_documents', 2);
    $this->assertDatabaseCount('notifications', 0);
    $this->assertDatabaseHas('customer_profiles', [
        'user_id' => $customer->id,
        'can_self_drive' => false,
        'verification_status' => 'pending_review',
    ]);
});

it('accepts customer document images up to 5 MB and rejects larger images', function () {
    Storage::fake('public');
    Sanctum::actingAs(documentCustomerUser());

    $this->post('/api/mobile/documents/upload', [
        'privacy_notice_version' => 'document-privacy-v1',
        'document_type' => CustomerDocument::DRIVERS_LICENSE,
        'document_number' => 'N01-23-456789',
        'expires_at' => now()->addYear()->toDateString(),
        'front_file' => UploadedFile::fake()->image('license-front.jpg')->size(5120),
        'back_file' => UploadedFile::fake()->image('license-back.jpg')->size(512),
    ], ['Accept' => 'application/json'])
        ->assertCreated();

    $this->post('/api/mobile/documents/upload', [
        'privacy_notice_version' => 'document-privacy-v1',
        'document_type' => CustomerDocument::PROOF_OF_BILLING,
        'file' => UploadedFile::fake()->image('billing.jpg')->size(5121),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('file');
});

it('rejects valid ID uploads because the document is no longer required', function () {
    Storage::fake('public');
    $customer = documentCustomerUser();
    Sanctum::actingAs($customer);

    $customer->documents()->create([
        'document_type' => CustomerDocument::VALID_ID,
        'file_path' => "customer-documents/{$customer->id}/legacy-valid-id.jpg",
        'status' => 'pending',
        'submitted_at' => now(),
    ]);

    $this->getJson('/api/mobile/documents')
        ->assertOk()
        ->assertJsonCount(0, 'data');

    $this->post('/api/mobile/documents/upload', [
        'privacy_notice_version' => 'document-privacy-v1',
        'document_type' => CustomerDocument::VALID_ID,
        'front_file' => UploadedFile::fake()->image('valid-id-front.jpg')->size(512),
        'back_file' => UploadedFile::fake()->image('valid-id-back.jpg')->size(512),
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('document_type');
});

it('validates mobile profile names and 11-digit contact numbers', function () {
    $user = customerUser();
    Sanctum::actingAs($user);

    $this->putJson('/api/mobile/profile', [
        'first_name' => 'Maria2',
        'last_name' => 'Santos!',
        'phone_number' => '091855501011',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['first_name', 'last_name', 'phone_number']);

    $this->putJson('/api/mobile/profile', [
        'first_name' => 'Maria Clara',
        'last_name' => 'Santos Reyes',
        'phone_number' => '09185550101',
    ])
        ->assertOk()
        ->assertJsonPath('data.firstName', 'Maria Clara')
        ->assertJsonPath('data.lastName', 'Santos Reyes');
});

it('updates the mobile sign-in email from account information', function () {
    $user = customerUser(['email' => 'old.email@example.com']);
    Sanctum::actingAs($user);

    $this->putJson('/api/mobile/account/email', [
        'email' => 'New.Email@Example.com',
        'current_password' => 'password123',
    ])
        ->assertOk()
        ->assertJsonPath('data.email', 'new.email@example.com');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'email' => 'new.email@example.com',
    ]);

    $this->postJson('/api/mobile/login', [
        'email' => 'new.email@example.com',
        'password' => 'password123',
    ])->assertOk();

    $this->postJson('/api/mobile/login', [
        'email' => 'old.email@example.com',
        'password' => 'password123',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['login']);
});

it('rejects an email that belongs to another account when updating the mobile profile', function () {
    $user = customerUser(['email' => 'current.email@example.com']);
    customerUser(['email' => 'taken.email@example.com']);
    Sanctum::actingAs($user);

    $this->putJson('/api/mobile/account/email', [
        'email' => 'taken.email@example.com',
        'current_password' => 'password123',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

it('validates emergency contact names and 11-digit contact numbers', function () {
    Sanctum::actingAs(customerUser());

    $this->postJson('/api/mobile/profile/emergency-contact', [
        'name' => 'Juan 2',
        'relationship' => 'Parent',
        'phone_number' => '091855501011',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'phone_number']);

    $this->postJson('/api/mobile/profile/emergency-contact', [
        'name' => 'Juan Dela Cruz',
        'relationship' => 'Parent',
        'phone_number' => '09185550101',
    ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Juan Dela Cruz')
        ->assertJsonPath('data.phone_number', '09185550101');
});

it('accepts profile images up to 5 MB and rejects larger images', function () {
    Storage::fake('public');
    Sanctum::actingAs(customerUser());

    $this->post('/api/mobile/profile', [
        'profile_picture' => UploadedFile::fake()->image('profile.jpg')->size(5120),
    ], [
        'Accept' => 'application/json',
    ])
        ->assertOk();

    $this->post('/api/mobile/profile', [
        'profile_picture' => UploadedFile::fake()->image('profile-too-large.jpg')->size(5121),
    ], [
        'Accept' => 'application/json',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('profile_picture');
});

it('stores telematics events only for active customer trips', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-00013',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->subHour(),
        'rental_end_at' => now()->addDay(),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Ongoing,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 1500,
        'remaining_balance' => 2000,
        'total_amount' => 3500,
        'confirmed_at' => now()->subHours(2),
        'started_at' => now()->subHour(),
    ]);
    $trip = TelematicsTrip::create([
        'booking_id' => $booking->id,
        'operator_user_id' => $user->id,
        'status' => 'started',
        'started_at' => now()->subMinutes(30),
    ]);
    Sanctum::actingAs($user);

    $response = $this->postJson("/api/mobile/telematics/trips/{$trip->id}/events", [
        'event_type' => 'harsh_braking',
        'severity' => 'high',
        'latitude' => 14.6012,
        'longitude' => 121.0365,
        'metadata' => ['summary' => 'Hard braking event'],
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.eventType', 'harsh_braking')
        ->assertJsonPath('data.severity', 'High');
});

it('revises an unpaid pending booking after an abandoned checkout and preserves the signed agreement', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);
    $this->mock(PayPalClient::class, function ($mock) {
        $mock->shouldReceive('createOrder')->twice()->andReturn(
            ['id' => 'REVISION-OLD', 'links' => [['rel' => 'approve', 'href' => 'https://example.com/old']]],
            ['id' => 'REVISION-NEW', 'links' => [['rel' => 'approve', 'href' => 'https://example.com/new']]],
        );
    });
    $start = now('Asia/Manila')->addDays(5)->startOfDay();
    $payload = [
        'vehicle_id' => $vehicle->id, 'rental_start_at' => $start->toDateString(),
        'rental_end_at' => $start->copy()->addDay()->toDateString(), 'pickup_location_type' => 'shop',
        'pickup_location' => BookingService::JAMJADE_GARAGE,
        'return_location' => BookingService::JAMJADE_GARAGE,
        'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila',
        'payment_option' => 'full_payment', 'customer_signature' => 'original-signature',
        'terms_version' => BookingAgreement::VERSION,
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
        'reviewed_pricing' => ['price_per_day' => 3500, 'subtotal' => 3500, 'delivery_fee' => 0,
            'delivery_toll_fee' => 0, 'owner_driver_fee' => 700, 'total_amount' => 4200],
        'app_return_url' => 'exp://192.168.1.50:8081/--/paypal/return',
        'app_cancel_url' => 'exp://192.168.1.50:8081/--/paypal/cancel',
    ];
    $this->postJson('/api/mobile/paypal/orders', $payload)->assertCreated();
    $booking = Booking::firstOrFail();
    $this->postJson('/api/mobile/paypal/orders/REVISION-OLD/abandon')->assertOk();
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}")->assertOk()->assertJsonPath('data.canReviseUnpaid', true);
    $payload['rental_end_at'] = $start->copy()->addDays(2)->toDateString();
    $payload['customer_signature'] = 'updated-signature';
    $payload['reviewed_pricing']['subtotal'] = 7000;
    $payload['reviewed_pricing']['owner_driver_fee'] = 1400;
    $payload['reviewed_pricing']['total_amount'] = 8400;
    $conflict = $booking->replicate();
    $conflict->booking_code = 'CONFLICT-REVISION';
    $conflict->user_id = customerUser()->id;
    $conflict->status = BookingStatus::Confirmed;
    $conflict->rental_start_at = $start->copy()->addDay();
    $conflict->rental_end_at = $start->copy()->addDays(3);
    $conflict->save();
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)
        ->assertUnprocessable()->assertJsonValidationErrors('rental_start_at');
    $conflict->delete();
    $wrongPrice = $payload;
    $wrongPrice['reviewed_pricing']['total_amount'] = 1;
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $wrongPrice)
        ->assertUnprocessable()->assertJsonValidationErrors('reviewed_pricing');
    expect($booking->fresh()->terms->customer_signature)->toBe('original-signature');
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)
        ->assertCreated()->assertJsonPath('data.amount', 8400);
    $this->assertDatabaseHas('booking_terms_revisions', ['booking_id' => $booking->id, 'customer_signature' => 'original-signature']);
    $this->assertDatabaseHas('booking_terms', ['booking_id' => $booking->id, 'customer_signature' => 'updated-signature']);
    $this->assertDatabaseHas('payments', ['provider_order_id' => 'REVISION-OLD', 'status' => 'abandoned']);
    $this->postJson('/api/mobile/paypal/orders/REVISION-OLD/capture')->assertUnprocessable();
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)->assertUnprocessable();
    $current = PayPalCheckout::where('provider_order_id', 'REVISION-NEW')->firstOrFail();
    $current->update(['status' => 'approved']);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}")->assertOk()->assertJsonPath('data.canReviseUnpaid', false);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)->assertUnprocessable();
    $current->update(['status' => 'failed', 'provider_response' => ['status' => 'COMPLETED']]);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)->assertUnprocessable();
    $current->update(['status' => 'completed']);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)->assertUnprocessable();
    Sanctum::actingAs(customerUser());
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)->assertNotFound();
});

it('requires a fresh delivery quote and retains the previously accepted quote when revising dates', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    Sanctum::actingAs($user);
    $this->mock(PayPalClient::class, function ($mock) {
        $mock->shouldReceive('createOrder')->twice()->andReturn(
            ['id' => 'DELIVERY-OLD', 'links' => [['rel' => 'approve', 'href' => 'https://example.com/old']]],
            ['id' => 'DELIVERY-NEW', 'links' => [['rel' => 'approve', 'href' => 'https://example.com/new']]],
        );
    });
    $start = now('Asia/Manila')->addDays(5)->startOfDay();
    $payload = withTestDeliveryQuote($user, [
        'vehicle_id' => $vehicle->id, 'rental_start_at' => $start->toDateString(),
        'rental_end_at' => $start->copy()->addDay()->toDateString(), 'pickup_location_type' => 'delivery',
        'pickup_location' => 'Test delivery location', 'return_location' => 'Test delivery location',
        'driver_option' => 'owners_driver', 'owner_driver_coverage' => 'metro_manila',
        'payment_option' => 'full_payment', 'customer_signature' => 'old signature',
        'terms_version' => BookingAgreement::VERSION,
        'late_return_policy_version' => lateReturnPolicyVersion($vehicle->id),
        'reviewed_pricing' => ['price_per_day' => 3500, 'subtotal' => 3500, 'delivery_fee' => 900,
            'delivery_toll_fee' => 0, 'owner_driver_fee' => 700, 'total_amount' => 5100],
        'app_return_url' => 'exp://192.168.1.50:8081/--/paypal/return',
        'app_cancel_url' => 'exp://192.168.1.50:8081/--/paypal/cancel',
    ]);
    $oldQuote = $payload['delivery_quote_id'];
    $this->postJson('/api/mobile/paypal/orders', $payload)->assertCreated();
    $booking = Booking::firstOrFail();
    $this->postJson('/api/mobile/paypal/orders/DELIVERY-OLD/abandon')->assertOk();
    $payload['rental_end_at'] = $start->copy()->addDays(2)->toDateString();
    $payload['reviewed_pricing']['subtotal'] = 7000;
    $payload['reviewed_pricing']['owner_driver_fee'] = 1400;
    $payload['reviewed_pricing']['total_amount'] = 9300;
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)
        ->assertUnprocessable()->assertJsonValidationErrors('delivery_quote_id');
    $payload = withTestDeliveryQuote($user, $payload);
    $newQuote = $payload['delivery_quote_id'];
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/paypal/revise-order", $payload)->assertCreated();
    expect($booking->fresh()->deliveryQuote->id)->toBe($newQuote);
    $this->assertDatabaseHas('booking_terms_revisions', ['booking_id' => $booking->id, 'delivery_quote_id' => $oldQuote]);
    $this->assertDatabaseHas('delivery_quotes', ['id' => $oldQuote, 'booking_id' => null, 'status' => 'consumed']);
    $this->assertDatabaseHas('delivery_quotes', ['id' => $newQuote, 'booking_id' => $booking->id]);
});
