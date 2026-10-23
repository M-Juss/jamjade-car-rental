<?php

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsSetupStatus;
use App\Enums\VehicleStatus;
use App\Models\Notification;
use App\Services\TelematicsSetupService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
    config(['telematics.handover_test_mode' => false, 'telematics.early_start_test_mode' => false]);
});

afterEach(fn () => CarbonImmutable::setTestNow());

function combinedOutgoingPayload(): array
{
    return ['condition' => vehicleConditionPayload(['odometer' => 1300]), 'operator_signature_data' => vehicleSignatureDataUrl()];
}

it('finalizes outgoing and unlocks renter setup together without releasing the vehicle or fabricating checks', function () {
    $booking = lifecycleBooking();
    $baseline = $booking->vehicle->current_condition_inspection_id;
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())
        ->assertCreated()->assertJsonPath('data.status', 'finalized');
    $inspection = $booking->vehicleInspections()->where('type', 'outgoing')->sole();
    $session = $booking->fresh('telematicsSetupSession')->telematicsSetupSession;
    expect($inspection->signatures()->count())->toBe(2)
        ->and($session->status)->toBe(TelematicsSetupStatus::InProgress)
        ->and($session->started_at)->not->toBeNull()
        ->and($session->ready_at)->toBeNull()
        ->and($session->steps()->count())->toBe(0)
        ->and($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($booking->vehicle->fresh()->status)->toBe(VehicleStatus::Available)
        ->and($booking->vehicle->fresh()->current_condition_inspection_id)->toBe($baseline)
        ->and($booking->telematicsTrips()->exists())->toBeFalse()
        ->and(DB::table('activity_log')->where('event', 'telematics_handover_started')->count())->toBe(1)
        ->and(Notification::where('booking_id', $booking->id)->where('title', 'Vehicle setup available')->count())->toBe(1)
        ->and(Notification::where('booking_id', $booking->id)->where('title', 'Telematics handover required')->count())->toBe(0);
    $this->postJson("/admin/bookings/{$booking->id}/start")->assertUnprocessable();
    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")
        ->assertOk()->assertJsonPath('data.setup.status', 'in_progress')
        ->assertJsonPath('data.eligibility.canWorkSetup', true)->assertJsonPath('data.canStartTrip', false);
});

it('rolls back inspection handover audit and new signatures if handover fails', function () {
    $booking = lifecycleBooking();
    $files = Storage::disk('local')->allFiles();
    $realSetup = app(TelematicsSetupService::class);
    $this->partialMock(TelematicsSetupService::class, function ($mock) use ($realSetup) {
        $mock->shouldReceive('startHandover')->once()->andReturnUsing(function ($booking, $actor) use ($realSetup) {
            $realSetup->startHandover($booking, $actor);
            throw ValidationException::withMessages(['telematics_setup' => ['Simulated handover failure.']]);
        });
    });
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())
        ->assertUnprocessable()->assertJsonValidationErrors('telematics_setup');
    expect($booking->vehicleInspections()->exists())->toBeFalse()
        ->and($booking->telematicsSetupSession()->exists())->toBeFalse()
        ->and($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and(Storage::disk('local')->allFiles())->toBe($files)
        ->and(DB::table('activity_log')->whereIn('event', ['telematics_handover_started', 'booking_outgoing_inspection_finalized'])->count())->toBe(0)
        ->and(Notification::where('booking_id', $booking->id)->exists())->toBeFalse();
});

it('cleans the personnel signature when the operator PNG is rejected', function () {
    $booking = lifecycleBooking();
    $files = Storage::disk('local')->allFiles();
    $payload = combinedOutgoingPayload();
    $payload['operator_signature_data'] = 'data:image/png;base64,'.base64_encode('not a PNG');
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", $payload)
        ->assertUnprocessable()->assertJsonValidationErrors('operator_signature_data');
    expect(Storage::disk('local')->allFiles())->toBe($files)
        ->and($booking->vehicleInspections()->exists())->toBeFalse()
        ->and($booking->telematicsSetupSession()->exists())->toBeFalse();
});

it('preserves every combined inspection and handover prerequisite', function (string $missing) {
    $booking = lifecycleBooking();
    match ($missing) {
        'payment' => $booking->update(['payment_status' => PaymentStatus::Unpaid]),
        'documents' => $booking->user->documents()->delete(),
        'booking status' => $booking->update(['status' => BookingStatus::Pending]),
        'future date' => $booking->update(['rental_start_at' => now()->addDay(), 'rental_end_at' => now()->addDays(2)]),
        'return deadline' => $booking->update(['rental_start_at' => now()->subDay(), 'rental_end_at' => now()]),
        'vehicle' => $booking->vehicle->update(['status' => VehicleStatus::Unavailable]),
        'customer availability' => lifecycleBooking(attributes: ['user_id' => $booking->user_id, 'status' => BookingStatus::Ongoing]),
    };
    $files = Storage::disk('local')->allFiles();
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())
        ->assertUnprocessable();
    expect($booking->vehicleInspections()->exists())->toBeFalse()
        ->and($booking->telematicsSetupSession()->exists())->toBeFalse()
        ->and(Storage::disk('local')->allFiles())->toBe($files);
})->with(['payment', 'documents', 'booking status', 'future date', 'return deadline', 'vehicle', 'customer availability']);

it('rejects callers without booking-management permission', function (string $role) {
    $booking = lifecycleBooking();
    $actor = $role === 'customer' ? $booking->user : createDriverUser();
    $this->actingAs($actor)->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())
        ->assertForbidden();
    expect($booking->vehicleInspections()->exists())->toBeFalse()
        ->and($booking->telematicsSetupSession()->exists())->toBeFalse();
})->with(['customer', 'driver']);

it('starts assigned-driver setup with the signed Driver inspection through the combined endpoint', function () {
    $booking = lifecycleBooking(RentalType::OwnersDriver);
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())
        ->assertCreated()->assertJsonPath('data.status', 'finalized');
    $inspection = $booking->vehicleInspections()->sole();
    expect($inspection->signatures()->where('signer_type', 'driver')->sole()->user_id)->toBe($booking->assignedDriver->id)
        ->and($inspection->signatures()->where('signer_type', 'renter')->exists())->toBeFalse()
        ->and($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::InProgress)
        ->and($booking->fresh()->status)->toBe(BookingStatus::Confirmed)
        ->and($booking->telematicsTrips()->exists())->toBeFalse();
    Sanctum::actingAs($booking->assignedDriver);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/telematics-setup")
        ->assertOk()->assertJsonPath('data.setup.status', 'in_progress')
        ->assertJsonPath('data.eligibility.canWorkSetup', true);
});

it('does not duplicate immutable inspection signatures or handover events on a repeated submission', function () {
    $booking = lifecycleBooking();
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())->assertCreated();
    $inspection = $booking->vehicleInspections()->sole();
    $original = $inspection->getAttributes();
    $startedAt = $booking->fresh('telematicsSetupSession')->telematicsSetupSession->started_at->toISOString();
    $files = Storage::disk('local')->allFiles();
    $this->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())
        ->assertUnprocessable()->assertJsonValidationErrors('inspection');
    expect($inspection->fresh()->getAttributes())->toBe($original)
        ->and($booking->vehicleInspections()->count())->toBe(1)
        ->and($inspection->signatures()->count())->toBe(2)
        ->and($booking->fresh('telematicsSetupSession')->telematicsSetupSession->started_at->toISOString())->toBe($startedAt)
        ->and(Storage::disk('local')->allFiles())->toBe($files)
        ->and(DB::table('activity_log')->where('event', 'telematics_handover_started')->count())->toBe(1);
});

it('continues an already saved inspection without replacing its signed snapshot', function () {
    $booking = lifecycleBooking();
    $manager = vehicleManagerUser();
    finalizeLifecycleInspection($booking, 'outgoing', $manager, 1300);
    $inspection = $booking->vehicleInspections()->sole();
    $original = $inspection->getAttributes();
    $files = Storage::disk('local')->allFiles();
    $this->actingAs($manager)->postJson("/admin/bookings/{$booking->id}/telematics-setup/start")->assertOk();
    expect($inspection->fresh()->getAttributes())->toBe($original)
        ->and($booking->vehicleInspections()->count())->toBe(1)
        ->and(Storage::disk('local')->allFiles())->toBe($files)
        ->and($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::InProgress);
});

it('supports the current same-day early-arrival allowance for combined preparation', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-18T02:20:00+08:00')->utc());
    config(['telematics.early_start_test_mode' => true]);
    $booking = lifecycleBooking(attributes: [
        'rental_start_at' => CarbonImmutable::parse('2026-10-18T10:20:00+08:00')->utc(),
        'rental_end_at' => CarbonImmutable::parse('2026-10-19T10:20:00+08:00')->utc(),
    ]);
    $this->actingAs(vehicleManagerUser())->postJson("/admin/bookings/{$booking->id}/outgoing-inspection-handover", combinedOutgoingPayload())->assertCreated();
    expect($booking->fresh('telematicsSetupSession')->telematicsSetupSession->status)->toBe(TelematicsSetupStatus::InProgress)
        ->and($booking->fresh()->rental_start_at->toISOString())->toBe('2026-10-18T02:20:00.000000Z')
        ->and($booking->fresh()->rental_end_at->toISOString())->toBe('2026-10-19T02:20:00.000000Z');
});
