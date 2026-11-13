<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
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
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    config(['telematics.handover_test_mode' => true]);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-16T00:30:00+08:00')->utc());
});

afterEach(fn () => CarbonImmutable::setTestNow());

it('ignores the test flag outside local and testing environments', function (string $environment) {
    app()->instance('env', $environment);
    expect(app(TelematicsHandoverEligibilityService::class)->testModeEnabled())->toBeFalse();
    $booking = telematicsFoundationBooking();
    expect(app(TelematicsHandoverEligibilityService::class)->evaluate($booking)['canStartHandover'])->toBeFalse();
    expect(fn () => app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser()))
        ->toThrow(ValidationException::class);
})->with(['production', 'staging']);

it('tests handover and release without fabricating readiness evidence', function () {
    $booking = telematicsFoundationBooking();
    $booking->user->documents()->delete();
    $booking->payments()->delete();
    $booking->update([
        'rental_start_at' => CarbonImmutable::parse('2026-10-16T14:00:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-17T14:00:00+08:00')->utc(),
        'payment_status' => PaymentStatus::Unpaid, 'remaining_balance' => 7000,
    ]);
    $manager = vehicleManagerUser();
    $this->actingAs($manager)->postJson("/admin/bookings/{$booking->id}/telematics-setup/start")
        ->assertOk()->assertJsonPath('data.telematicsHandover.eligibility.testMode', true)
        ->assertJsonPath('data.telematicsHandover.eligibility.documentsVerified', false)
        ->assertJsonPath('data.telematicsHandover.eligibility.rentalPeriodEligible', true)
        ->assertJsonPath('data.telematicsHandover.setup.status', 'in_progress')
        ->assertJsonPath('data.telematicsHandover.eligibility.canWorkSetup', true);
    expect(Activity::query()->where('event', 'telematics_handover_started')->first()->properties['test_mode'])->toBeTrue();

    Sanctum::actingAs($booking->user);
    $url = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps";
    $this->postJson("{$url}/motion_permission/attempt", ['evidence' => [
        'permission_state' => 'denied', 'platform' => 'android', 'checked_at' => now()->toISOString(),
    ]])->assertOk()->assertJsonPath('data.steps.1.status', 'failed');
    $this->postJson("{$url}/phone_mount/attempt", ['evidence' => ['confirmed' => true, 'checked_at' => now()->toISOString()]])
        ->assertOk()->assertJsonPath('data.setup.status', 'ready_for_release')
        ->assertJsonPath('data.eligibility.canWorkSetup', true)->assertJsonPath('data.steps.6.status', 'pending');

    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, $manager);
    expect($started->status)->toBe(BookingStatus::Ongoing)
        ->and($started->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::Released)
        ->and($booking->fresh()->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and($booking->user->documents()->count())->toBe(0)
        ->and($booking->vehicleInspections()->count())->toBe(0)
        ->and($booking->bookingGeofences()->exists())->toBeFalse()
        ->and($booking->telematicsTrips()->count())->toBe(0)
        ->and($started->rental_start_at->toISOString())->toBe('2026-10-16T06:00:00.000000Z')
        ->and($started->rental_end_at->toISOString())->toBe('2026-10-17T06:00:00.000000Z');
    $this->postJson("{$url}/phone_mount/attempt", ['evidence' => ['confirmed' => true, 'checked_at' => now()->toISOString()]])->assertUnprocessable();
});

it('blocks future-date and expired handover setup and release even in test mode', function (string $start, string $end) {
    $booking = telematicsFoundationBooking();
    $booking->update([
        'rental_start_at' => CarbonImmutable::parse($start)->utc(),
        'rental_end_at' => CarbonImmutable::parse($end)->utc(),
    ]);
    $eligibility = app(TelematicsHandoverEligibilityService::class);
    $state = $eligibility->evaluate($booking);
    expect(app(RentalReadinessService::class)->evaluate($booking)['rentalPeriodEligible'])->toBeFalse()
        ->and($state['rentalPeriodEligible'])->toBeFalse()
        ->and($state['canStartHandover'])->toBeFalse()
        ->and($state['canWorkSetup'])->toBeFalse()
        ->and($state['state'])->toBe('rental_scheduled');
    expect(fn () => app(TelematicsSetupService::class)->startHandover($booking, vehicleManagerUser()))->toThrow(ValidationException::class);
    expect(fn () => $eligibility->assertCanWorkSetup($booking))->toThrow(ValidationException::class);
    expect(fn () => app(RentalReadinessService::class)->assertStartAllowed($booking))->toThrow(ValidationException::class);
})->with([
    'tomorrow in Manila' => ['2026-10-17T00:00:00+08:00', '2026-10-18T00:00:00+08:00'],
    'exact return deadline' => ['2026-10-15T00:30:00+08:00', '2026-10-16T00:30:00+08:00'],
]);

it('keeps later booked days available and disables early starts outside test mode', function () {
    $booking = telematicsFoundationBooking();
    $booking->update(['rental_start_at' => now()->subDay(), 'rental_end_at' => now()->addDay()]);
    $eligibility = app(TelematicsHandoverEligibilityService::class);
    expect($eligibility->evaluate($booking)['canStartHandover'])->toBeTrue();
    $booking->update(['rental_start_at' => CarbonImmutable::parse('2026-10-16T14:00:00+08:00')->utc()]);
    expect(app(RentalReadinessService::class)->evaluate($booking)['rentalPeriodEligible'])->toBeTrue();
    config(['telematics.handover_test_mode' => false]);
    expect($eligibility->evaluate($booking)['rentalPeriodEligible'])->toBeTrue();
    expect(fn () => app(RentalReadinessService::class)->assertStartAllowed($booking))->toThrow(ValidationException::class);
    app()->instance('env', 'production');
    config(['telematics.handover_test_mode' => true]);
    expect($eligibility->evaluate($booking)['rentalPeriodEligible'])->toBeTrue();
    expect(fn () => app(RentalReadinessService::class)->assertStartAllowed($booking))->toThrow(ValidationException::class);
});

it('rechecks the return deadline for mobile attempts and staff release after test handover starts', function () {
    $booking = telematicsFoundationBooking();
    $service = app(TelematicsSetupService::class);
    $service->startHandover($booking, vehicleManagerUser());
    $service->recordMobileAttempt($booking, 'phone_mount', ['confirmed' => true, 'checked_at' => now()->toISOString()], $booking->user);
    CarbonImmutable::setTestNow(CarbonImmutable::instance($booking->rental_end_at));
    Sanctum::actingAs($booking->user);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps/phone_mount/attempt", [
        'evidence' => ['confirmed' => true, 'checked_at' => now()->toISOString()],
    ])->assertUnprocessable();
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser()))->toThrow(ValidationException::class);
    expect($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($booking->telematicsSetupSession->steps()->where('step_type', 'phone_mount')->count())->toBe(1);
});

it('permits retries before release and revokes readiness after a failed mount retry', function () {
    $booking = telematicsFoundationBooking();
    $service = app(TelematicsSetupService::class);
    $service->startHandover($booking, vehicleManagerUser());
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    $service->recordMobileAttempt($booking, 'phone_mount', ['confirmed' => true, 'checked_at' => now()->toISOString()], $booking->user);
    $service->recordMobileAttempt($booking, 'motion_permission', [
        'permission_state' => 'denied', 'platform' => 'ios', 'checked_at' => now()->toISOString(),
    ], $booking->user);
    expect($session->fresh()->status)->toBe(TelematicsSetupStatus::ReadyForRelease);
    $service->recordMobileAttempt($booking, 'phone_mount', ['confirmed' => false, 'checked_at' => now()->toISOString()], $booking->user);
    expect($session->fresh()->status)->toBe(TelematicsSetupStatus::InProgress)
        ->and($session->steps()->where('step_type', 'phone_mount')->count())->toBe(2);
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser()))->toThrow(ValidationException::class);
});

it('restores strict release checks when test mode is disabled', function () {
    $booking = telematicsFoundationBooking();
    $service = app(TelematicsSetupService::class);
    $service->startHandover($booking, vehicleManagerUser());
    $service->recordMobileAttempt($booking, 'phone_mount', ['confirmed' => true, 'checked_at' => now()->toISOString()], $booking->user);
    config(['telematics.handover_test_mode' => false]);
    expect(app(RentalReadinessService::class)->evaluate($booking->fresh())['telematicsSetupReady'])->toBeFalse();
    expect(fn () => app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser()))->toThrow(ValidationException::class);
});

it('retains self-drive confirmation ownership staff permissions and evidence validation', function () {
    $service = app(TelematicsSetupService::class);
    $manager = vehicleManagerUser();
    expect(fn () => $service->startHandover(telematicsFoundationBooking(RentalType::OwnersDriver), $manager))->toThrow(ValidationException::class);
    $pending = telematicsFoundationBooking();
    $pending->update(['status' => BookingStatus::Pending]);
    expect(fn () => $service->startHandover($pending, $manager))->toThrow(ValidationException::class);
    $booking = telematicsFoundationBooking();
    $this->actingAs($booking->user)->postJson("/admin/bookings/{$booking->id}/telematics-setup/start")->assertForbidden();
    $service->startHandover($booking, $manager);
    expect(fn () => $service->startHandover($booking, $manager))->toThrow(ValidationException::class);
    $url = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup/steps";
    Sanctum::actingAs(customerUser());
    $this->postJson("{$url}/phone_mount/attempt", ['evidence' => ['confirmed' => true, 'checked_at' => now()->toISOString()]])->assertNotFound();
    Sanctum::actingAs($booking->user);
    $this->postJson("{$url}/phone_mount/attempt", ['status' => 'passed', 'evidence' => []])->assertUnprocessable();
    $this->postJson("{$url}/stationary_calibration/attempt", ['evidence' => ['confirmed' => true]])->assertUnprocessable();
});
