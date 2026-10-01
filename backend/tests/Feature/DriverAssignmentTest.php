<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\User;
use App\Services\DriverAssignmentService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

function createOwnersDriverBooking(array $attributes = []): Booking
{
    $user = customerUser();
    $vehicle = availableVehicle();

    return Booking::create(array_merge([
        'booking_code' => 'BK-DRV-'.strtoupper(Str::random(6)),
        'user_id' => $user->id,
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
        'payment_status' => PaymentStatus::Unpaid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'delivery_fee' => 900,
        'owner_driver_fee' => 1400,
        'down_payment_amount' => 0,
        'remaining_balance' => 9300,
        'total_amount' => 9300,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
    ], $attributes));
}

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('seeds a mobile-only driver role without management permissions', function () {
    $role = Role::findByName(DriverAssignmentService::DRIVER_ROLE, 'web');

    expect($role->exists)->toBeTrue()
        ->and($role->permissions)->toHaveCount(0)
        ->and($role->hasPermissionTo('view dashboard'))->toBeFalse()
        ->and($role->hasPermissionTo('manage bookings'))->toBeFalse();
});

it('rejects a stale Driver model after personnel deactivation', function () {
    $driver = createDriverUser();
    $booking = createOwnersDriverBooking();
    User::whereKey($driver->id)->update(['is_active' => false]);

    expect(fn () => app(DriverAssignmentService::class)->assign($booking, $driver))
        ->toThrow(ValidationException::class);
    expect($booking->fresh()->assigned_driver_id)->toBeNull();
});

it('rejects a stale Driver model after conversion to Staff', function () {
    $driver = createDriverUser();
    $booking = createOwnersDriverBooking();
    $driver->load('roles');
    User::findOrFail($driver->id)->syncRoles(['staff']);

    expect(fn () => app(DriverAssignmentService::class)->assign($booking, $driver))
        ->toThrow(ValidationException::class);
    expect($booking->fresh()->assigned_driver_id)->toBeNull();
});

it('auto-assigns the first active driver to an owners-driver booking', function () {
    $first = createDriverUser(['name' => 'First Driver']);
    $second = createDriverUser(['name' => 'Second Driver']);
    $booking = createOwnersDriverBooking();

    $service = app(DriverAssignmentService::class);
    $assigned = $service->autoAssign($booking);

    expect($assigned?->is($first))->toBeTrue()
        ->and($booking->fresh()->assigned_driver_id)->toBe($first->id)
        ->and($booking->fresh()->driver_assigned_at)->not->toBeNull();
});

it('skips inactive drivers during auto-assign', function () {
    $inactive = createDriverUser(['is_active' => false]);
    $active = createDriverUser(['name' => 'Active Driver']);
    $booking = createOwnersDriverBooking();

    $assigned = app(DriverAssignmentService::class)->autoAssign($booking);

    expect($assigned?->is($active))->toBeTrue();
});

it('skips drivers whose active owners-driver bookings overlap the rental window', function () {
    $busy = createDriverUser(['name' => 'Busy Driver']);
    $free = createDriverUser(['name' => 'Free Driver']);

    createOwnersDriverBooking([
        'assigned_driver_id' => $busy->id,
        'rental_start_at' => now()->addDays(2)->setTime(8, 0),
        'rental_end_at' => now()->addDays(6)->setTime(18, 0),
        'status' => BookingStatus::Confirmed,
    ]);

    $booking = createOwnersDriverBooking();

    $assigned = app(DriverAssignmentService::class)->autoAssign($booking);

    expect($assigned?->is($free))->toBeTrue();
});

it('does not treat finished bookings as driver conflicts', function () {
    $driver = createDriverUser();

    createOwnersDriverBooking([
        'assigned_driver_id' => $driver->id,
        'rental_start_at' => now()->addDays(2)->setTime(8, 0),
        'rental_end_at' => now()->addDays(6)->setTime(18, 0),
        'status' => BookingStatus::Completed,
    ]);

    $booking = createOwnersDriverBooking();

    $assigned = app(DriverAssignmentService::class)->autoAssign($booking);

    expect($assigned?->is($driver))->toBeTrue();
});

it('leaves the booking unassigned when no free driver exists', function () {
    $busy = createDriverUser();

    createOwnersDriverBooking([
        'assigned_driver_id' => $busy->id,
        'rental_start_at' => now()->addDays(2)->setTime(8, 0),
        'rental_end_at' => now()->addDays(6)->setTime(18, 0),
        'status' => BookingStatus::Confirmed,
    ]);

    $booking = createOwnersDriverBooking();

    $assigned = app(DriverAssignmentService::class)->autoAssign($booking);

    expect($assigned)->toBeNull()
        ->and($booking->fresh()->assigned_driver_id)->toBeNull();
});

it('never auto-assigns a driver to a self-drive booking', function () {
    createDriverUser(['name' => 'Idle Driver']);
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-DRV-SELF-001',
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
        'payment_status' => PaymentStatus::Unpaid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'down_payment_amount' => 0,
        'remaining_balance' => 7000,
        'total_amount' => 7000,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
    ]);

    $assigned = app(DriverAssignmentService::class)->autoAssign($booking);

    expect($assigned)->toBeNull()
        ->and($booking->fresh()->assigned_driver_id)->toBeNull();
});

it('keeps an existing assignment when auto-assign runs again', function () {
    $driver = createDriverUser(['name' => 'Assigned Driver']);
    $booking = createOwnersDriverBooking();

    $service = app(DriverAssignmentService::class);
    $service->assign($booking, $driver);

    $booking = $booking->fresh();
    $reassigned = $service->autoAssign($booking);

    expect($reassigned?->is($driver))->toBeTrue()
        ->and($booking->assigned_driver_id)->toBe($driver->id);
});

it('rejects assigning an inactive or non-driver staff account', function () {
    $inactive = createDriverUser(['is_active' => false]);
    $regular = User::factory()->create(['is_active' => true]);
    $regular->assignRole('staff');
    $booking = createOwnersDriverBooking();
    $service = app(DriverAssignmentService::class);

    expect(fn () => $service->assign($booking, $inactive))
        ->toThrow(ValidationException::class)
        ->and(fn () => $service->assign($booking, $regular))
        ->toThrow(ValidationException::class);
});

it('rejects assigning a driver to a self-drive booking', function () {
    $driver = createDriverUser();
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-DRV-SELF-002',
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
        'payment_status' => PaymentStatus::Unpaid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'down_payment_amount' => 0,
        'remaining_balance' => 7000,
        'total_amount' => 7000,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
    ]);

    expect(fn () => app(DriverAssignmentService::class)->assign($booking, $driver))
        ->toThrow(ValidationException::class);
});

it('rejects assigning a driver who overlaps another active booking', function () {
    $driver = createDriverUser(['name' => 'Busy Driver']);
    createOwnersDriverBooking([
        'assigned_driver_id' => $driver->id,
        'rental_start_at' => now()->addDays(2)->setTime(8, 0),
        'rental_end_at' => now()->addDays(6)->setTime(18, 0),
        'status' => BookingStatus::Confirmed,
    ]);
    $booking = createOwnersDriverBooking();
    $service = app(DriverAssignmentService::class);

    expect(fn () => $service->assign($booking, $driver))
        ->toThrow(ValidationException::class)
        ->and($booking->fresh()->assigned_driver_id)->toBeNull();
});

it('assigns manually and records the assignment time', function () {
    $driver = createDriverUser(['name' => 'Handpicked Driver']);
    $booking = createOwnersDriverBooking();

    $assigned = app(DriverAssignmentService::class)->assign($booking, $driver);

    expect($assigned->is($driver))->toBeTrue()
        ->and($booking->fresh()->assigned_driver_id)->toBe($driver->id)
        ->and($booking->fresh()->driver_assigned_at)->not->toBeNull();
});

it('lists only free active drivers for a booking', function () {
    $busy = createDriverUser(['name' => 'Busy Driver']);
    $free = createDriverUser(['name' => 'Free Driver']);
    $inactive = createDriverUser(['name' => 'Inactive Driver', 'is_active' => false]);

    createOwnersDriverBooking([
        'assigned_driver_id' => $busy->id,
        'rental_start_at' => now()->addDays(2)->setTime(8, 0),
        'rental_end_at' => now()->addDays(6)->setTime(18, 0),
        'status' => BookingStatus::Confirmed,
    ]);
    $booking = createOwnersDriverBooking();

    $available = app(DriverAssignmentService::class)->availableDriversFor($booking);

    expect($available->pluck('id'))->toContain($free->id)
        ->and($available)->not->toContain($busy->id)
        ->and($available)->not->toContain($inactive->id)
        ->and($available)->toHaveCount(1);
});
