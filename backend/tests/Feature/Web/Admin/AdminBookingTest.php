<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
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
