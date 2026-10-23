<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\Payment;
use App\Services\BookingConfirmationPdfService;
use App\Services\BookingConfirmationViewData;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('renders the booking confirmation as exactly two A4 pages', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-PDF-001',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::OwnersDriver,
        'rental_start_at' => now()->addDays(3)->setTime(9, 0),
        'rental_end_at' => now()->addDays(5)->setTime(9, 0),
        'pickup_location_type' => 'delivery',
        'pickup_location' => 'Dasmarinas, Cavite',
        'delivery_time' => '09:00',
        'return_location' => 'Makati, Metro Manila',
        'driver_option' => 'owners_driver',
        'owner_driver_coverage' => 'metro_manila',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'delivery_fee' => 900,
        'owner_driver_fee' => 1400,
        'add_ons_total' => 500,
        'discount_total' => 150,
        'down_payment_amount' => 2895,
        'remaining_balance' => 6755,
        'total_amount' => 9650,
        'customer_signature' => '[[{"x":10,"y":30},{"x":40,"y":10},{"x":80,"y":28}],[{"x":85,"y":28},{"x":120,"y":12}]]',
        'terms_version' => '2026-06-10',
        'terms_accepted_at' => now(),
        'confirmed_at' => now(),
    ]);

    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $user->id,
        'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Partial,
        'amount' => 2895,
        'transaction_id' => 'PAYPAL-PDF-TEST',
        'paid_at' => now(),
    ]);

    $pdf = app(BookingConfirmationPdfService::class)->make($booking);
    $output = $pdf->output();
    $html = view('pdf.bookings.rental-information', [
        'booking' => $booking,
        'confirmation' => app(BookingConfirmationViewData::class)->make($booking),
    ])->render();

    expect($output)->toStartWith('%PDF-')
        ->toContain('/BaseFont /NotoSans-Regular')
        ->toContain('/BaseFont /NotoSans-Bold')
        ->toContain('/FontFile2')
        ->and(strlen($output))->toBeGreaterThan(10_000)
        ->and($pdf->getDomPDF()->getCanvas()->get_page_count())->toBe(2)
        ->and($html)->toContain('Confirmed')
        ->and($html)->toContain('JAMJADE CAR RENTAL')
        ->and($html)->toContain('data:image/png;base64,')
        ->and($html)->toContain('PHP 3,500.00')
        ->and($html)->not->toContain('Requested Delivery Time')
        ->and($html)->toContain('Driver Option')
        ->and($html)->toContain('Driver Name')
        ->and($html)->toContain('To be assigned')
        ->and($html)->toContain('Contact Number')
        ->and($html)->not->toContain('Driver Type')
        ->and($html)->toContain('End Trip Location')
        ->and($html)->toContain('Makati, Metro Manila')
        ->and($html)->toContain('PHP 900.00')
        ->and($html)->not->toContain('PHP ₱')
        ->and($html)->toContain('General Terms and Conditions')
        ->and($html)->toContain('Terms and Conditions for Self-Drive Renters')
        ->and($html)->toContain("Terms and Conditions for Renting a Car with Owner's Driver")
        ->and($html)->toContain('Telematics must be active while the vehicle is in motion')
        ->and($html)->not->toContain('Official Receipt')
        ->and($html)->not->toContain('Rental Confirmation')
        ->and($html)->not->toContain('accent-line')
        ->and($pdf->download(app(BookingConfirmationPdfService::class)->filename($booking))->headers->get('Content-Disposition'))
        ->toContain('BK-PDF-001 | Confirmed | Rental Information.pdf')
        ->and($html)->not->toContain('Jamjade Representative Confirmation');
});

it('names the confirmation using the booking reference and displayed status', function (BookingStatus $status) {
    $booking = new Booking(['booking_code' => 'BK-20957', 'status' => $status]);

    expect(app(BookingConfirmationPdfService::class)->filename($booking))
        ->toBe('BK-20957 | '.$status->mobileLabel().' | Rental Information.pdf');
})->with(BookingStatus::cases());

it('derives paid status and balance from recorded payments', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-PDF-002',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Rent A Car Services',
        'return_location' => 'Jamjade Rent A Car Services',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Partial,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'total_amount' => 3500,
        'remaining_balance' => 2000,
        'terms_accepted_at' => now(),
    ]);

    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $user->id,
        'payment_method' => 'PayPal',
        'payment_status' => PaymentStatus::Paid,
        'amount' => 3500,
        'transaction_id' => 'PAYPAL-PAID-TEST',
        'paid_at' => now(),
    ]);

    $confirmation = app(BookingConfirmationViewData::class)->make($booking);

    expect($confirmation['paymentStatusLabel'])->toBe('Fully Paid')
        ->and($confirmation['payment']['amountPaid'])->toBe(3500.0)
        ->and($confirmation['payment']['remainingBalance'])->toBe(0);
});

it('shows the assigned driver name and contact number in the confirmation', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $driver = createDriverUser(['name' => 'Rogelio Santos', 'phone_number' => '09171234567']);
    $booking = Booking::create([
        'booking_code' => 'BK-PDF-DRV-001',
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
        'assigned_driver_id' => $driver->id,
        'driver_assigned_at' => now(),
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 2,
        'subtotal' => 7000,
        'delivery_fee' => 900,
        'owner_driver_fee' => 1400,
        'down_payment_amount' => 9300,
        'remaining_balance' => 0,
        'total_amount' => 9300,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
    ]);

    $html = view('pdf.bookings.rental-information', [
        'booking' => $booking,
        'confirmation' => app(BookingConfirmationViewData::class)->make($booking),
    ])->render();

    expect($html)->toContain('Driver Name')
        ->and($html)->toContain('Rogelio Santos')
        ->and($html)->toContain('Contact Number')
        ->and($html)->toContain('09171234567')
        ->and($html)->not->toContain('To be assigned');
});

it('hides driver information fields for self-drive bookings', function () {
    $user = customerUser();
    $vehicle = availableVehicle();
    $booking = Booking::create([
        'booking_code' => 'BK-PDF-SELF-001',
        'user_id' => $user->id,
        'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->addDays(3),
        'rental_end_at' => now()->addDays(4),
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Rent A Car Services',
        'return_location' => 'Jamjade Rent A Car Services',
        'driver_option' => 'self_drive',
        'status' => BookingStatus::Confirmed,
        'payment_status' => PaymentStatus::Paid,
        'price_per_day' => 3500,
        'duration_days' => 1,
        'subtotal' => 3500,
        'total_amount' => 3500,
        'remaining_balance' => 0,
        'down_payment_amount' => 3500,
        'customer_signature' => 'signed',
        'terms_version' => '2026-08-19',
        'terms_accepted_at' => now(),
    ]);

    $html = view('pdf.bookings.rental-information', [
        'booking' => $booking,
        'confirmation' => app(BookingConfirmationViewData::class)->make($booking),
    ])->render();

    expect($html)->not->toContain('Driver Name')
        ->and($html)->not->toContain('Contact Number')
        ->and($html)->not->toContain('To be assigned')
        ->and($html)->not->toContain('Driver Type');
});
