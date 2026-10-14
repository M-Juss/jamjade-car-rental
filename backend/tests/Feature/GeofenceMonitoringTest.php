<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\TelematicsEventType;
use App\Models\Booking;
use App\Models\Geofence;
use App\Models\User;
use App\Services\BookingGeofenceService;
use App\Services\BookingService;
use App\Services\TelematicsService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Storage::fake('local');
});

function monitoringZonePayload(array $overrides = []): array
{
    return [...[
        'name' => 'Office', 'geometry_type' => 'circle', 'center_latitude' => 14.299,
        'center_longitude' => 120.958, 'radius_meters' => 1000, 'notify_on_enter' => true, 'notify_on_exit' => true,
    ], ...$overrides];
}

function monitoringAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

function releasedMonitoringBooking(): Booking
{
    $booking = telematicsFoundationBooking();
    finalizeFoundationOutgoing($booking);
    readyFoundationSetup($booking);

    return app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser());
}

it('automatically previews defaults and freezes multiple defaults plus custom zones only at release', function () {
    $default = Geofence::factory()->create(monitoringZonePayload());
    Geofence::factory()->create(monitoringZonePayload(['name' => 'Region', 'radius_meters' => 5000]));
    Geofence::factory()->create(['is_active' => false]);
    $booking = telematicsFoundationBooking();
    $zones = app(BookingGeofenceService::class);
    $custom = $zones->saveCustom($booking, monitoringZonePayload(['name' => 'Destination']), monitoringAdmin());
    $custom = $zones->saveCustom($booking, monitoringZonePayload(['name' => 'Destination', 'radius_meters' => 1500]), monitoringAdmin(), $custom);
    expect($booking->bookingGeofences()->count())->toBe(1)->and($zones->zonesFor($booking))->toHaveCount(3);
    finalizeFoundationOutgoing($booking);
    readyFoundationSetup($booking);
    $started = app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser());
    expect($started->bookingGeofences()->count())->toBe(3)
        ->and($started->bookingGeofences()->whereNull('frozen_at')->count())->toBe(0);
    $default->update(['name' => 'Edited office', 'radius_meters' => 9999, 'notify_on_exit' => false]);
    $default->delete();
    expect($zones->zonesFor($started)->pluck('name_snapshot')->all())->toContain('Office', 'Region', 'Destination')
        ->and($started->bookingGeofences()->where('source_geofence_id', $default->id)->first()->radius_meters)->toBe('1000.00')
        ->and(fn () => $custom->fresh()->update(['name_snapshot' => 'Changed']))->toThrow(LogicException::class)
        ->and(fn () => $zones->saveCustom($started, monitoringZonePayload(), monitoringAdmin()))->toThrow(ValidationException::class);
});

it('allows rentals without any zones and snapshots defaults only for future rentals', function () {
    $first = releasedMonitoringBooking();
    $default = Geofence::factory()->create(monitoringZonePayload());
    expect(app(BookingGeofenceService::class)->zonesFor($first))->toHaveCount(0);
    $second = releasedMonitoringBooking();
    expect($second->bookingGeofences()->pluck('source_geofence_id')->all())->toBe([$default->id]);
});

it('restricts website mutations to Admin while Staff can read default and booking zones', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $admin = monitoringAdmin();
    $booking = telematicsFoundationBooking();
    $this->actingAs($admin)->postJson('/admin/geofences', monitoringZonePayload())->assertCreated();
    $default = Geofence::firstOrFail();
    $this->actingAs($staff)->getJson('/admin/geofences')->assertOk();
    $this->getJson("/admin/bookings/{$booking->id}")->assertOk()->assertJsonPath('data.canManageMonitoringZones', false);
    $this->postJson('/admin/geofences', monitoringZonePayload())->assertForbidden();
    $this->putJson("/admin/geofences/{$default->id}", monitoringZonePayload())->assertForbidden();
    $this->postJson("/admin/geofences/{$default->id}/deactivate")->assertForbidden();
    $this->deleteJson("/admin/geofences/{$default->id}")->assertForbidden();
    $this->postJson("/admin/bookings/{$booking->id}/monitoring-zones", monitoringZonePayload())->assertForbidden();
    $this->actingAs($admin)->postJson("/admin/bookings/{$booking->id}/monitoring-zones", monitoringZonePayload())->assertCreated();
    $zone = $booking->bookingGeofences()->firstOrFail();
    $other = telematicsFoundationBooking();
    $this->putJson("/admin/bookings/{$other->id}/monitoring-zones/{$zone->id}", monitoringZonePayload())->assertNotFound();
    $this->putJson("/admin/bookings/{$booking->id}/monitoring-zones/{$zone->id}", monitoringZonePayload(['name' => 'Updated']))->assertOk();
    $this->deleteJson("/admin/bookings/{$booking->id}/monitoring-zones/{$zone->id}")->assertOk();
    expect($booking->bookingGeofences()->count())->toBe(0);
});

it('validates circle polygon and notification contracts and rejects non-self-drive custom zones', function () {
    $admin = monitoringAdmin();
    $this->actingAs($admin)->postJson('/admin/geofences', monitoringZonePayload(['radius_meters' => 0]))->assertUnprocessable();
    $this->postJson('/admin/geofences', monitoringZonePayload(['notify_on_enter' => null]))->assertUnprocessable();
    $this->postJson('/admin/geofences', monitoringZonePayload([
        'geometry_type' => 'polygon', 'center_latitude' => null, 'center_longitude' => null, 'radius_meters' => null,
        'polygon_coordinates' => [['latitude' => 14.2, 'longitude' => 120.9], ['latitude' => 14.4, 'longitude' => 120.9], ['latitude' => 14.3, 'longitude' => 121.1]],
    ]))->assertCreated();
    $ownerDriver = telematicsFoundationBooking(RentalType::OwnersDriver);
    $this->postJson("/admin/bookings/{$ownerDriver->id}/monitoring-zones", monitoringZonePayload())->assertUnprocessable();
});

it('records confirmed entry and exit independently for overlapping zones without stopping outside tracking', function () {
    Geofence::factory()->create(monitoringZonePayload(['notify_on_enter' => false]));
    Geofence::factory()->create(monitoringZonePayload(['name' => 'Outer region', 'radius_meters' => 5000, 'notify_on_exit' => false]));
    $booking = releasedMonitoringBooking();
    $service = app(TelematicsService::class);
    $trip = $service->startTrip($booking->user, ['booking_id' => $booking->id, 'latitude' => 14.299, 'longitude' => 120.958]);
    $send = function (float $latitude) use ($service, $trip, $booking) {
        $this->travel(11)->seconds();

        return $service->storeLocation($trip, ['latitude' => $latitude, 'longitude' => 120.958, 'accuracy' => 5, 'captured_at' => now()], $booking->user);
    };
    $send(14.299); // initial state creates no crossing
    expect($trip->events()->whereIn('event_type', ['geofence_enter', 'geofence_exit'])->count())->toBe(0);
    $send(14.32); // outside office, still inside outer region
    $send(14.32);
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(1);
    $send(14.299);
    $send(14.299);
    $entry = $trip->events()->where('event_type', 'geofence_enter')->firstOrFail();
    expect($entry->metadata['notification_requested'])->toBeFalse();
    $send(14.40);
    $send(14.40);
    $send(14.40); // unchanged does not repeat alerts
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(3)
        ->and($trip->fresh()->status)->toBe('started')
        ->and($trip->locationPoints()->count())->toBe(8);
    $this->actingAs(monitoringAdmin())->getJson("/admin/bookings/{$booking->id}")->assertOk()
        ->assertJsonCount(4, 'data.geofenceActivity');
});

it('does not infer crossings from duplicate out-of-order poor inaccurate or boundary fixes', function () {
    Geofence::factory()->create(monitoringZonePayload());
    $booking = releasedMonitoringBooking();
    $service = app(TelematicsService::class);
    $trip = $service->startTrip($booking->user, ['booking_id' => $booking->id, 'latitude' => 14.299, 'longitude' => 120.958]);
    $send = function (float $latitude, ?float $accuracy = 5, $captured = null) use ($service, $trip, $booking) {
        $this->travel(11)->seconds();

        return $service->storeLocation($trip, ['latitude' => $latitude, 'longitude' => 120.958, 'accuracy' => $accuracy, 'captured_at' => $captured ?? now()], $booking->user);
    };
    $send(14.299);
    $send(14.32);
    $duplicate = $trip->locationPoints()->latest('captured_at')->firstOrFail()->captured_at;
    $send(14.32, 5, $duplicate);
    $send(14.32, 5, $duplicate->copy()->subSecond());
    expect($trip->events()->count())->toBe(1)
        ->and($trip->fresh()->last_location_at->equalTo($duplicate))->toBeTrue();
    $send(14.32, 100);
    $send(14.32, null);
    $send(14.299 + rad2deg(1000 / 6371008.8));
    $send(14.32, 5, now()->subMinutes(2));
    expect($trip->events()->count())->toBe(1)
        ->and($trip->geofenceStates()->firstOrFail()->uncertain)->toBeTrue();
    $send(14.32);
    $send(14.32);
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(1);
});

it('rejects client-claimed geofence events and zone labels', function () {
    $booking = releasedMonitoringBooking();
    $service = app(TelematicsService::class);
    $trip = $service->startTrip($booking->user, ['booking_id' => $booking->id, 'latitude' => 14.299, 'longitude' => 120.958]);
    expect(fn () => $service->storeEvent($trip, ['event_type' => TelematicsEventType::GeofenceEnter->value], $booking->user))->toThrow(ValidationException::class);
    Sanctum::actingAs($booking->user);
    $this->postJson("/api/mobile/telematics/trips/{$trip->id}/events", ['event_type' => 'geofence_enter'])->assertUnprocessable();
    $this->postJson("/api/mobile/telematics/trips/{$trip->id}/location", [
        'latitude' => 14.299, 'longitude' => 120.958, 'captured_at' => now()->toISOString(), 'current_zone' => 'Claimed zone',
    ])->assertUnprocessable();
    $this->postJson("/api/mobile/telematics/trips/{$trip->id}/location", [
        'latitude' => 14.299, 'longitude' => 120.958, 'captured_at' => now()->addMinutes(2)->toISOString(),
    ])->assertUnprocessable();
});

it('evaluates polygon membership and treats an edge as uncertain without creating false crossings', function () {
    Geofence::factory()->create(monitoringZonePayload([
        'geometry_type' => 'polygon', 'center_latitude' => null, 'center_longitude' => null, 'radius_meters' => null,
        'polygon_coordinates' => [
            ['latitude' => 14.29, 'longitude' => 120.95], ['latitude' => 14.31, 'longitude' => 120.95],
            ['latitude' => 14.31, 'longitude' => 120.97], ['latitude' => 14.29, 'longitude' => 120.97],
        ],
    ]));
    $booking = releasedMonitoringBooking();
    $service = app(TelematicsService::class);
    $trip = $service->startTrip($booking->user, ['booking_id' => $booking->id, 'latitude' => 14.299, 'longitude' => 120.958]);
    foreach ([14.299, 14.31, 14.32, 14.32] as $latitude) {
        $this->travel(11)->seconds();
        $service->storeLocation($trip, ['latitude' => $latitude, 'longitude' => 120.958, 'accuracy' => 5, 'captured_at' => now()], $booking->user);
    }
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(1)
        ->and($trip->geofenceStates()->firstOrFail()->inside)->toBeFalse();
});

it('keeps released zone edits and deletions denied through the website APIs', function () {
    $admin = monitoringAdmin();
    $booking = telematicsFoundationBooking();
    $zone = app(BookingGeofenceService::class)->saveCustom($booking, monitoringZonePayload(), $admin);
    finalizeFoundationOutgoing($booking);
    readyFoundationSetup($booking);
    app(BookingService::class)->transition($booking, BookingStatus::Ongoing, vehicleManagerUser());
    $this->actingAs($admin)->putJson("/admin/bookings/{$booking->id}/monitoring-zones/{$zone->id}", monitoringZonePayload())->assertUnprocessable();
    $this->deleteJson("/admin/bookings/{$booking->id}/monitoring-zones/{$zone->id}")->assertUnprocessable();
    $this->postJson("/admin/bookings/{$booking->id}/monitoring-zones", monitoringZonePayload())->assertUnprocessable();
});
