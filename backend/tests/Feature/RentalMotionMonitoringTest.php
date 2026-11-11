<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\DriveMonitoringBatch;
use App\Models\DriveMonitoringEvent;
use App\Models\DriveMonitoringSession;
use App\Models\TelematicsSetupSession;
use App\Models\TelematicsSetupStep;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\RcDemoInferenceService;
use App\Services\RentalMotionCoverageService;
use App\Services\RentalMotionReferenceService;
use App\Services\TelematicsCalibrationService;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->customer = customerUser();
    $this->booking = Booking::create([
        'booking_code' => 'BK-MOTION-'.Str::upper(Str::random(6)),
        'user_id' => $this->customer->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::SelfDrive, 'rental_start_at' => now()->subHour(), 'rental_end_at' => now()->addDay(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Test garage', 'return_location' => 'Test garage',
        'status' => BookingStatus::Ongoing, 'payment_status' => 'paid', 'price_per_day' => 3500,
        'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500,
    ]);
    $this->booking->telematicsSetupSession()->create(['status' => 'released', 'released_at' => now()->subHour()]);
    $this->trip = $this->booking->telematicsTrips()->create(['operator_user_id' => $this->customer->id,
        'status' => 'started', 'started_at' => now(), 'location_consent_version' => 3,
        'location_session_hash' => hash('sha256', str_repeat('x', 64))]);
    $this->reference = ['rotation_rfu' => [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        'acceleration_mean' => [0, 0, 9.81], 'gyroscope_mean' => [0, 0, 0]];
    $this->mock(RentalMotionReferenceService::class)->shouldReceive('reference')->andReturn($this->reference);
    Sanctum::actingAs($this->customer);
    $this->url = '/api/mobile/bookings/'.$this->booking->booking_code.'/motion-monitoring';
    $this->input = ['client_session_id' => (string) Str::uuid(), 'consent_version' => 'rental-rc-motion-v1',
        'consent' => true, 'same_mount_confirmed' => true];
});

it('binds an explicitly consented RC motion segment to the existing real-car rental trip', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()
        ->assertJsonPath('data.telematics_trip_id', $this->trip->id)->assertJsonPath('data.sensor_platform', 'rc')
        ->assertJsonPath('data.runtime_reference', $this->reference)->json('data.id');
    $this->postJson($this->url.'/start', $this->input)->assertOk()->assertJsonPath('data.id', $id);
    expect($this->booking->telematicsTrips()->count())->toBe(1)
        ->and(DriveMonitoringSession::count())->toBe(1)
        ->and(DriveMonitoringSession::first()->reference_run_id)->toBeNull();
    $this->postJson($this->url.'/sessions/'.$id.'/stop')->assertOk()->assertJsonPath('data.status', 'stopped');
    $this->postJson($this->url.'/start', [...$this->input, 'client_session_id' => (string) Str::uuid()])->assertOk();
    expect($this->booking->telematicsTrips()->count())->toBe(1);
});

it('requires release, started GPS, RC mode, fresh motion consent and unchanged mount confirmation', function () {
    $this->postJson($this->url.'/start', [...$this->input, 'consent' => false])->assertUnprocessable();
    $this->postJson($this->url.'/start', [...$this->input, 'same_mount_confirmed' => false])->assertUnprocessable();
    $this->postJson($this->url.'/start', [...$this->input, 'consent_version' => 'drive-monitoring-v1'])->assertUnprocessable();
    config(['telematics.calibration_profile' => 'standard']);
    $this->postJson($this->url.'/start', $this->input)->assertUnprocessable();
    config(['telematics.calibration_profile' => 'rc_demo']);
    $this->trip->update(['status' => 'paused']);
    $this->postJson($this->url.'/start', $this->input)->assertUnprocessable();
    $this->trip->update(['status' => 'started']);
    $this->booking->telematicsSetupSession()->update(['status' => 'ready_for_release']);
    $this->postJson($this->url.'/start', $this->input)->assertUnprocessable();
    expect(DriveMonitoringSession::count())->toBe(0);
});

it('rejects other customers and Admin research tokens without widening research permissions', function () {
    Sanctum::actingAs(customerUser());
    $this->getJson($this->url)->assertNotFound();
    $this->postJson($this->url.'/start', $this->input)->assertNotFound();
    $admin = User::factory()->create(['is_active' => true]);
    $admin->assignRole('admin');
    auth()->forgetGuards();
    $this->withToken($admin->createToken('research', ['rc-research'])->plainTextToken)
        ->postJson($this->url.'/start', $this->input)->assertForbidden();
});

it('deduplicates rental feature receipts and groups events under the trip', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $this->travel(2)->seconds();
    $payload = ['client_batch_id' => (string) Str::uuid(), 'version' => 'rc-demo-inference-v1',
        'windows' => [['id' => 'w-0-400', 'start_ms' => 0, 'end_ms' => 400, 'features' => array_fill(0, 35, 0),
            'braking_evidence' => ['peak_ms' => 0, 'vertical_peak' => 0, 'pitch_rate_peak' => 0]]]];
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn([
        'version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => 'w-0-400', 'class' => 'harsh_acceleration', 'vote' => .9]],
    ]);
    $path = $this->url.'/sessions/'.$id.'/batches';
    $this->postJson($path, $payload)->assertOk();
    $this->postJson($path, $payload)->assertOk();
    expect(DriveMonitoringBatch::count())->toBe(1)->and(DriveMonitoringEvent::count())->toBe(1);
    $this->postJson($this->url.'/sessions/'.$id.'/stop')->assertOk();
    $this->postJson($path, $payload)->assertOk();
    $this->postJson($path, [...$payload, 'client_batch_id' => (string) Str::uuid()])->assertConflict();
});

it('closes the capture boundary on GPS pause and rejects later sensor-time windows even after resume', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $this->travel(2)->seconds();
    $this->postJson(str_replace('motion-monitoring', 'location-monitoring', $this->url).'/pause',
        ['session_token' => str_repeat('x', 64)])->assertOk();
    expect(DriveMonitoringSession::find($id)->capture_closed_ms)->not->toBeNull();
    $this->trip->update(['status' => 'started']);
    $this->travel(5)->seconds();
    $this->postJson($this->url.'/sessions/'.$id.'/batches', ['client_batch_id' => (string) Str::uuid(), 'version' => 'rc-demo-inference-v1',
        'windows' => [['id' => 'w-3000-3400', 'start_ms' => 3000, 'end_ms' => 3400, 'features' => array_fill(0, 35, 0),
            'braking_evidence' => ['peak_ms' => 3000, 'vertical_peak' => 0, 'pitch_rate_peak' => 0]]]])->assertConflict();
});

it('keeps rental sessions out of the owner-bound research inspector', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $admin = User::factory()->create(['is_active' => true]);
    $admin->assignRole('admin');
    $this->actingAs($admin, 'web')->getJson('/admin/rc-research/drive-monitoring/sessions/'.$id)->assertNotFound();
    $this->actingAs($admin, 'web')->getJson('/admin/fleet-tracker/'.$this->booking->booking_code.'/motion-monitoring')
        ->assertOk()->assertJsonPath('data.sensor_platform', 'rc')->assertJsonMissingPath('data.runtime_reference');
});

it('allows the current assigned Driver and blocks former Drivers and the non-operating customer', function () {
    $driver = createDriverUser();
    $this->booking->update(['rental_type' => RentalType::OwnersDriver]);
    $this->booking->assignment()->create(['driver_id' => $driver->id, 'assigned_at' => now()]);
    $this->trip->update(['operator_user_id' => $driver->id]);
    $this->postJson($this->url.'/start', $this->input)->assertNotFound();
    Sanctum::actingAs($driver);
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $this->booking->assignment()->update(['driver_id' => createDriverUser()->id]);
    $this->postJson($this->url.'/sessions/'.$id.'/stop')->assertNotFound();
});

it('retains motion capture during an interrupted GPS pause and protects the original capture cutoff on manual pause', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $this->travel(3)->seconds();
    $this->postJson(str_replace('motion-monitoring', 'location-monitoring', $this->url).'/pause',
        ['session_token' => str_repeat('x', 64), 'reason' => 'interrupted'])->assertOk();
    expect(DriveMonitoringSession::find($id)->capture_closed_ms)->toBeNull();
    $payload = ['client_batch_id' => (string) Str::uuid(), 'version' => 'rc-demo-inference-v1',
        'windows' => [['id' => 'w-0-400', 'start_ms' => 0, 'end_ms' => 400, 'features' => array_fill(0, 35, 0),
            'braking_evidence' => ['peak_ms' => 0, 'vertical_peak' => 0, 'pitch_rate_peak' => 0]]]];
    $this->mock(RcDemoInferenceService::class)->shouldReceive('predict')->once()->andReturn([
        'version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256,
        'predictions' => [['id' => 'w-0-400', 'class' => 'normal_motion', 'vote' => .9]],
    ]);
    $this->postJson($this->url.'/sessions/'.$id.'/batches', $payload)->assertOk();
});

it('converts tilted native calibration into a right-handed frame and radians per second without training labels', function () {
    $angle = deg2rad(10);
    $up = [0, -sin($angle), cos($angle)];
    $forward = [0, cos($angle), sin($angle)];
    $parked = array_map(fn ($n) => $n * 9.81, $up);
    $calibration = $this->mock(TelematicsCalibrationService::class);
    $calibration->shouldReceive('projection')->once()->andReturn([
        'profile' => ['id' => 'rc_demo'], 'parkedAcceleration' => $parked,
        'reference' => ['down' => array_map(fn ($n) => -$n, $up), 'forward' => $forward],
    ]);
    $calibration->shouldReceive('latestSteps')->once()->andReturn(collect([
        'stationary_calibration' => new TelematicsSetupStep(['evidence' => ['protocol_version' => 4,
            'rotation_mean_x' => 1, 'rotation_mean_y' => -2, 'rotation_mean_z' => 3]]),
        'forward_calibration' => new TelematicsSetupStep(['evidence' => ['protocol_version' => 4]]),
    ]));
    $result = (new RentalMotionReferenceService)->reference(new TelematicsSetupSession);
    [$right, $f, $u] = $result['rotation_rfu'];
    expect($result['acceleration_mean'])->toBe($parked);
    foreach ([[1, 0, 0], $forward, $up] as $row => $expected) {
        foreach ($expected as $axis => $n) {
            expect(abs($result['rotation_rfu'][$row][$axis] - $n))->toBeLessThan(1e-12);
        }
    }
    expect(abs($result['gyroscope_mean'][1] - deg2rad(-2)))->toBeLessThan(1e-12)
        ->and(abs(array_sum(array_map(fn ($a, $b) => $a * $b, $f, $u))))->toBeLessThan(1e-12);
});

it('refuses to silently reinterpret legacy Expo calibration as native rental alignment', function () {
    $this->mock(TelematicsCalibrationService::class)->shouldReceive('projection')->once()->andReturn([
        'profile' => ['id' => 'rc_demo'], 'parkedAcceleration' => [0, 0, 9.81],
        'reference' => ['down' => [0, 0, -1], 'forward' => [0, 1, 0]],
    ]);
    app(TelematicsCalibrationService::class)->shouldReceive('latestSteps')->once()->andReturn(collect([
        'stationary_calibration' => new TelematicsSetupStep(['evidence' => ['protocol_version' => 3]]),
        'forward_calibration' => new TelematicsSetupStep(['evidence' => ['protocol_version' => 3]]),
    ]));
    expect(fn () => (new RentalMotionReferenceService)->reference(new TelematicsSetupSession))
        ->toThrow(ValidationException::class);
});

it('shows trip-scoped driving events to authorized fleet viewers without exposing feature receipts', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $captureStart = now()->subMinutes(3)->getTimestampMs();
    DriveMonitoringSession::findOrFail($id)->update(['capture_started_ms' => $captureStart]);
    foreach (['confirmed', 'review_required', 'pending', 'suppressed'] as $status) {
        $start = $status === 'review_required' ? 3400 : 1000;
        DriveMonitoringEvent::create(['session_id' => $id, 'target' => 'harsh_acceleration', 'status' => $status,
            'start_ms' => $start, 'end_ms' => $start + 400, 'last_ms' => $start + 400, 'emitted_ms' => $start + 400,
            'created_at' => $status === 'review_required' ? now()->subMinute() : now(), 'vote' => .9]);
    }
    $path = '/admin/fleet-tracker/'.$this->booking->booking_code.'/motion-monitoring';
    $this->actingAs($this->customer, 'web')->getJson($path)->assertForbidden();
    $admin = User::factory()->create(['is_active' => true]);
    $admin->assignRole('admin');
    $this->actingAs($admin, 'web')->getJson($path)->assertOk()
        ->assertJsonPath('data.event_summary', ['detected' => 1, 'needs_review' => 1, 'pending' => 1])
        ->assertJsonPath('data.maneuvers.harsh_acceleration', 1)
        ->assertJsonPath('data.maneuvers.harsh_braking', 0)
        ->assertJsonPath('data.events.0.status', 'review_required')
        ->assertJsonPath('data.events.0.occurred_at', CarbonImmutable::createFromTimestampMs($captureStart + 3400, 'UTC')->toISOString())
        ->assertJsonPath('data.events.1.occurred_at', CarbonImmutable::createFromTimestampMs($captureStart + 1000, 'UTC')->toISOString())
        ->assertJsonCount(2, 'data.events')->assertJsonMissingPath('data.recent_predictions')
        ->assertJsonMissingPath('data.runtime_reference');
    DriveMonitoringSession::findOrFail($id)->update(['capture_started_ms' => null]);
    $this->getJson($path)->assertOk()->assertJsonPath('data.events.0.occurred_at', null);
});

it('shows Driving Analysis only for completed rentals with booking and fleet access', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $path = '/admin/bookings/'.$this->booking->id.'/driving-analysis';
    $admin = User::factory()->create(['is_active' => true]);
    $admin->assignRole('admin');

    $this->actingAs($admin, 'web')->getJson($path)->assertNotFound();
    $this->booking->update(['status' => BookingStatus::Completed]);
    $this->actingAs($this->customer, 'web')->getJson($path)->assertForbidden();

    $staff = User::factory()->create(['is_active' => true]);
    $staff->assignRole('staff')->syncPermissions(['manage bookings']);
    $staff->roles()->firstOrFail()->revokePermissionTo('view fleet tracker');
    $this->actingAs($staff, 'web')->getJson($path)->assertForbidden();

    $this->actingAs($admin, 'web')->getJson($path)->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.sync_pending', true)
        ->assertJsonPath('data.latest_received_at', null)
        ->assertJsonCount(0, 'data.events');

    DriveMonitoringBatch::create([
        'session_id' => $id, 'client_batch_id' => (string) Str::uuid(),
        'content_sha256' => str_repeat('a', 64), 'predictions' => [],
    ]);
    DriveMonitoringSession::findOrFail($id)->update(['status' => 'stopped']);

    $this->getJson($path)->assertOk()
        ->assertJsonPath('data.sync_pending', false)
        ->assertJsonPath('data.event_summary.detected', 0)
        ->assertJsonCount(0, 'data.events')
        ->assertJsonMissingPath('data.score')
        ->assertJsonMissingPath('data.predictions')
        ->assertJsonStructure(['data' => ['latest_received_at']]);
    expect($this->getJson($path)->json('data.latest_received_at'))->not->toBeNull();
});

it('reports analyzed time across the released period and marks legacy coverage unavailable', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $start = CarbonImmutable::parse('2026-11-11T01:00:00Z');
    $this->booking->telematicsSetupSession->update(['released_at' => $start]);
    $this->trip->update(['ended_at' => $start->addSeconds(10), 'status' => 'ended']);
    $session = DriveMonitoringSession::findOrFail($id);
    $session->update(['capture_started_ms' => $start->getTimestampMs()]);
    app(RentalMotionCoverageService::class)->receive($session, [
        ['start_ms' => 1000, 'end_ms' => 2000],
        ['start_ms' => 1500, 'end_ms' => 3000],
        ['start_ms' => 5000, 'end_ms' => 6000],
    ]);
    $coverage = app(RentalMotionCoverageService::class)->forBooking($this->booking->fresh(), $this->trip->id);
    expect($coverage['period_ms'])->toBe(10000)
        ->and($coverage['analyzed_ms'])->toBe(3000)
        ->and($coverage['uncovered_ms'])->toBe(7000)
        ->and($coverage['gap_count'])->toBe(3)
        ->and($coverage['percent'])->toBe(30.0);
    $session->update(['coverage_version' => null]);
    $coverage = app(RentalMotionCoverageService::class)->forBooking($this->booking->fresh(), $this->trip->id);
    expect($coverage['status'])->toBe('unavailable')->and($coverage['percent'])->toBeNull();
});

it('uses confirmed events for consistent provisional grades in the list and report', function () {
    $id = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $admin = User::factory()->create(['is_active' => true]);
    $admin->assignRole('admin');
    $this->actingAs($this->customer, 'web')->getJson('/admin/driving-analysis')->assertForbidden();
    $this->actingAs($admin, 'web')->getJson('/admin/driving-analysis')->assertOk()->assertJsonCount(0, 'data');
    $this->booking->update(['status' => BookingStatus::Completed]);
    $detail = '/admin/bookings/'.$this->booking->id.'/driving-analysis';
    $key = 'meta.driving_grades.'.$this->booking->id;
    $this->getJson($detail)->assertOk()->assertJsonPath('data.grading.score', null)
        ->assertJsonPath('data.grading.status', 'not_graded');
    $this->getJson('/admin/driving-analysis')->assertOk()->assertJsonPath($key.'.score', null);
    DriveMonitoringBatch::create(['session_id' => $id, 'client_batch_id' => (string) Str::uuid(),
        'content_sha256' => str_repeat('b', 64), 'predictions' => []]);
    foreach (['harsh_acceleration', 'harsh_braking', 'harsh_cornering', 'harsh_swerve'] as $target) {
        foreach (['confirmed', 'review_required', 'suppressed', 'pending'] as $status) {
            DriveMonitoringEvent::create(['session_id' => $id, 'target' => $target, 'status' => $status,
                'start_ms' => 1000, 'end_ms' => 1400, 'last_ms' => 1400, 'emitted_ms' => 1400, 'vote' => .9]);
        }
    }
    $report = $this->getJson($detail)->assertOk()->assertJsonPath('data.grading.score', 90)
        ->assertJsonPath('data.grading.confirmed_events', 4)
        ->assertJsonPath('data.grading.status', 'provisional')
        ->assertJsonPath('data.grading.breakdown.harsh_braking.deduction', 2)
        ->assertJsonPath('data.grading.breakdown.harsh_swerve.deduction', 3)
        ->assertJsonPath('data.grading.deductions', 10)->json('data.grading');
    $this->getJson('/admin/driving-analysis?per_page=10')->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath($key, $report);
    $staff = User::factory()->create(['is_active' => true]);
    $staff->assignRole('staff')->roles()->firstOrFail()->revokePermissionTo('view fleet tracker');
    $this->actingAs($staff, 'web')->getJson('/admin/driving-analysis')->assertForbidden();
});

it('interleaves recorded maneuver and zone times with booking notices across activity pages', function () {
    $session = DriveMonitoringSession::findOrFail($this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id'));
    $started = CarbonImmutable::parse('2026-11-11T10:00:00Z');
    $session->update(['capture_started_ms' => $started->getTimestampMs()]);
    $this->travelTo($started->addMinutes(5));

    $event = fn (string $target, string $status, int $offset) => DriveMonitoringEvent::create([
        'session_id' => $session->id, 'target' => $target, 'status' => $status,
        'start_ms' => $offset, 'end_ms' => $offset + 400, 'last_ms' => $offset + 400,
        'emitted_ms' => $offset + 400, 'vote' => .9,
    ]);
    $harsh = $event('harsh_acceleration', 'confirmed', 1000);
    $uncertain = $event('harsh_braking', 'review_required', 1000);
    $event('harsh_cornering', 'pending', 7000);
    $event('harsh_cornering', 'suppressed', 8000);

    $notifications = app(NotificationService::class);
    $zone = $notifications->createForBooking($this->booking, 'trip', 'Zone exited', 'Exited the test zone.', [
        'event_type' => 'geofence_exit', 'occurred_at' => $started->addMilliseconds(1500)->toISOString(),
    ]);
    $latest = $notifications->createForBooking($this->booking, 'trip', 'GPS monitoring stopped', 'GPS stopped.');
    for ($index = 0; $index < 10; $index++) {
        $event('harsh_swerve', 'confirmed', 2000 + $index * 200);
    }
    $notifications->createForBooking($this->booking, 'booking', 'Booking update', 'A booking update.');
    $notifications->createForUser($this->customer, 'trip', 'Other trip', 'Unrelated activity.');

    $url = str_replace('motion-monitoring', 'activity', $this->url);
    $first = $this->getJson($url)->assertOk()->assertJsonCount(10, 'data')
        ->assertJsonPath('data.0.id', (string) $latest->id)
        ->assertJsonPath('data.1.target', 'harsh_swerve')
        ->assertJsonPath('data.1.occurredAt', $started->addMilliseconds(3800)->toISOString())
        ->assertJsonPath('meta.has_more', true)
        ->assertJsonPath('meta.booking_unread_count', 2);
    $second = $this->getJson($url.'?cursor='.urlencode($first->json('meta.next_cursor')))
        ->assertOk()->assertJsonCount(4, 'data')->assertJsonPath('meta.has_more', false)
        ->assertJsonPath('data.1.id', (string) $zone->id)
        ->assertJsonPath('data.1.occurredAt', $started->addMilliseconds(1500)->toISOString());

    $tail = collect($second->json('data'))->keyBy('id');
    expect($tail[$harsh->id]['status'])->toBe('confirmed')
        ->and($tail[$uncertain->id]['status'])->toBe('review_required')
        ->and($tail[$harsh->id]['occurredAt'])->toBe($started->addSecond()->toISOString());
    expect(collect($first->json('data'))->concat($second->json('data'))->pluck('id')->unique())->toHaveCount(14);

    $this->getJson($url.'?cursor=invalid')->assertUnprocessable()->assertJsonValidationErrors('cursor');
    $this->getJson('/api/mobile/notifications')->assertOk()->assertJsonMissing(['id' => $harsh->id]);
    Sanctum::actingAs(customerUser());
    $this->getJson($url)->assertNotFound();
});

it('scopes assigned rental activity to the current Driver and their own motion segments', function () {
    $oldSession = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    $driver = createDriverUser();
    $this->booking->update(['rental_type' => RentalType::OwnersDriver]);
    $this->booking->assignment()->create(['driver_id' => $driver->id, 'assigned_at' => now()]);
    $this->trip->update(['operator_user_id' => $driver->id]);
    $url = str_replace('motion-monitoring', 'activity', $this->url);
    $this->getJson($url)->assertNotFound();

    Sanctum::actingAs($driver);
    $session = $this->postJson($this->url.'/start', $this->input)->assertOk()->json('data.id');
    foreach ([$oldSession, $session] as $id) {
        DriveMonitoringEvent::create([
            'session_id' => $id, 'target' => 'harsh_swerve', 'status' => 'confirmed',
            'start_ms' => 0, 'end_ms' => 400, 'last_ms' => 400, 'emitted_ms' => 400, 'vote' => .9,
        ]);
    }
    $visible = DriveMonitoringEvent::where('session_id', $session)->firstOrFail();
    $this->getJson($url)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $visible->id);

    $this->booking->assignment()->update(['driver_id' => createDriverUser()->id]);
    $this->getJson($url)->assertNotFound();
});
