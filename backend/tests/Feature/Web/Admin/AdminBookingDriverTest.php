<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

function bookingAdminUser(): User
{
    $user = User::factory()->create();
    $user->assignRole(UserRole::Admin->value);

    return $user;
}

function assignableBooking(array $attributes = []): Booking
{
    $customer = customerUser();
    $vehicle = availableVehicle();

    return Booking::create(array_merge([
        'booking_code' => 'BK-ADM-'.strtoupper(Str::random(6)),
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::OwnersDriver,
        'rental_start_at' => now()->addDays(3)->setTime(9, 0),
        'rental_end_at' => now()->addDays(5)->setTime(9, 0),
        'pickup_location_type' => 'delivery',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Dasmarinas, Cavite',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'status' => BookingStatus::Pending,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'delivery_fee' => 900,
        'owner_driver_fee' => 1400,
        'down_payment_amount' => 2800,
        'remaining_balance' => 6500,
        'total_amount' => 9300,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
    ], $attributes));
}

it('returns only active driver-role staff from the drivers endpoint', function () {
    $admin = bookingAdminUser();
    $active = createDriverUser(['name' => 'Active Driver']);
    createDriverUser(['name' => 'Inactive Driver', 'is_active' => false]);
    $regular = User::factory()->create(['is_active' => true]);
    $regular->assignRole('staff');

    $response = $this->actingAs($admin)->getJson('/admin/bookings/drivers');

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonCount(1, 'data.drivers')
        ->assertJsonPath('data.drivers.0.id', $active->id)
        ->assertJsonPath('data.drivers.0.name', 'Active Driver');
});

it('includes active assignment counts for each driver', function () {
    $admin = bookingAdminUser();
    $busy = createDriverUser(['name' => 'Busy Driver']);
    $free = createDriverUser(['name' => 'Free Driver']);

    assignableBooking([
        'assigned_driver_id' => $busy->id,
        'status' => BookingStatus::Confirmed,
    ]);

    $response = $this->actingAs($admin)->getJson('/admin/bookings/drivers');

    $response->assertOk()
        ->assertJsonPath('data.drivers.0.id', $busy->id)
        ->assertJsonPath('data.drivers.0.activeAssignments', 1)
        ->assertJsonPath('data.drivers.1.id', $free->id)
        ->assertJsonPath('data.drivers.1.activeAssignments', 0);
});

it('denies the drivers endpoint without the manage bookings permission', function () {
    $staff = User::factory()->create();
    $staff->assignRole('customer');

    $this->actingAs($staff)->getJson('/admin/bookings/drivers')->assertForbidden();
});

it('assigns a driver to an owners-driver booking and returns the updated resource', function () {
    $admin = bookingAdminUser();
    $driver = createDriverUser(['name' => 'Handpicked Driver']);
    $booking = assignableBooking();

    $response = $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/assign-driver", [
        'driver_id' => $driver->id,
    ]);

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.assignedDriver.id', $driver->id)
        ->assertJsonPath('data.assignedDriver.name', 'Handpicked Driver');

    expect($response->json('data.driverAssignedAt'))->not->toBeNull();

    expect($booking->fresh()->assigned_driver_id)->toBe($driver->id);
});

it('rejects assigning an overlapping or inactive driver with a field error', function () {
    $admin = bookingAdminUser();
    $busy = createDriverUser(['name' => 'Busy Driver']);
    $inactive = createDriverUser(['name' => 'Inactive Driver', 'is_active' => false]);

    assignableBooking([
        'assigned_driver_id' => $busy->id,
        'status' => BookingStatus::Confirmed,
    ]);
    $booking = assignableBooking();

    $overlap = $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/assign-driver", [
        'driver_id' => $busy->id,
    ]);

    $overlap->assertUnprocessable()
        ->assertJsonValidationErrors('driver_id');

    $inactiveResponse = $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/assign-driver", [
        'driver_id' => $inactive->id,
    ]);

    $inactiveResponse->assertUnprocessable()
        ->assertJsonValidationErrors('driver_id');
});

it('validates the driver payload', function () {
    $admin = bookingAdminUser();
    $booking = assignableBooking();

    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/assign-driver", [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('driver_id');

    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/assign-driver", [
        'driver_id' => 999999,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('driver_id');
});

it('rejects assigning a driver to a self-drive booking', function () {
    $admin = bookingAdminUser();
    $driver = createDriverUser(['name' => 'Idle Driver']);

    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-ADM-SELF-001',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3)->setTime(9, 0),
        'rental_end_at' => now()->addDays(5)->setTime(9, 0),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Rent A Car Services',
        'return_location' => 'Jamjade Rent A Car Services',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Pending,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'down_payment_amount' => 2100,
        'remaining_balance' => 4900,
        'total_amount' => 7000,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
    ]);

    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/assign-driver", [
        'driver_id' => $driver->id,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('driver_id');
});

it('exposes the assigned driver in the booking resource', function () {
    $admin = bookingAdminUser();
    $driver = createDriverUser(['name' => 'Resource Driver']);
    $booking = assignableBooking();

    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/assign-driver", [
        'driver_id' => $driver->id,
    ])->assertOk();

    $this->actingAs($admin)->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()
        ->assertJsonPath('data.assignedDriver.id', $driver->id)
        ->assertJsonPath('data.assignedDriver.name', 'Resource Driver');
});
