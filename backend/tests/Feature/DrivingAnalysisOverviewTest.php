<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\DriveMonitoringBatch;
use App\Models\DriveMonitoringEvent;
use App\Models\DriveMonitoringSession;
use App\Models\RentalDrivingReport;
use App\Models\User;
use App\Services\RentalDrivingReportService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

function overviewRental(User $owner, ?User $operator, bool $received = false, array $events = [], BookingStatus $status = BookingStatus::Completed, ?string $completedAt = null): Booking
{
    $booking = Booking::create([
        'booking_code' => 'BK-OV-'.Str::upper(Str::random(6)), 'user_id' => $owner->id,
        'vehicle_id' => availableVehicle()->id, 'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => now()->subDays(2), 'rental_end_at' => now()->subDay(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'status' => $status, 'payment_status' => 'paid', 'price_per_day' => 3500,
        'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500,
        'completed_at' => $completedAt,
    ]);
    if ($operator) {
        $trip = $booking->telematicsTrips()->create(['operator_user_id' => $operator->id, 'status' => 'ended']);
        $capture = DriveMonitoringSession::create(['user_id' => $operator->id, 'telematics_trip_id' => $trip->id,
            'client_session_id' => (string) Str::uuid(), 'status' => 'stopped', 'model_sha256' => str_repeat('a', 64), 'consented_at' => now()]);
        if ($received) {
            DriveMonitoringBatch::create(['session_id' => $capture->id, 'client_batch_id' => (string) Str::uuid(),
                'content_sha256' => str_repeat('b', 64), 'predictions' => []]);
        }
        foreach ($events as [$target, $eventStatus]) {
            DriveMonitoringEvent::create(['session_id' => $capture->id, 'target' => $target, 'status' => $eventStatus,
                'start_ms' => 1000, 'end_ms' => 1400, 'last_ms' => 1400, 'emitted_ms' => 1400, 'vote' => .9]);
        }
        app(RentalDrivingReportService::class)->finalize($booking->id);
    }

    return $booking;
}

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->admin = User::factory()->create(['is_active' => true]);
    $this->admin->assignRole('admin');
    $this->owner = customerUser();
    $this->operator = User::factory()->create(['name' => 'Recorded Operator']);
    $this->actingAs($this->admin, 'web');
});

it('summarizes all matching completed rentals rather than the current page', function () {
    overviewRental($this->owner, $this->operator, true, [['harsh_acceleration', 'confirmed'], ['harsh_swerve', 'confirmed'], ['harsh_braking', 'review_required']], completedAt: '2026-11-01 10:00:00');
    overviewRental($this->owner, $this->operator, true, completedAt: '2026-11-02 10:00:00');
    overviewRental($this->owner, $this->operator);
    overviewRental($this->owner, null);
    overviewRental($this->owner, $this->operator, true, [['harsh_cornering', 'confirmed']], BookingStatus::Ongoing);
    overviewRental($this->owner, $this->operator, true, [['harsh_cornering', 'confirmed']])->delete();
    $response = $this->getJson('/admin/driving-analysis?per_page=1')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.total', 4)->assertJsonPath('meta.summary.completed_rentals', 4)
        ->assertJsonPath('meta.summary.operators_monitored', 1)->assertJsonPath('meta.summary.harsh_events', 2)
        ->assertJsonPath('meta.summary.average_score', 97.5);
    $this->getJson('/admin/driving-analysis?page=2&per_page=1')->assertOk()
        ->assertJsonPath('meta.summary', $response->json('meta.summary'));
    $this->getJson('/admin/driving-analysis/operators')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $this->operator->id)->assertJsonPath('data.0.monitored_rentals', 2)
        ->assertJsonPath('data.0.completed_rentals', 3)->assertJsonPath('data.0.average_score', 97.5)
        ->assertJsonPath('data.0.latest_score', 100)->assertJsonPath('data.0.harsh_events', 2);
});

it('uses recorded trip identities and completion order for each operator', function () {
    $first = overviewRental($this->owner, $this->operator, true, [['harsh_braking', 'confirmed']], completedAt: '2026-11-03 10:00:00');
    overviewRental($this->owner, $this->operator, true, completedAt: '2026-11-01 10:00:00');
    $sameName = User::factory()->create(['name' => $this->operator->name]);
    overviewRental($this->owner, $sameName, true);
    $this->operator->delete();
    $this->getJson('/admin/driving-analysis/operators?per_page=1')->assertOk()
        ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.summary.operators_monitored', 2)
        ->assertJsonPath('data.0.latest_score', 98);
    $path = '/admin/driving-analysis?operator_id='.$this->operator->id;
    $this->getJson($path)->assertOk()->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.operator_filter.name', 'Recorded Operator')
        ->assertJsonPath('meta.recorded_operators.'.$first->id.'.id', $this->operator->id);
    $this->getJson('/admin/bookings/'.$first->id.'/driving-analysis')->assertOk()
        ->assertJsonPath('data.operator.id', $this->operator->id);
});

it('returns empty and ungraded summaries without inventing scores', function () {
    $this->getJson('/admin/driving-analysis')->assertOk()->assertJsonPath('meta.summary', [
        'completed_rentals' => 0, 'operators_monitored' => 0, 'average_score' => null, 'harsh_events' => 0, 'incomplete_grades' => 0,
    ]);
    overviewRental($this->owner, $this->operator);
    $this->getJson('/admin/driving-analysis/operators')->assertOk()->assertJsonPath('data.0.average_score', null)
        ->assertJsonPath('data.0.latest_score', null)->assertJsonPath('data.0.monitored_rentals', 0);
    $this->getJson('/admin/driving-analysis/operators?search=Nobody')->assertOk()->assertJsonCount(0, 'data')
        ->assertJsonPath('meta.summary.completed_rentals', 0);
});

it('identifies incomplete saved grades in booking details and aggregate views', function () {
    $booking = overviewRental($this->owner, $this->operator, true, completedAt: '2026-11-02 10:00:00');
    $report = RentalDrivingReport::where('booking_id', $booking->id)->firstOrFail();
    $snapshot = $report->snapshot;
    $snapshot['grading']['sync_incomplete'] = true;
    $report->update(['snapshot' => $snapshot]);
    overviewRental($this->owner, $this->operator, true, completedAt: '2026-11-01 10:00:00');

    $this->getJson('/admin/bookings/'.$booking->id.'/driving-analysis')->assertOk()
        ->assertJsonPath('data.grading.sync_incomplete', true);
    $this->getJson('/admin/driving-analysis')->assertOk()
        ->assertJsonPath('meta.driving_grades.'.$booking->id.'.sync_incomplete', true)
        ->assertJsonPath('meta.summary.incomplete_grades', 1);
    $this->getJson('/admin/driving-analysis/operators')->assertOk()
        ->assertJsonPath('data.0.incomplete_grades', 1)->assertJsonPath('data.0.latest_sync_incomplete', true);
});

it('validates filters and requires both management permissions', function () {
    foreach (['per_page=101', 'page=0', 'operator_id=99999999', 'search='.str_repeat('a', 161)] as $query) {
        $this->getJson('/admin/driving-analysis/operators?'.$query)->assertUnprocessable();
    }
    $staff = User::factory()->create(['is_active' => true]);
    $staff->assignRole('staff')->roles()->firstOrFail()->revokePermissionTo('view fleet tracker');
    $this->actingAs($staff, 'web')->getJson('/admin/driving-analysis/operators')->assertForbidden();
    $this->actingAs($this->owner, 'web')->getJson('/admin/driving-analysis/operators')->assertForbidden();
});

it('floors each rental score before averaging and breaks unknown completion ties by booking ID', function () {
    $low = overviewRental($this->owner, $this->operator, true, array_fill(0, 40, ['harsh_swerve', 'confirmed']));
    overviewRental($this->owner, $this->operator, true);
    $this->getJson('/admin/driving-analysis/operators')->assertOk()
        ->assertJsonPath('data.0.average_score', 50)->assertJsonPath('data.0.latest_score', 100)
        ->assertJsonPath('meta.summary.average_score', 50);
    $this->getJson('/admin/bookings/'.$low->id.'/driving-analysis')->assertOk()->assertJsonPath('data.grading.score', 0);
    $this->getJson('/admin/driving-analysis?operator_id='.$this->owner->id)->assertOk()
        ->assertJsonPath('meta.total', 0)->assertJsonPath('meta.operator_filter', null);
});

it('filters both views and KPI totals by vehicles from completed rental history', function () {
    $first = overviewRental($this->owner, $this->operator, true, [['harsh_braking', 'confirmed']]);
    $first->vehicle->update(['brand' => 'Toyota', 'name' => 'Hiace', 'model' => '2024', 'plate_number' => 'TST-HIACE']);
    $second = overviewRental($this->owner, $this->operator, true);
    $second->update(['vehicle_id' => $first->vehicle_id]);
    overviewRental($this->owner, $this->operator, true, [['harsh_cornering', 'confirmed']]);
    $ongoing = overviewRental($this->owner, $this->operator, true, status: BookingStatus::Ongoing);
    $query = '?vehicle_id='.$first->vehicle_id.'&per_page=1';
    $response = $this->getJson('/admin/driving-analysis'.$query)->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.summary.completed_rentals', 2)
        ->assertJsonPath('meta.summary.harsh_events', 1)->assertJsonPath('meta.summary.average_score', 99)
        ->assertJsonCount(2, 'meta.vehicle_options');
    $options = collect($response->json('meta.vehicle_options'))->keyBy('value');
    expect($options->get((string) $first->vehicle_id)['label'])->toBe('Toyota Hiace TST-HIACE')
        ->and($options->has((string) $ongoing->vehicle_id))->toBeFalse();
    $this->getJson('/admin/driving-analysis/operators'.$query)->assertOk()
        ->assertJsonPath('data.0.monitored_rentals', 2)->assertJsonPath('data.0.average_score', 99)
        ->assertJsonPath('data.0.latest_score', 100)->assertJsonPath('meta.summary.harsh_events', 1);
    $this->getJson('/admin/driving-analysis'.$query.'&search='.$first->booking_code)->assertOk()
        ->assertJsonPath('meta.total', 1)->assertJsonPath('meta.summary.average_score', 98)
        ->assertJsonCount(2, 'meta.vehicle_options');
    $this->getJson('/admin/driving-analysis?vehicle_id=99999999')->assertUnprocessable();
});
