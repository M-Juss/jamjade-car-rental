<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStepStatus;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\RentalReadinessService;
use App\Services\TelematicsHandoverEligibilityService;
use App\Services\TelematicsSetupService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    config(['telematics.handover_test_mode' => false, 'telematics.early_start_test_mode' => true]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-17T00:30:00+08:00')->utc());
});

afterEach(fn () => CarbonImmutable::setTestNow());

function earlyStartRental(RentalType $type = RentalType::SelfDrive): Booking
{
    return lifecycleBooking($type, [
        'rental_start_at' => CarbonImmutable::parse('2026-10-17T20:20:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-18T20:20:00+08:00')->utc(),
    ]);
}

it('allows only the bounded local early-start timing exception for both rental types', function (RentalType $type, string $environment, bool $enabled, string $clock, bool $eligible) {
    $booking = earlyStartRental($type);
    CarbonImmutable::setTestNow(CarbonImmutable::parse($clock)->utc());
    config(['telematics.early_start_test_mode' => $enabled]);
    app()->instance('env', $environment);
    $eligibility = app(TelematicsHandoverEligibilityService::class);
    expect($eligibility->testModeEnabled())->toBeFalse()
        ->and($eligibility->isRentalTimeEligible($booking))->toBe($eligible)
        ->and(app(RentalReadinessService::class)->evaluate($booking)['rentalPeriodEligible'])->toBe($eligible)
        ->and($booking->fresh()->rental_start_at->toISOString())->toBe('2026-10-17T12:20:00.000000Z')
        ->and($booking->fresh()->rental_end_at->toISOString())->toBe('2026-10-18T12:20:00.000000Z');
})->with([RentalType::SelfDrive, RentalType::OwnersDriver])->with([
    'same Manila date across UTC midnight' => ['local', true, '2026-10-17T00:30:00+08:00', true],
    'future start date' => ['testing', true, '2026-10-16T23:59:59+08:00', false],
    'at scheduled start' => ['testing', true, '2026-10-17T20:20:00+08:00', true],
    'later within interval' => ['testing', false, '2026-10-18T10:00:00+08:00', true],
    'at return deadline' => ['testing', true, '2026-10-18T20:20:00+08:00', false],
    'expired rental' => ['testing', true, '2026-10-18T20:20:01+08:00', false],
    'timing flag disabled' => ['testing', false, '2026-10-17T00:30:00+08:00', false],
    'production ignores timing flag' => ['production', true, '2026-10-17T00:30:00+08:00', false],
    'staging ignores timing flag' => ['staging', true, '2026-10-17T00:30:00+08:00', false],
]);

it('retains payment age document and inspection requirements when only timing is relaxed', function (RentalType $type) {
    $booking = earlyStartRental($type);
    $booking->update(['payment_status' => PaymentStatus::Unpaid, 'remaining_balance' => 7000]);
    $booking->user->documents()->delete();
    $booking->user->customerProfile->update(['birthdate' => now()->subYears(16)->toDateString()]);
    $state = app(RentalReadinessService::class)->evaluate($booking->fresh());
    expect($state['rentalPeriodEligible'])->toBeTrue()
        ->and($state['fullyPaid'])->toBeFalse()
        ->and($state['ageEligible'])->toBeFalse()
        ->and($state['outgoingFinalized'])->toBeFalse();
    if ($type === RentalType::SelfDrive) {
        expect($state['documentsApproved'])->toBeFalse();
        expect(fn () => app(TelematicsSetupService::class)->startHandover($booking->fresh(), vehicleManagerUser()))
            ->toThrow(ValidationException::class);
    }
    expect(fn () => app(RentalReadinessService::class)->assertStartAllowed($booking->fresh()))
        ->toThrow(ValidationException::class);
})->with([RentalType::SelfDrive, RentalType::OwnersDriver]);

it('allows early inspection and staff handover while still requiring all eleven results', function () {
    $booking = earlyStartRental();
    $manager = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', vehicleManagerUser(), 1300);
    $this->actingAs($manager)->postJson("/admin/bookings/{$booking->id}/telematics-setup/start")
        ->assertOk()->assertJsonPath('data.telematicsHandover.eligibility.testMode', false)
        ->assertJsonPath('data.telematicsHandover.eligibility.rentalPeriodEligible', true);
    Sanctum::actingAs($booking->user);
    $url = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps";
    $this->getJson('/api/mobile/telematics/rentals')->assertOk()
        ->assertJsonPath('data.0.eligibility.canWorkSetup', true)->assertJsonPath('data.0.eligibility.testMode', false);
    $this->postJson("{$url}/phone_mount/attempt", ['evidence' => ['confirmed' => true, 'checked_at' => now()->toISOString()]])
        ->assertUnprocessable();
    $service = app(TelematicsSetupService::class);
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    foreach (array_slice(TelematicsSetupService::requiredSteps(), 0, 6) as $type) {
        $service->recordStep($session, $type, TelematicsSetupStepStatus::Passed);
    }
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")
        ->assertOk()->assertJsonPath('data.setup.status', 'in_progress')
        ->assertJsonPath('data.steps.6.status', 'pending');
    expect(fn () => app(BookingService::class)->transition($booking->fresh(), BookingStatus::Ongoing, $manager))
        ->toThrow(ValidationException::class);
    foreach (array_slice(TelematicsSetupService::requiredSteps(), 6) as $type) {
        postCalibration($booking, $type->value)->assertOk();
    }
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status->value)->toBe('ready_for_release');
    $started = app(BookingService::class)->transition($booking->fresh(), BookingStatus::Ongoing, $manager);
    expect($started->status)->toBe(BookingStatus::Ongoing)
        ->and($started->rental_start_at->toISOString())->toBe('2026-10-17T12:20:00.000000Z')
        ->and($started->rental_end_at->toISOString())->toBe('2026-10-18T12:20:00.000000Z');
});

it('rechecks the deadline after an early handover has started', function () {
    $booking = earlyStartRental();
    finalizeLifecycleInspection($booking, 'outgoing', vehicleManagerUser(), 1300);
    app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser());
    CarbonImmutable::setTestNow(CarbonImmutable::instance($booking->rental_end_at));
    Sanctum::actingAs($booking->user);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/device_check/attempt", [
        'evidence' => ['accelerometer_available' => true, 'gyroscope_available' => true,
            'location_services_available' => true, 'platform' => 'android',
            'build_context' => 'standalone', 'checked_at' => now()->toISOString()],
    ])->assertUnprocessable();
    expect(fn () => app(RentalReadinessService::class)->assertStartAllowed($booking->fresh()))
        ->toThrow(ValidationException::class);
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->steps()->count())->toBe(0);
});

it('allows early assigned-driver inspection and release only after normal readiness is complete', function () {
    $booking = earlyStartRental(RentalType::OwnersDriver);
    $manager = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', vehicleManagerUser(), 1300);
    $this->actingAs($manager)->getJson("/admin/bookings/{$booking->id}")
        ->assertOk()->assertJsonPath('data.readiness.rentalPeriodEligible', true);
    $this->postJson("/admin/bookings/{$booking->id}/start")->assertUnprocessable()->assertJsonValidationErrors('readiness');
    completeTelematicsSetup($booking);
    $this->postJson("/admin/bookings/{$booking->id}/start")->assertOk();
    expect($booking->fresh()->status)->toBe(BookingStatus::Ongoing)
        ->and($booking->fresh()->rental_start_at->toISOString())->toBe('2026-10-17T12:20:00.000000Z');
});
