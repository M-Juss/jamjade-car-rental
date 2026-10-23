<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\Geofence;
use App\Models\TelematicsLocationPoint;
use App\Services\BookingGeofenceService;
use App\Services\BookingReturnService;
use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-18T04:00:00Z'));
});
afterEach(fn () => CarbonImmutable::setTestNow());

function locationMonitoringBooking(array $attributes = []): Booking
{
    $booking = Booking::create([
        'booking_code' => 'BK-GPS-'.Str::upper(Str::random(6)),
        'user_id' => customerUser()->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive, 'rental_start_at' => now()->subHour(), 'rental_end_at' => now()->addDay(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Test garage', 'return_location' => 'Test garage',
        'status' => BookingStatus::Ongoing, 'payment_status' => 'paid', 'price_per_day' => 3500,
        'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500, ...$attributes,
    ]);
    $booking->telematicsSetupSession()->create(['status' => 'released', 'released_at' => now()->subHour()]);

    return $booking;
}

function latestLocationPayload(array $overrides = []): array
{
    return ['latitude' => 14.0, 'longitude' => 121.0, 'accuracy' => 5, 'captured_at' => now()->toISOString(), ...$overrides];
}

function startLocationSharing($test, Booking $booking): string
{
    Sanctum::actingAs($booking->user);

    return $test->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/start", latestLocationPayload([
        'consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground',
    ]))->assertOk()->assertJsonPath('data.tripStatus', 'started')->json('data.sessionToken');
}

it('starts once after consent and only overwrites an encrypted latest position without route history', function () {
    $booking = locationMonitoringBooking();
    $token = startLocationSharing($this, $booking);
    $trip = $booking->telematicsTrips()->sole();
    expect($trip->latest_location)->toBe(['latitude' => 14, 'longitude' => 121, 'accuracy' => 5])
        ->and($trip->current_latitude)->toBeNull()->and($trip->start_latitude)->toBeNull()
        ->and($trip->location_session_hash)->not->toBe($token)
        ->and(DB::table('telematics_trips')->where('id', $trip->id)->value('latest_location'))->not->toContain('latitude');
    CarbonImmutable::setTestNow(now()->addSeconds(5));
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/location", latestLocationPayload([
        'latitude' => 14.001, 'session_token' => $token,
    ]))->assertOk()->assertJsonMissingPath('data.sessionToken')->assertJsonMissingPath('data.latitude');
    expect($trip->fresh()->latest_location['latitude'])->toBe(14.001)
        ->and(TelematicsLocationPoint::count())->toBe(0)
        ->and($trip->events()->whereNotNull('latitude')->exists())->toBeFalse()
        ->and($trip->events()->where('event_type', 'like', 'geofence_%')->exists())->toBeFalse();
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring")
        ->assertOk()->assertJsonMissingPath('data.sessionToken')->assertJsonMissingPath('data.latest_location')
        ->assertJsonPath('data.canMonitor', true)->assertJsonPath('data.policy.consentVersion', 3);
    startLocationSharing($this, $booking);
    expect($booking->telematicsTrips()->count())->toBe(1);
});

it('rotates each sharing session rejects old uploads and pauses without ending the rental', function () {
    $booking = locationMonitoringBooking();
    $old = startLocationSharing($this, $booking);
    $current = startLocationSharing($this, $booking);
    $base = "/api/mobile/bookings/{$booking->booking_code}/location-monitoring";
    $this->postJson($base.'/location', latestLocationPayload(['session_token' => $old]))->assertUnprocessable()->assertJsonValidationErrors('session_token');
    $this->postJson($base.'/pause', ['session_token' => $old])->assertUnprocessable();
    $this->postJson($base.'/pause', ['session_token' => $current])->assertOk()->assertJsonPath('data.tripStatus', 'paused');
    $this->postJson($base.'/location', latestLocationPayload(['session_token' => $current]))->assertUnprocessable();
    expect($booking->fresh()->status)->toBe(BookingStatus::Ongoing);
    startLocationSharing($this, $booking);
    expect($booking->telematicsTrips()->count())->toBe(1)->and($booking->telematicsTrips()->sole()->status)->toBe('started');
});

it('ignores duplicate or older timestamps and clears the point when staff physically receive the vehicle', function () {
    $booking = locationMonitoringBooking();
    $token = startLocationSharing($this, $booking);
    $base = "/api/mobile/bookings/{$booking->booking_code}/location-monitoring";
    $this->postJson($base.'/location', latestLocationPayload(['latitude' => 1, 'captured_at' => now()->subSecond()->toISOString(), 'session_token' => $token]))->assertOk();
    expect($booking->telematicsTrips()->sole()->latest_location['latitude'])->toBe(14);
    app(BookingReturnService::class)->receive($booking, vehicleManagerUser(), now()->toISOString());
    expect($booking->telematicsTrips()->sole()->latest_location)->toBeNull()
        ->and($booking->telematicsTrips()->sole()->status)->toBe('ended');
    $this->getJson($base)->assertOk()->assertJsonPath('data.canMonitor', false);
    $this->postJson($base.'/location', latestLocationPayload(['session_token' => $token]))->assertUnprocessable();
    $this->postJson($base.'/start', latestLocationPayload(['consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground']))->assertUnprocessable();
});

it('clears expired latest points while preserving trip records and recent points', function () {
    $old = locationMonitoringBooking();
    startLocationSharing($this, $old);
    CarbonImmutable::setTestNow(now()->addHours(24));
    $recent = locationMonitoringBooking();
    startLocationSharing($this, $recent);
    $this->artisan('telematics:purge-latest-locations')->assertSuccessful();
    expect($old->telematicsTrips()->sole()->latest_location)->toBeNull()
        ->and($recent->telematicsTrips()->sole()->latest_location)->not->toBeNull();
});

it('requires released ongoing self-drive ownership and does not use the booked deadline to stop overdue sharing', function () {
    $booking = locationMonitoringBooking(['rental_end_at' => now()->subMinute()]);
    startLocationSharing($this, $booking);
    Sanctum::actingAs(customerUser());
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring")->assertNotFound();
    Sanctum::actingAs(createDriverUser());
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring")->assertNotFound();
    Sanctum::actingAs($booking->user);
    $booking->update(['status' => BookingStatus::Confirmed]);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/start", latestLocationPayload(['consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground']))->assertUnprocessable();
    $booking->update(['status' => BookingStatus::Ongoing]);
    $booking->telematicsSetupSession()->update(['status' => 'ready_for_release']);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/start", latestLocationPayload(['consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground']))->assertUnprocessable();
});

it('allows the current assigned Driver to share location and limits the Customer to the shared vehicle view', function () {
    $driver = createDriverUser();
    $booking = locationMonitoringBooking([
        'rental_type' => RentalType::OwnersDriver,
        'assigned_driver_id' => $driver->id, 'driver_assigned_at' => now(),
    ]);
    $base = "/api/mobile/bookings/{$booking->booking_code}/location-monitoring";
    Sanctum::actingAs($driver);
    $token = $this->postJson($base.'/start', latestLocationPayload([
        'consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground',
    ]))->assertOk()->assertJsonPath('data.tripStatus', 'started')->json('data.sessionToken');
    $this->getJson($base)->assertOk()->assertJsonPath('data.canMonitor', true);
    CarbonImmutable::setTestNow(now()->addSeconds(5));
    $fix = latestLocationPayload(['latitude' => 14.001, 'session_token' => $token]);
    $this->postJson($base.'/location', $fix)->assertOk();
    $this->postJson($base.'/pause', ['session_token' => $token])->assertOk()->assertJsonPath('data.tripStatus', 'paused');
    expect($booking->telematicsTrips()->sole()->operator_user_id)->toBe($driver->id);

    Sanctum::actingAs($booking->user);
    $this->getJson("/api/mobile/bookings/{$booking->booking_code}")->assertOk()
        ->assertJsonPath('data.sharedVehicleLocation.latitude', 14.001)
        ->assertJsonMissingPath('data.sharedVehicleLocation.sessionToken');
    foreach ([$booking->user, createDriverUser()] as $other) {
        Sanctum::actingAs($other);
        $this->getJson($base)->assertNotFound();
        $this->postJson($base.'/start', latestLocationPayload([
            'consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground',
        ]))->assertNotFound();
        $this->postJson($base.'/location', $fix)->assertNotFound();
        $this->postJson($base.'/pause', ['session_token' => $token])->assertNotFound();
    }
    expect($booking->telematicsTrips()->count())->toBe(1)
        ->and($booking->telematicsTrips()->sole()->status)->toBe('paused');
});

it('prevents the history and event endpoints from bypassing latest-only consent', function () {
    $booking = locationMonitoringBooking();
    startLocationSharing($this, $booking);
    $trip = $booking->telematicsTrips()->sole();
    $this->postJson("/api/mobile/telematics/trips/{$trip->id}/location", latestLocationPayload())->assertUnprocessable();
    $this->postJson("/api/mobile/telematics/trips/{$trip->id}/events", ['event_type' => 'harsh_braking'])->assertUnprocessable();
    $this->postJson("/api/mobile/telematics/trips/{$trip->id}/resume")->assertUnprocessable();
    expect(TelematicsLocationPoint::count())->toBe(0);
});

it('rejects invalid consent and fixes before saving a location or creating a trip', function (array $overrides, string $field) {
    $booking = locationMonitoringBooking();
    Sanctum::actingAs($booking->user);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/start", latestLocationPayload([
        'consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground', ...$overrides,
    ]))->assertUnprocessable()->assertJsonValidationErrors($field);
    expect($booking->telematicsTrips()->exists())->toBeFalse();
})->with([
    [['consent' => false], 'consent'], [['consent' => null], 'consent'], [['consent_version' => 1], 'consent_version'], [['consent_version' => 2], 'consent_version'],
    [['latitude' => 91], 'latitude'], [['longitude' => -181], 'longitude'],
    [['accuracy' => null], 'accuracy'], [['accuracy' => 51], 'accuracy'], [['accuracy' => -1], 'accuracy'],
    [['captured_at' => 'invalid'], 'captured_at'], [['captured_at' => '2026-10-18T03:58:59Z'], 'captured_at'],
    [['captured_at' => '2026-10-18T04:00:11Z'], 'captured_at'], [['speed' => 10], 'speed'],
]);

it('records the explicit sharing mode without storing location coordinates in consent audit', function (string $mode) {
    $booking = locationMonitoringBooking();
    Sanctum::actingAs($booking->user);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/start", latestLocationPayload([
        'consent' => true, 'consent_version' => 3, 'sharing_mode' => $mode,
    ]))->assertOk();
    $audit = Activity::where('event', 'location_monitoring_consent')->sole();
    expect($audit->properties->all())->toBe(['version' => 3, 'mode' => $mode])
        ->and($booking->telematicsTrips()->sole()->locationPoints()->count())->toBe(0);
})->with(['foreground', 'foreground_background']);

it('requires a valid explicit sharing mode and refuses outdated consent sessions while still allowing them to stop', function () {
    $booking = locationMonitoringBooking();
    Sanctum::actingAs($booking->user);
    foreach ([null, '', 'auto', 'background'] as $mode) {
        $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/start", latestLocationPayload([
            'consent' => true, 'consent_version' => 3, 'sharing_mode' => $mode,
        ]))->assertUnprocessable()->assertJsonValidationErrors('sharing_mode');
    }
    $token = startLocationSharing($this, $booking);
    $booking->telematicsTrips()->sole()->update(['location_consent_version' => 2]);
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/location", latestLocationPayload([
        'session_token' => $token,
    ]))->assertUnprocessable()->assertJsonValidationErrors('consent_version');
    $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/pause", ['session_token' => $token])->assertOk();
});

it('supplies the ordered booking vehicle gallery while keeping returned rentals read only', function () {
    $booking = locationMonitoringBooking();
    $booking->vehicle->images()->first()->update(['image_path' => 'vehicles/first.jpg', 'sort_order' => 0]);
    $booking->vehicle->images()->create(['image_path' => 'vehicles/second.jpg', 'sort_order' => 1]);
    $booking->vehicle->update(['status' => 'rented']);
    Sanctum::actingAs($booking->user);
    $path = "/api/mobile/bookings/{$booking->booking_code}/telematics-setup";
    $response = $this->getJson($path)->assertOk()->assertJsonPath('data.rentalEndAt', $booking->rental_end_at->toISOString());
    expect($response->json('data.vehicle.image'))->toEndWith('/storage/vehicles/first.jpg')
        ->and($response->json('data.vehicle.secondaryImage'))->toEndWith('/storage/vehicles/second.jpg');
    $booking->vehicle->images()->where('sort_order', 1)->delete();
    $fallback = $this->getJson($path)->assertOk();
    expect($fallback->json('data.vehicle.secondaryImage'))->toBe($fallback->json('data.vehicle.image'));

    foreach ([BookingStatus::Returned, BookingStatus::Completed] as $status) {
        $booking->update(['status' => $status]);
        $this->getJson($path)->assertOk()->assertJsonPath('data.eligibility.state', 'rental_ended')
            ->assertJsonPath('data.eligibility.canWorkSetup', false);
        $this->postJson($path.'/steps/device_check/attempt', ['evidence' => [
            'accelerometer_available' => true, 'gyroscope_available' => true,
            'location_services_available' => true, 'platform' => 'android',
            'build_context' => 'standalone', 'checked_at' => now()->toISOString(),
        ]])->assertNotFound();
    }
    Sanctum::actingAs(customerUser());
    $this->getJson($path)->assertNotFound();
});

it('shares one bounded booking activity feed with the normal notification inbox without leaking GPS', function () {
    $booking = locationMonitoringBooking();
    $token = startLocationSharing($this, $booking);
    $other = locationMonitoringBooking(['user_id' => $booking->user_id]);
    app(NotificationService::class)->createForBooking($other, 'trip', 'Other rental', 'Another booking update.');
    for ($index = 0; $index < 12; $index++) {
        app(NotificationService::class)->createForBooking($booking, 'booking', "Booking update {$index}", 'Test update.');
    }
    Sanctum::actingAs($booking->user);
    $path = '/api/mobile/notifications?pagination=cursor&per_page=10&booking_code='.$booking->booking_code;
    $first = $this->getJson($path)->assertOk()->assertJsonCount(10, 'data')
        ->assertJsonPath('meta.booking_unread_count', 13)->assertJsonPath('meta.unread_count', 14);
    expect(collect($first->json('data'))->pluck('bookingId')->unique()->all())->toBe([$booking->booking_code]);
    $older = $this->getJson($path.'&cursor='.urlencode($first->json('meta.next_cursor')))
        ->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.has_more', false);
    $started = collect($older->json('data'))->firstWhere('title', 'GPS monitoring started');
    expect($started)->not->toBeNull()
        ->and($started['data']['action'])->toBe('view_telematics_activity');
    $this->postJson('/api/mobile/notifications/'.$started['id'].'/read')->assertOk()->assertJsonPath('meta.unread_count', 13);
    $this->getJson($path)->assertJsonPath('meta.booking_unread_count', 12);
    $this->getJson('/api/mobile/notifications?category=trip')->assertOk()->assertJsonFragment(['id' => $started['id'], 'isRead' => true]);
    expect(json_encode($started))->not->toContain('latitude', 'longitude', 'session_token', $token);
    Sanctum::actingAs(customerUser());
    $this->getJson($path)->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.booking_unread_count', 0);
});

it('marks only the selected booking activity as read when given a booking code', function () {
    $booking = locationMonitoringBooking();
    $other = locationMonitoringBooking(['user_id' => $booking->user_id]);
    $service = app(NotificationService::class);
    $first = $service->createForBooking($booking, 'trip', 'Trip update', 'The rental started.');
    $second = $service->createForBooking($booking, 'trip', 'Trip paused', 'Monitoring paused.');
    $otherBooking = $service->createForBooking($other, 'trip', 'Other rental', 'Another rental update.');
    $account = $service->createForUser($booking->user, 'system', 'Account update', 'An account update.');
    Sanctum::actingAs($booking->user);

    $this->postJson('/api/mobile/notifications/read-all', ['booking_code' => $booking->booking_code])
        ->assertOk()->assertJsonPath('data.updated', 2)->assertJsonPath('meta.unread_count', 2);

    expect($first->fresh()->read_at)->not->toBeNull()
        ->and($second->fresh()->read_at)->not->toBeNull()
        ->and($otherBooking->fresh()->read_at)->toBeNull()
        ->and($account->fresh()->read_at)->toBeNull();
});

it('notifies only GPS transitions and validates interruption reasons', function () {
    $booking = locationMonitoringBooking();
    $token = startLocationSharing($this, $booking);
    $path = "/api/mobile/bookings/{$booking->booking_code}/location-monitoring";
    $this->postJson($path.'/location', latestLocationPayload(['session_token' => $token]))->assertOk();
    expect($booking->user->notifications()->count())->toBe(1);
    $this->postJson($path.'/pause', ['session_token' => $token, 'reason' => 'unknown'])->assertUnprocessable()->assertJsonValidationErrors('reason');
    $this->postJson($path.'/pause', ['session_token' => $token, 'reason' => 'interrupted'])->assertOk();
    expect($booking->user->notifications()->where('title', 'GPS monitoring interrupted')->count())->toBe(1);
    $this->postJson($path.'/pause', ['session_token' => $token])->assertUnprocessable();
    startLocationSharing($this, $booking);
    expect($booking->user->notifications()->where('title', 'GPS monitoring resumed')->count())->toBe(1);
    app(BookingReturnService::class)->receive($booking, vehicleManagerUser(), now()->toISOString());
    expect($booking->user->notifications()->where('title', 'Rental monitoring ended')->count())->toBe(1);
});

function freezeLocationMonitoringZones(Booking $booking, array $preferences = []): void
{
    Geofence::factory()->create([
        'name' => 'Garage', 'geometry_type' => 'circle', 'center_latitude' => 14,
        'center_longitude' => 121, 'radius_meters' => 500, 'is_active' => true,
        'notify_on_enter' => true, 'notify_on_exit' => true, ...$preferences,
    ]);
    $booking->bookingGeofences()->create([
        'name_snapshot' => 'Town', 'scope' => 'custom', 'geometry_type' => 'polygon', 'assigned_at' => now(),
        'notify_on_enter' => true, 'notify_on_exit' => true,
        'polygon_coordinates' => [
            ['latitude' => 13.99, 'longitude' => 120.99], ['latitude' => 14.01, 'longitude' => 120.99],
            ['latitude' => 14.01, 'longitude' => 121.01], ['latitude' => 13.99, 'longitude' => 121.01],
        ],
    ]);
    app(BookingGeofenceService::class)->freezeForRelease($booking);
}

function sendMonitoringFix($test, Booking $booking, string $token, float $latitude, int $seconds = 5, array $extra = [])
{
    CarbonImmutable::setTestNow(now()->addSeconds($seconds));

    return $test->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/location", latestLocationPayload([
        'session_token' => $token, 'latitude' => $latitude, ...$extra,
    ]));
}

it('evaluates frozen default and custom zones from latest GPS and shares named crossing alerts without route history', function (string $mode) {
    $booking = locationMonitoringBooking();
    freezeLocationMonitoringZones($booking);
    Geofence::firstOrFail()->update(['name' => 'Changed library name', 'is_active' => false, 'notify_on_exit' => false]);
    Geofence::factory()->create(['name' => 'Future rentals only']);
    Sanctum::actingAs($booking->user);
    $token = $this->postJson("/api/mobile/bookings/{$booking->booking_code}/location-monitoring/start", latestLocationPayload([
        'consent' => true, 'consent_version' => 3, 'sharing_mode' => $mode,
    ]))->assertOk()->json('data.sessionToken');
    $trip = $booking->telematicsTrips()->sole();
    expect($trip->geofenceStates()->count())->toBe(2)
        ->and($trip->events()->where('event_type', 'like', 'geofence_%')->count())->toBe(0);

    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(0);
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(2);
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    sendMonitoringFix($this, $booking, $token, 14)->assertOk();
    sendMonitoringFix($this, $booking, $token, 14, 10)->assertOk();
    expect($trip->events()->where('event_type', 'geofence_enter')->count())->toBe(2)
        ->and($trip->locationPoints()->count())->toBe(0)
        ->and($trip->events()->whereNotNull('latitude')->exists())->toBeFalse()
        ->and($trip->fresh()->status)->toBe('started');

    $path = '/api/mobile/notifications?pagination=cursor&per_page=10&booking_code='.$booking->booking_code;
    $feed = $this->getJson($path)->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('meta.booking_unread_count', 5);
    $crossings = collect($feed->json('data'))->filter(fn ($item) => str_starts_with($item['data']['event_type'], 'geofence_'));
    expect($crossings->pluck('message')->all())->toContain('Exited Garage.', 'Entered Garage.', 'Exited Town.', 'Entered Town.');
    foreach ($crossings as $item) {
        expect($item['category'])->toBe('trip')
            ->and($item['data']['action'])->toBe('view_telematics_activity')
            ->and($item['data']['event_id'])->not->toBeNull()
            ->and(json_encode($item))->not->toContain('latitude', 'longitude', 'session_token', $token, 'polygon_coordinates');
    }
    $this->getJson('/api/mobile/notifications?category=trip')->assertOk()->assertJsonCount(5, 'data');
    $this->postJson('/api/mobile/notifications/'.$crossings->first()['id'].'/read')->assertOk();
    Sanctum::actingAs(customerUser());
    $this->getJson($path)->assertOk()->assertJsonCount(0, 'data');
    $this->actingAs(vehicleManagerUser())->getJson("/admin/bookings/{$booking->id}")->assertOk()
        ->assertJsonCount(4, 'data.geofenceActivity')->assertJsonFragment(['zoneName' => 'Garage']);
})->with(['foreground', 'foreground_background']);

it('records crossings regardless of direction preferences but only notifies enabled directions', function (bool $enter, bool $exit) {
    $booking = locationMonitoringBooking();
    $name = str_repeat('Z', 255);
    freezeLocationMonitoringZones($booking, ['name' => $name, 'notify_on_enter' => $enter, 'notify_on_exit' => $exit]);
    $token = startLocationSharing($this, $booking);
    $trip = $booking->telematicsTrips()->sole();
    foreach ([14.006, 14.006, 14, 14] as $latitude) {
        sendMonitoringFix($this, $booking, $token, $latitude, 11)->assertOk();
    }
    $events = $trip->events()->where('event_type', 'like', 'geofence_%')->get();
    $alerts = $booking->user->notifications()->where('data->zone_name', $name)->get();
    expect($events)->toHaveCount(2)->and($alerts)->toHaveCount((int) $enter + (int) $exit)
        ->and($events->firstWhere('event_type', 'geofence_enter')->metadata['notification_requested'])->toBe($enter)
        ->and($events->firstWhere('event_type', 'geofence_exit')->metadata['notification_requested'])->toBe($exit);
    foreach ($alerts as $alert) {
        expect($alert->message)->toContain($name)->and(mb_strlen($alert->title))->toBeLessThanOrEqual(255);
    }
})->with([[true, false], [false, true], [false, false]]);

it('ignores duplicate and older fixes and resets a candidate after an uncertain boundary fix', function () {
    $booking = locationMonitoringBooking();
    freezeLocationMonitoringZones($booking);
    $token = startLocationSharing($this, $booking);
    $trip = $booking->telematicsTrips()->sole();
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    $captured = now()->toISOString();
    sendMonitoringFix($this, $booking, $token, 14.02, 10, ['captured_at' => $captured])->assertOk();
    sendMonitoringFix($this, $booking, $token, 14.02, 1, ['captured_at' => now()->subSeconds(15)->toISOString()])->assertOk();
    expect($trip->geofenceStates()->max('candidate_count'))->toBe(1);
    // Circle boundary, then polygon edge: both must clear their independent candidates.
    sendMonitoringFix($this, $booking, $token, 14 + rad2deg(500 / 6371008.8))->assertOk();
    sendMonitoringFix($this, $booking, $token, 14.01)->assertOk();
    sendMonitoringFix($this, $booking, $token, 14)->assertOk();
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(0);
    sendMonitoringFix($this, $booking, $token, 14.02, 5, ['accuracy' => 51])->assertUnprocessable()->assertJsonValidationErrors('accuracy');
    sendMonitoringFix($this, $booking, $token, 14.02, 5, ['captured_at' => now()->subMinutes(2)->toISOString()])->assertUnprocessable();
    sendMonitoringFix($this, $booking, $token, 14.02, 5, ['current_zone' => 'Claimed'])->assertUnprocessable()->assertJsonValidationErrors('current_zone');
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(2)
        ->and($booking->user->notifications()->where('title', 'Zone exited')->count())->toBe(2);
});

it('starts a fresh baseline on resume without inferring crossings across an unobserved gap', function () {
    $booking = locationMonitoringBooking();
    freezeLocationMonitoringZones($booking);
    $token = startLocationSharing($this, $booking);
    $trip = $booking->telematicsTrips()->sole();
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    $base = "/api/mobile/bookings/{$booking->booking_code}/location-monitoring";
    $this->postJson($base.'/pause', ['session_token' => $token])->assertOk();
    sendMonitoringFix($this, $booking, $token, 14.02, 20)->assertUnprocessable();
    $resumed = $this->postJson($base.'/start', latestLocationPayload([
        'latitude' => 14.02, 'consent' => true, 'consent_version' => 3, 'sharing_mode' => 'foreground',
    ]))->assertOk()->json('data.sessionToken');
    sendMonitoringFix($this, $booking, $resumed, 14.02, 11)->assertOk();
    expect($trip->events()->where('event_type', 'like', 'geofence_%')->count())->toBe(0)
        ->and($trip->geofenceStates()->where('inside', true)->count())->toBe(0);
    sendMonitoringFix($this, $booking, $resumed, 14)->assertOk();
    sendMonitoringFix($this, $booking, $resumed, 14, 11)->assertOk();
    expect($trip->events()->where('event_type', 'geofence_enter')->count())->toBe(2)
        ->and($booking->telematicsTrips()->count())->toBe(1);
});

it('rolls back the point state and crossing when its notification cannot be saved', function () {
    $booking = locationMonitoringBooking();
    freezeLocationMonitoringZones($booking);
    $token = startLocationSharing($this, $booking);
    sendMonitoringFix($this, $booking, $token, 14.02)->assertOk();
    $this->mock(NotificationService::class)->shouldReceive('createForTelematicsParticipants')->once()->andThrow(new RuntimeException('Test notification failure'));
    sendMonitoringFix($this, $booking, $token, 14.02, 11)->assertStatus(500);
    $trip = $booking->telematicsTrips()->sole();
    expect($trip->events()->where('event_type', 'geofence_exit')->count())->toBe(0)
        ->and($trip->geofenceStates()->where('inside', false)->count())->toBe(0)
        ->and($trip->geofenceStates()->max('candidate_count'))->toBe(1)
        ->and($trip->last_location_at->equalTo(now()->subSeconds(11)))->toBeTrue();
});
