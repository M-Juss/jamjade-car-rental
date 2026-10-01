<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\UserRole;
use App\Enums\VehicleInspectionStatus;
use App\Enums\VehicleInspectionType;
use App\Models\Booking;
use App\Models\PayPalCheckout;
use App\Models\User;
use App\Models\VehicleInspection;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('keeps a booking with a pending PayPal checkout visible in the admin table', function () {
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);

    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-PAYMENT-PENDING',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Pending,
        'payment_status' => PaymentStatus::Unpaid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'remaining_balance' => 3500,
        'total_amount' => 3500,
    ]);

    PayPalCheckout::create([
        'booking_id' => $booking->id,
        'user_id' => $customer->id,
        'purpose' => 'down_payment',
        'status' => 'created',
        'provider_order_id' => 'PENDING-ORDER-1',
        'amount' => 1750,
        'currency' => 'PHP',
    ]);

    $this->actingAs($admin)->getJson('/admin/bookings')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.bookingCode', $booking->booking_code)
        ->assertJsonPath('data.0.statusKey', BookingStatus::Pending->value)
        ->assertJsonPath('data.0.paymentStatusKey', PaymentStatus::Unpaid->value);
});

it('separates current bookings from terminal history for management users', function () {
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);
    $staff = User::factory()->create();
    $staff->assignRole(UserRole::Staff->value);
    $customer = customerUser();
    $vehicle = availableVehicle();

    foreach (BookingStatus::cases() as $status) {
        Booking::create([
            'booking_code' => 'BK-GROUP-'.strtoupper($status->value),
            'user_id' => $customer->id,
            'vehicle_id' => $vehicle->id,
            'rental_type' => RentalType::SelfDrive,
            'rental_start_at' => now()->addDays(3),
            'rental_end_at' => now()->addDays(4),
            'pickup_location_type' => 'shop',
            'pickup_location' => 'Jamjade Garage',
            'return_location' => 'Jamjade Garage',
            'driver_option' => 'self_drive',
            'status' => $status,
            'payment_status' => PaymentStatus::Paid,
            'price_per_day' => 3500,
            'duration_days' => 1,
            'subtotal' => 3500,
            'remaining_balance' => 0,
            'total_amount' => 3500,
        ]);
    }

    $this->actingAs($staff)->getJson('/admin/bookings?group=booking&per_page=2')
        ->assertOk()
        ->assertJsonPath('meta.total', 4)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonCount(2, 'data');

    $this->actingAs($admin)->getJson('/admin/bookings?group=history&per_page=10')
        ->assertOk()
        ->assertJsonPath('meta.total', 3)
        ->assertJsonPath('meta.status_counts.completed', 1)
        ->assertJsonPath('meta.status_counts.cancelled', 1)
        ->assertJsonPath('meta.status_counts.rejected', 1)
        ->assertJsonCount(3, 'data');

    $this->actingAs($admin)->getJson('/admin/bookings?group=history&status=returned')
        ->assertOk()
        ->assertJsonPath('meta.total', 0);

    $this->actingAs($admin)->getJson('/admin/bookings?group=unknown')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('group');

    $pending = Booking::query()->where('booking_code', 'BK-GROUP-PENDING')->firstOrFail();
    $this->actingAs($admin)->postJson("/admin/bookings/{$pending->id}/cancel", [
        'reason' => 'Customer requested cancellation.',
    ])->assertOk();

    $this->actingAs($staff)->getJson('/admin/bookings?group=booking')
        ->assertJsonPath('meta.total', 3);
    $this->actingAs($staff)->getJson('/admin/bookings?group=history')
        ->assertJsonPath('meta.total', 4);
});

it('keeps terminal booking history view only for management actions', function () {
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);
    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-HISTORY-LOCKED',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->subDays(3),
        'rental_end_at' => now()->subDays(2),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Completed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
    ]);

    $this->actingAs($admin)->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()
        ->assertJsonPath('data.statusKey', BookingStatus::Completed->value);
    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/resend-confirmation-email")
        ->assertUnprocessable();
    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/telematics-setup/geofence", [
        'name' => 'History boundary',
        'geometry_type' => 'circle',
        'center_latitude' => 14.6,
        'center_longitude' => 121.0,
        'radius_meters' => 100,
    ])->assertUnprocessable();
    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/complete")
        ->assertUnprocessable();

    $this->assertDatabaseMissing('booking_geofences', ['booking_id' => $booking->id]);
});

it('returns finalized inspection progress in the booking list', function () {
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);
    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-PROGRESS-1',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::OwnersDriver,
        'rental_start_at' => now()->addDay(),
        'rental_end_at' => now()->addDays(2),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'owners_driver',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'remaining_balance' => 2000,
        'total_amount' => 3500,
    ]);

    $this->actingAs($admin)->getJson('/admin/bookings')
        ->assertOk()
        ->assertJsonPath('data.0.rentalProgress.outgoingFinalized', false)
        ->assertJsonPath('data.0.rentalProgress.incomingFinalized', false);

    VehicleInspection::factory()->create([
        'vehicle_id' => $vehicle->id,
        'booking_id' => $booking->id,
        'type' => VehicleInspectionType::Outgoing,
        'status' => VehicleInspectionStatus::Finalized,
        'finalized_at' => now(),
    ]);

    $this->actingAs($admin)->getJson('/admin/bookings')
        ->assertOk()
        ->assertJsonPath('data.0.rentalProgress.outgoingFinalized', true)
        ->assertJsonPath('data.0.rentalProgress.incomingFinalized', false);

    VehicleInspection::factory()->create([
        'vehicle_id' => $vehicle->id,
        'booking_id' => $booking->id,
        'type' => VehicleInspectionType::Incoming,
        'status' => VehicleInspectionStatus::Finalized,
        'finalized_at' => now(),
    ]);

    $this->actingAs($admin)->getJson('/admin/bookings')
        ->assertOk()
        ->assertJsonPath('data.0.rentalProgress.outgoingFinalized', true)
        ->assertJsonPath('data.0.rentalProgress.incomingFinalized', true);
});

it('allows an admin to confirm a pending booking through session auth', function () {
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);

    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-00010',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDay(),
        'rental_end_at' => now()->addDays(2),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Pending,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 1500,
        'remaining_balance' => 2000,
        'total_amount' => 3500,
    ]);

    $response = $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/confirm", [
        'reason' => 'Documents and down payment checked.',
    ]);

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.statusKey', BookingStatus::Confirmed->value)
        ->assertJsonPath('data.adminStatus', 'Confirmed');

    $this->assertDatabaseHas('booking_events', [
        'booking_id' => $booking->id,
        'event_type' => 'status_changed',
        'new_status' => BookingStatus::Confirmed->value,
        'actor_user_id' => $admin->id,
    ]);
});

it('allows an admin to force resend a paid booking confirmation email', function () {
    Mail::fake();
    Storage::fake('local');

    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);

    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-RESEND-1',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
        'confirmation_email_sent_at' => now()->subHour(),
        'confirmation_email_status' => 'sent',
    ]);

    $this->actingAs($admin)
        ->postJson("/admin/bookings/{$booking->id}/resend-confirmation-email")
        ->assertOk()
        ->assertJsonPath('message', 'Booking confirmation email resent successfully.')
        ->assertJsonPath('data.emailStatus', 'queued');

    $this->assertDatabaseHas('booking_confirmation_emails', [
        'booking_id' => $booking->id,
        'status' => 'queued',
        'sent_at' => null,
    ]);
});

it('prevents staff from manually resending booking confirmation emails', function () {
    $staff = User::factory()->create();
    $staff->assignRole(UserRole::Staff->value);

    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-RESEND-2',
        'user_id' => $customer->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'down_payment_amount' => 3500,
        'remaining_balance' => 0,
        'total_amount' => 3500,
    ]);

    $this->actingAs($staff)
        ->postJson("/admin/bookings/{$booking->id}/resend-confirmation-email")
        ->assertForbidden();
});
