<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('returns live dashboard and report analytics', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);
    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-REPORT-1',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDay(),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Rent A Car Services',
        'return_location' => 'Jamjade Rent A Car Services',
        'driver_option' => RentalType::SelfDrive->value,
        'status' => BookingStatus::Completed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 3,
        'subtotal' => 10500,
        'total_amount' => 10500,
        'completed_at' => now(),
    ]);

    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $customer->id,
        'payment_method' => 'Cash',
        'payment_status' => PaymentStatus::Paid,
        'amount' => 10500,
        'transaction_id' => 'REPORT-PAYMENT-1',
        'paid_at' => now(),
    ]);

    $this->actingAs($owner)->getJson('/admin/dashboard')
        ->assertOk()
        ->assertJsonPath('data.summary.totalRevenue', 10500)
        ->assertJsonPath('data.summary.totalBookings', 1)
        ->assertJsonPath('data.summary.completedBookings', 1)
        ->assertJsonPath('data.topVehicles.0.name', $vehicle->name)
        ->assertJsonCount(12, 'data.monthlyRevenue');

    $this->actingAs($owner)->getJson('/admin/reports?range=all_time')
        ->assertOk()
        ->assertJsonPath('data.summary.totalRevenue', 10500)
        ->assertJsonPath('data.revenueTransactions.0.bookingId', 'BK-REPORT-1')
        ->assertJsonPath('data.bookings.0.status', 'Completed')
        ->assertJsonMissing(['label' => 'Refund Loss']);
});

it('shows confirmed bookings on the dashboard', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);
    $customer = customerUser();
    $vehicle = availableVehicle();

    Booking::create([
        'booking_code' => 'BK-CONFIRMED-1',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDay(),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Rent A Car Services',
        'return_location' => 'Jamjade Rent A Car Services',
        'driver_option' => RentalType::SelfDrive->value,
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 3,
        'subtotal' => 10500,
        'total_amount' => 10500,
        'confirmed_at' => now(),
    ]);

    $this->actingAs($owner)->getJson('/admin/dashboard')
        ->assertOk()
        ->assertJsonPath('data.summary.confirmedBookings', 1)
        ->assertJsonPath('data.confirmedBookings.0.bookingId', 'BK-CONFIRMED-1')
        ->assertJsonPath('data.confirmedBookings.0.statusKey', BookingStatus::Confirmed->value);
});

it('downloads PDF and CSV reports', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);

    $this->actingAs($owner)->get('/admin/reports/pdf?range=12_months')
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    $this->actingAs($owner)->get('/admin/reports/excel?range=12_months')
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=UTF-8');
});

it('rejects unsupported report ranges', function () {
    $owner = User::factory()->create();
    $owner->assignRole(UserRole::Admin->value);

    $this->actingAs($owner)
        ->getJson('/admin/reports?range=custom')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('range');
});
