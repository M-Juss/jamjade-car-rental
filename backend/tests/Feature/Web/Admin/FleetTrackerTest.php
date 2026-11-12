<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Events\FleetMonitoringChanged;
use App\Models\Booking;
use App\Models\DriveMonitoringEvent;
use App\Models\DriveMonitoringSession;
use App\Models\TelematicsTrip;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-18T04:00:00Z'));
    config(['telematics.fleet_location_recent_seconds' => 120]);
});

afterEach(fn () => CarbonImmutable::setTestNow());

function fleetBooking(array $attributes = [], bool $released = true): Booking
{
    if (($attributes['rental_type'] ?? RentalType::SelfDrive) === RentalType::OwnersDriver) {
        $attributes['assigned_driver_id'] ??= createDriverUser()->id;
        $attributes['driver_assigned_at'] ??= now();
    }
    $booking = Booking::create(array_merge([
        'booking_code' => 'BK-FLEET-'.Str::upper(Str::random(8)),
        'user_id' => User::factory()->create()->id,
        'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->subDay(), 'rental_end_at' => now()->addDay(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Test garage', 'return_location' => 'Test garage',
        'status' => BookingStatus::Ongoing, 'payment_status' => 'paid',
        'price_per_day' => 3500, 'duration_days' => 2, 'subtotal' => 7000,
        'total_amount' => 7000, 'remaining_balance' => 0,
    ], $attributes));
    if ($released && $booking->status === BookingStatus::Ongoing) {
        $booking->telematicsSetupSession()->create(['status' => 'released', 'released_at' => now()->subHour()]);
    }

    return $booking;
}

function fleetTrip(Booking $booking, array $attributes = []): TelematicsTrip
{
    return $booking->telematicsTrips()->create(array_merge([
        'operator_user_id' => $booking->rental_type === RentalType::SelfDrive ? $booking->user_id : $booking->assignedDriver->id,
        'status' => 'started', 'started_at' => now()->subHour(),
    ], $attributes));
}

it('lists ongoing bookings once including overdue and untracked rentals while excluding other lifecycle states', function () {
    $untracked = fleetBooking();
    $overdue = fleetBooking(['rental_end_at' => now()->subHour()]);
    $assigned = fleetBooking(['rental_type' => RentalType::OwnersDriver], released: false);
    foreach (BookingStatus::cases() as $status) {
        if ($status !== BookingStatus::Ongoing) {
            fleetBooking(['status' => $status]);
        }
    }
    fleetBooking()->delete();

    $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker')
        ->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.total', 3)
        ->assertJsonPath('meta.total_ongoing', 3)->assertJsonPath('data.0.id', $overdue->id)
        ->assertJsonPath('data.0.tracking.status', 'not_started')
        ->assertJsonPath('data.1.id', $untracked->id)->assertJsonPath('data.2.id', $assigned->id)
        ->assertJsonPath('data.2.tracking.status', 'unavailable');
});

it('keeps one card per booking with the saved trip status and exposes only the fleet read contract', function () {
    $booking = fleetBooking();
    fleetTrip($booking, [
        'status' => 'paused', 'last_location_at' => now()->subMinute(),
        'current_latitude' => 14.0, 'current_longitude' => 121.0, 'current_speed' => 12,
        'battery_percent' => 80,
    ]);
    $response = $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker?status=paused')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.tracking.status', 'paused')
        ->assertJsonPath('data.0.tracking.tripStatus', 'paused')
        ->assertJsonPath('data.0.customerName', $booking->user->name);
    expect(array_keys($response->json('data.0')))->toBe([
        'id', 'bookingCode', 'customerName', 'operator', 'emergencyContacts', 'geofenceActivity', 'rentalType', 'rentalStartAt', 'rentalEndAt', 'vehicle', 'activityCounts', 'tracking',
    ])->and(array_keys($response->json('data.0.vehicle')))->toBe(['id', 'name', 'brand', 'model', 'plateNumber'])
        ->and(array_keys($response->json('data.0.operator')))->toBe(['id', 'name', 'email', 'phoneNumber'])
        ->and(array_keys($response->json('data.0.tracking')))->toBe(['status', 'tripStatus', 'lastLocationAt', 'location'])
        ->and($response->json('data.0.tracking.location'))->toBeNull()
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');
    $this->getJson('/admin/fleet-tracker?status=ended')->assertOk()->assertJsonCount(0, 'data');
});

it('keeps tracking filters consistent with displayed status including the freshness boundary', function (RentalType $type) {
    $expected = [];
    $expected['not_started'] = [fleetBooking(['rental_type' => $type])->id];
    foreach ([
        ['awaiting_location', ['last_location_at' => null]],
        ['recent_location', ['last_location_at' => now()]],
        ['recent_location', ['last_location_at' => now()->subSeconds(120)]],
        ['no_recent_updates', ['last_location_at' => now()->subSeconds(121)]],
        ['paused', ['status' => 'paused', 'last_location_at' => now()]],
        ['ended', ['status' => 'ended', 'last_location_at' => now()]],
    ] as [$status, $attributes]) {
        $booking = fleetBooking(['rental_type' => $type]);
        fleetTrip($booking, $attributes);
        $expected[$status][] = $booking->id;
    }
    $unreleased = fleetBooking(['rental_type' => $type], released: false);
    $expected['unavailable'] = [$unreleased->id];

    $this->actingAs(vehicleManagerUser());
    foreach ($expected as $status => $ids) {
        $response = $this->getJson('/admin/fleet-tracker?status='.$status)->assertOk()
            ->assertJsonPath('meta.total', count($ids))->assertJsonPath('meta.total_ongoing', 8);
        expect(array_column($response->json('data'), 'id'))->toBe($ids);
        foreach ($response->json('data') as $rental) {
            expect($rental['tracking']['status'])->toBe($status);
            if ($status === 'unavailable') {
                expect($rental['tracking']['tripStatus'])->toBeNull()->and($rental['tracking']['lastLocationAt'])->toBeNull();
            }
        }
    }
})->with([RentalType::SelfDrive, RentalType::OwnersDriver]);

it('searches server side and combines rental type status and bounded pagination without changing the ongoing count', function () {
    $customer = customerUser(['name' => 'Fleet Sample']);
    $vehicle = availableVehicle(['name' => 'Fleet Vehicle', 'plate_number' => 'TST-FLEET']);
    $booking = fleetBooking(['user_id' => $customer->id, 'vehicle_id' => $vehicle->id]);
    $assigned = fleetBooking(['rental_type' => RentalType::OwnersDriver]);
    fleetBooking();
    $this->actingAs(vehicleManagerUser());
    foreach ([$booking->booking_code, 'Fleet Sample', 'Juan', 'Dela Cruz', 'Fleet Vehicle', 'TST-FLEET'] as $term) {
        $this->getJson('/admin/fleet-tracker?'.http_build_query(['search' => $term]))->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $booking->id)
            ->assertJsonPath('data.0.customerName', 'Juan Dela Cruz')->assertJsonPath('meta.total_ongoing', 3);
    }
    $this->getJson('/admin/fleet-tracker?rental_type=self_drive&status=not_started&per_page=1&page=2')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.last_page', 2)->assertJsonPath('meta.total_ongoing', 3);
    $this->getJson('/admin/fleet-tracker?rental_type=owners_driver&status=not_started')->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $assigned->id);
    $this->getJson('/admin/fleet-tracker?search=missing')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total_ongoing', 3);
});

it('allows an authorized staff account and denies staff without the fleet permission', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)->getJson('/admin/fleet-tracker')->assertOk();
    $staffRole = Role::findByName('staff', 'web');
    $staffRole->revokePermissionTo('view fleet tracker');
    $staff->unsetRelation('roles');
    $this->getJson('/admin/fleet-tracker')->assertForbidden();
});

it('searches a zero string and keeps matching non-ongoing bookings outside the result', function () {
    $vehicle = availableVehicle(['name' => 'Zero fleet', 'plate_number' => 'ZERO']);
    $customer = User::factory()->create(['name' => 'Sample renter']);
    $attributes = ['user_id' => $customer->id, 'vehicle_id' => $vehicle->id];
    $match = fleetBooking([...$attributes, 'booking_code' => 'FLEET-0']);
    fleetBooking([...$attributes, 'booking_code' => 'FLEET-A']);
    fleetBooking([...$attributes, 'booking_code' => 'FLEET-0-PENDING', 'status' => BookingStatus::Pending]);
    $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker?search=0')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $match->id)->assertJsonPath('meta.total_ongoing', 2);
});

it('rejects guests inactive managers and customer or driver accounts even with a direct fleet permission', function () {
    $this->getJson('/admin/fleet-tracker')->assertUnauthorized();
    foreach (['customer', 'driver'] as $role) {
        $user = User::factory()->create();
        $user->assignRole($role);
        $user->givePermissionTo('view fleet tracker');
        $this->actingAs($user)->getJson('/admin/fleet-tracker')->assertForbidden();
    }
    $inactive = vehicleManagerUser();
    $inactive->update(['is_active' => false]);
    $this->actingAs($inactive)->getJson('/admin/fleet-tracker')->assertForbidden();
});

it('rejects invalid filters and pagination', function (array $query, string $field) {
    $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker?'.http_build_query($query))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['search' => str_repeat('a', 161)], 'search'],
    [['status' => 'confirmed'], 'status'],
    [['tracking_state' => 'invalid'], 'tracking_state'],
    [['rental_type' => 'invalid'], 'rental_type'],
    [['page' => 0], 'page'],
    [['page' => 'text'], 'page'],
    [['per_page' => 0], 'per_page'],
    [['per_page' => 101], 'per_page'],
    [['per_page' => 1.5], 'per_page'],
]);

it('returns only the consented latest location with its expiry including paused and overdue rentals', function (RentalType $type) {
    $booking = fleetBooking(['rental_type' => $type, 'rental_end_at' => now()->subHour()]);
    $trip = fleetTrip($booking, [
        'status' => 'paused', 'last_location_at' => now()->subMinute(),
        'location_consent_at' => now()->subHour(), 'location_consent_version' => config('telematics.foreground_location.consent_version'),
        'latest_location' => ['latitude' => 14.0, 'longitude' => 121.0, 'accuracy' => 5],
        'current_latitude' => 10, 'current_longitude' => 100,
    ]);
    $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker')->assertOk()
        ->assertJsonPath('data.0.tracking.location.latitude', 14)
        ->assertJsonPath('data.0.tracking.location.longitude', 121)
        ->assertJsonPath('data.0.tracking.location.accuracy', 5)
        ->assertJsonPath('data.0.tracking.location.expiresAt', $trip->last_location_at->addHours(24)->toISOString())
        ->assertJsonMissingPath('data.0.location_session_hash')->assertJsonMissingPath('data.0.tracking.current_speed');
    expect($trip->locationPoints()->count())->toBe(0);
})->with([RentalType::SelfDrive, RentalType::OwnersDriver]);

it('withholds map locations outside the latest-only release consent and retention boundary', function (string $scenario, RentalType $type) {
    $booking = fleetBooking(['rental_type' => $type], released: false);
    $booking->telematicsSetupSession()->create(['status' => $scenario === 'unreleased' ? 'in_progress' : 'released']);
    $trip = fleetTrip($booking, [
        'status' => $scenario === 'ended' ? 'ended' : 'started',
        'last_location_at' => $scenario === 'expired' ? now()->subHours(24) : now(),
        'location_consent_at' => $scenario === 'no_consent' ? null : now()->subDay(),
        'location_consent_version' => $scenario === 'legacy' ? null : config('telematics.foreground_location.consent_version'),
        'latest_location' => $scenario === 'missing' ? null : ['latitude' => 14, 'longitude' => 121, 'accuracy' => 5],
        'current_latitude' => 14, 'current_longitude' => 121,
    ]);
    if ($scenario === 'received') {
        $booking->returnRecord()->create(['vehicle_received_at' => now()]);
    }
    if ($scenario === 'corrupt') {
        DB::table('telematics_trips')->where('id', $trip->id)->update(['latest_location' => 'invalid ciphertext']);
    }
    $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker')->assertOk()
        ->assertJsonPath('data.0.tracking.location', null);
})->with(['unreleased', 'ended', 'expired', 'no_consent', 'legacy', 'missing', 'received', 'corrupt'])
    ->with([RentalType::SelfDrive, RentalType::OwnersDriver]);

it('invalidates the fleet on rental and latest point changes without publishing unrelated updates', function () {
    Event::fake([FleetMonitoringChanged::class]);
    $booking = fleetBooking();
    Event::assertDispatchedTimes(FleetMonitoringChanged::class, 1);
    $trip = fleetTrip($booking);
    Event::assertDispatchedTimes(FleetMonitoringChanged::class, 2);
    $trip->update(['last_location_at' => now(), 'latest_location' => ['latitude' => 14, 'longitude' => 121, 'accuracy' => 5]]);
    Event::assertDispatchedTimes(FleetMonitoringChanged::class, 3);
    $trip->update(['battery_percent' => 80]);
    Event::assertDispatchedTimes(FleetMonitoringChanged::class, 3);
    $trip->update(['status' => 'paused']);
    $booking->update(['status' => BookingStatus::Returned]);
    Event::assertDispatchedTimes(FleetMonitoringChanged::class, 5);
});

it('groups practical tracking filters without mixing lifecycle states', function () {
    $waiting = fleetBooking();
    $awaiting = fleetBooking();
    fleetTrip($awaiting);
    $updating = fleetBooking();
    fleetTrip($updating, ['last_location_at' => now()]);
    $stale = fleetBooking();
    fleetTrip($stale, ['last_location_at' => now()->subSeconds(121)]);
    $paused = fleetBooking();
    fleetTrip($paused, ['status' => 'paused']);
    $ended = fleetBooking();
    fleetTrip($ended, ['status' => 'ended']);
    $unavailable = fleetBooking(released: false);
    fleetBooking(['status' => BookingStatus::Completed]);
    $this->actingAs(vehicleManagerUser());
    foreach (['updating' => [$updating->id], 'no_updates' => [$stale->id], 'paused' => [$paused->id],
        'not_tracking' => [$waiting->id, $awaiting->id, $ended->id, $unavailable->id]] as $state => $ids) {
        $response = $this->getJson('/admin/fleet-tracker?tracking_state='.$state)->assertOk()
            ->assertJsonPath('meta.total', count($ids))->assertJsonPath('meta.total_ongoing', 7);
        expect(array_column($response->json('data'), 'id'))->toBe($ids);
    }
});

it('provides complete vehicle identity and the recorded operator contact without exposing account fields', function () {
    $renter = customerUser(['name' => 'Renter account', 'phone_number' => '09170000001']);
    $driver = createDriverUser(['name' => 'Recorded driver', 'phone_number' => '09170000002']);
    $replacement = createDriverUser(['name' => 'Current assignment', 'phone_number' => '09170000003']);
    $vehicle = availableVehicle(['name' => 'Hiace', 'brand' => 'Toyota', 'model' => '2024']);
    $booking = fleetBooking(['user_id' => $renter->id, 'vehicle_id' => $vehicle->id,
        'rental_type' => RentalType::OwnersDriver, 'assigned_driver_id' => $driver->id]);
    fleetTrip($booking);
    $booking->update(['assigned_driver_id' => $replacement->id]);
    $driver->delete();
    $response = $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker')->assertOk()
        ->assertJsonPath('data.0.vehicle.brand', 'Toyota')->assertJsonPath('data.0.vehicle.name', 'Hiace')
        ->assertJsonPath('data.0.vehicle.model', '2024')->assertJsonPath('data.0.operator.id', $driver->id)
        ->assertJsonPath('data.0.operator.phoneNumber', '09170000002')
        ->assertJsonPath('data.0.operator.email', $driver->email)->assertJsonMissingPath('data.0.operator.password');
    $this->getJson('/admin/fleet-tracker?search=Recorded%20driver')->assertOk()->assertJsonPath('meta.total', 1);
    $response->assertHeader('Cache-Control', 'no-store, private');
});

it('uses the renter contact for self drive and the assigned driver before a trip exists', function () {
    $renter = customerUser(['phone_number' => '09170000001']);
    $self = fleetBooking(['user_id' => $renter->id]);
    $driver = createDriverUser(['phone_number' => '09170000002']);
    $assigned = fleetBooking(['rental_type' => RentalType::OwnersDriver, 'assigned_driver_id' => $driver->id]);
    $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker?rental_type=self_drive')->assertOk()
        ->assertJsonPath('data.0.id', $self->id)->assertJsonPath('data.0.operator.phoneNumber', '09170000001');
    $this->getJson('/admin/fleet-tracker?rental_type=owners_driver')->assertOk()
        ->assertJsonPath('data.0.id', $assigned->id)->assertJsonPath('data.0.operator.id', $driver->id)
        ->assertJsonPath('data.0.operator.phoneNumber', '09170000002');
});

it('returns three independent live rentals and keeps their maneuver logs trip scoped', function () {
    $bookings = [];
    foreach (['harsh_acceleration', 'harsh_braking', 'harsh_cornering'] as $index => $target) {
        $booking = fleetBooking();
        $trip = fleetTrip($booking, ['last_location_at' => now(), 'location_consent_at' => now()->subMinute(),
            'location_consent_version' => config('telematics.foreground_location.consent_version'),
            'latest_location' => ['latitude' => 14 + $index * .01, 'longitude' => 121, 'accuracy' => 5]]);
        $session = DriveMonitoringSession::create(['user_id' => $booking->user_id,
            'telematics_trip_id' => $trip->id, 'client_session_id' => (string) Str::uuid(),
            'status' => 'active', 'model_sha256' => str_repeat('a', 64), 'consented_at' => now()]);
        DriveMonitoringEvent::create(['session_id' => $session->id, 'target' => $target,
            'status' => 'confirmed', 'start_ms' => 1000, 'end_ms' => 1400, 'last_ms' => 1400, 'emitted_ms' => 1400, 'vote' => .9]);
        $bookings[] = [$booking, $target];
    }
    $viewer = vehicleManagerUser();
    $booking = $bookings[0][0];
    $notifications = app(NotificationService::class);
    $notifications->createForBooking($booking, 'trip', 'Customer update', 'Customer update');
    $notifications->createForUser($viewer, 'trip', 'Fleet update', 'Fleet update', ['booking_id' => $booking->id]);
    $notifications->createForUser($viewer, 'trip', 'Read update', 'Read update', ['booking_id' => $booking->id])->update(['read_at' => now()]);

    $response = $this->actingAs($viewer)->getJson('/admin/fleet-tracker?tracking_state=updating')->assertOk()
        ->assertJsonCount(3, 'data')->assertJsonPath('meta.total_ongoing', 3);
    $counts = collect($response->json('data'))->pluck('activityCounts', 'id');
    expect($counts[$booking->id])->toBe(['driving' => 1, 'trip' => 0, 'unreadNotifications' => 1])
        ->and($counts[$bookings[1][0]->id])->toBe(['driving' => 1, 'trip' => 0, 'unreadNotifications' => 0]);
    expect(collect($response->json('data'))->pluck('tracking.location.latitude')->unique())->toHaveCount(3);
    foreach ($bookings as [$booking, $target]) {
        $this->getJson('/admin/fleet-tracker/'.$booking->booking_code.'/motion-monitoring')->assertOk()
            ->assertJsonCount(1, 'data.events')->assertJsonPath('data.events.0.target', $target)
            ->assertJsonPath('data.event_summary.detected', 1)->assertJsonPath('data.operator.id', $booking->user_id);
    }
});

it('returns only the booking customer emergency contact details', function () {
    $booking = fleetBooking();
    $booking->user->emergencyContacts()->updateOrCreate([], ['name' => 'Emergency person', 'relationship' => 'Sibling', 'phone_number' => '09170000000']);
    $this->actingAs(vehicleManagerUser())->getJson('/admin/fleet-tracker')->assertOk()
        ->assertJsonPath('data.0.emergencyContacts', [['name' => 'Emergency person', 'relationship' => 'Sibling', 'phoneNumber' => '09170000000']]);
});
