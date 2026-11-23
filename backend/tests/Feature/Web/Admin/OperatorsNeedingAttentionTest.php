<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\RentalDrivingReport;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-11-22 12:00:00', 'Asia/Manila'));
    $this->actingAs(vehicleManagerUser());
});

function attentionRental(User $customer, ?User $operator, ?int $score, string $completedAt = '2026-11-10 01:00:00', array $attributes = [], bool $incomplete = false): Booking
{
    $booking = Booking::create([
        'booking_code' => 'BK-ATTN-'.Str::upper(Str::random(8)), 'user_id' => $customer->id,
        'vehicle_id' => availableVehicle()->id, 'rental_type' => RentalType::SelfDrive,
        'status' => BookingStatus::Completed, 'completed_at' => $completedAt,
        'rental_start_at' => '2026-11-09 01:00:00', 'rental_end_at' => '2026-11-10 01:00:00',
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'price_per_day' => 1500, 'duration_days' => 1, 'subtotal' => 1500, 'total_amount' => 1500, ...$attributes,
    ]);
    if ($operator) {
        $booking->telematicsTrips()->create(['operator_user_id' => $operator->id, 'status' => 'ended']);
    }
    RentalDrivingReport::create([
        'booking_id' => $booking->id, 'score' => $score, 'confirmed_events' => $score === null ? 0 : 3,
        'finalized_at' => now(),
        'snapshot' => ['grading' => ['score' => $score, 'status' => $score === null ? 'not_graded' : 'final',
            'maximum' => 100, 'confirmed_events' => $score === null ? 0 : 3, 'deductions' => $score === null ? 0 : 100 - $score,
            'sync_incomplete' => $incomplete]],
    ]);

    return $booking;
}

function attentionReportUrl(array $filters = []): string
{
    return '/admin/reports?'.http_build_query(['section' => 'telematics', 'period' => 'month', 'date' => '2026-11-22', ...$filters]);
}

it('flags only below-threshold final averages and orders lowest first with exact graded counts', function () {
    $customer = customerUser();
    $average = customerUser(['name' => 'Average Operator']);
    $lower = customerUser(['name' => 'Lower Operator']);
    attentionRental($customer, $average, 40, '2026-11-01 01:00:00');
    attentionRental($customer, $average, 80, '2026-11-02 01:00:00', incomplete: true);
    attentionRental($customer, $average, null);
    attentionRental($customer, $lower, 58);
    attentionRental($customer, customerUser(), 70);
    attentionRental($customer, customerUser(), 100);
    attentionRental($customer, customerUser(), null);
    attentionRental($customer, null, 0);
    attentionRental($customer, $average, 0, attributes: ['status' => BookingStatus::Returned]);
    attentionRental($customer, $average, 0, attributes: ['status' => BookingStatus::Ongoing]);
    attentionRental($customer, $average, 0)->delete();
    attentionRental($customer, $average, 0, '2026-10-01 01:00:00');

    $this->getJson(attentionReportUrl())->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.operatorAttention.threshold', 70)->assertJsonPath('data.operatorAttention.total', 2)
        ->assertJsonPath('data.operatorAttention.operators.0.id', $lower->id)
        ->assertJsonPath('data.operatorAttention.operators.1.average_score', 60)
        ->assertJsonPath('data.operatorAttention.operators.1.monitored_rentals', 2)
        ->assertJsonPath('data.operatorAttention.operators.1.latest_score', 80)
        ->assertJsonPath('data.operatorAttention.operators.1.harsh_events', 6)
        ->assertJsonPath('data.operatorAttention.operators.1.incomplete_grades', 1)
        ->assertJsonPath('data.operatorAttention.operators.1.latest_sync_incomplete', true);
});

it('separates Customer and Driver roles and uses the recorded operator instead of the booking owner', function () {
    $customer = customerUser();
    $operator = createDriverUser(['name' => 'Recorded Operator']);
    attentionRental($customer, $operator, 40);
    $assigned = attentionRental($customer, $operator, 58, attributes: ['rental_type' => RentalType::OwnersDriver]);
    $this->getJson(attentionReportUrl(['search' => 'Recorded Operator']))->assertOk()
        ->assertJsonPath('data.operatorAttention.total', 2)
        ->assertJsonPath('data.operatorAttention.operators.0.id', $operator->id)
        ->assertJsonPath('data.operatorAttention.operators.0.operator_type', 'customer')
        ->assertJsonPath('data.operatorAttention.operators.0.average_score', 40)
        ->assertJsonPath('data.operatorAttention.operators.1.operator_type', 'driver')
        ->assertJsonPath('data.operatorAttention.operators.1.average_score', 58);
    $this->getJson(attentionReportUrl(['rental_type' => 'owners_driver']))->assertOk()
        ->assertJsonPath('data.operatorAttention.total', 1)->assertJsonPath('data.operatorAttention.operators.0.operator_type', 'driver');
    $this->getJson('/admin/driving-analysis?'.http_build_query(['operator_id' => $operator->id, 'operator_type' => 'driver',
        'period' => 'month', 'date' => '2026-11-22', 'graded_only' => 1]))->assertOk()
        ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.backendId', $assigned->id);
});

it('uses completion dates with Manila boundaries and preserves the same grade-only drilldown scope', function () {
    $customer = customerUser();
    $operator = customerUser();
    $included = attentionRental($customer, $operator, 58, '2026-10-31 16:00:00');
    attentionRental($customer, $operator, 0, '2026-10-31 15:59:59');
    attentionRental($customer, $operator, 0, '2026-11-22 04:00:00');
    attentionRental($customer, $operator, null);
    $this->getJson(attentionReportUrl())->assertOk()->assertJsonPath('data.operatorAttention.operators.0.average_score', 58)
        ->assertJsonPath('data.operatorAttention.operators.0.monitored_rentals', 1);
    $this->getJson('/admin/driving-analysis?'.http_build_query(['operator_id' => $operator->id, 'period' => 'month',
        'date' => '2026-11-22', 'graded_only' => 1]))->assertOk()->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.backendId', $included->id)->assertJsonPath('meta.summary.average_score', 58);
});

it('applies literal search and vehicle filters before averages and matches drilldown results', function () {
    $customer = customerUser();
    $operator = customerUser(['name' => 'Operator 100%']);
    $low = attentionRental($customer, $operator, 58);
    attentionRental($customer, $operator, 100);
    attentionRental($customer, customerUser(['name' => 'Operator 100X']), 10);
    $this->getJson(attentionReportUrl(['search' => '100%']))->assertOk()->assertJsonPath('data.operatorAttention.total', 0);
    $this->getJson(attentionReportUrl(['search' => '100%', 'vehicle_id' => $low->vehicle_id]))->assertOk()
        ->assertJsonPath('data.operatorAttention.total', 1)->assertJsonPath('data.operatorAttention.operators.0.average_score', 58);
    $this->getJson('/admin/driving-analysis?'.http_build_query(['operator_id' => $operator->id, 'period' => 'month',
        'date' => '2026-11-22', 'graded_only' => 1, 'vehicle_id' => $low->vehicle_id, 'search' => '100%']))->assertOk()->assertJsonPath('meta.total', 1);
    foreach (['brand' => 'AttentionBrand', 'model' => 'AttentionModel'] as $column => $value) {
        $low->vehicle->update([$column => $value]);
        $this->getJson(attentionReportUrl(['search' => $value]))->assertOk()->assertJsonPath('data.operatorAttention.total', 1);
        $this->getJson('/admin/driving-analysis?'.http_build_query(['operator_id' => $operator->id, 'period' => 'month',
            'date' => '2026-11-22', 'graded_only' => 1, 'search' => $value]))->assertOk()->assertJsonPath('meta.total', 1);
    }
});

it('paginates operators independently of the event log and does not invent rows for empty reports', function () {
    $this->getJson(attentionReportUrl())->assertOk()->assertJsonPath('data.operatorAttention.total', 0)->assertJsonCount(0, 'data.operatorAttention.operators');
    $customer = customerUser();
    foreach (range(1, 11) as $index) {
        attentionRental($customer, customerUser(['name' => 'Operator '.$index]), $index);
    }
    $this->getJson(attentionReportUrl())->assertOk()->assertJsonCount(10, 'data.operatorAttention.operators')
        ->assertJsonPath('data.operatorAttention.total', 11)->assertJsonPath('data.operatorAttention.lastPage', 2)
        ->assertJsonPath('data.operatorAttention.operators.0.average_score', 1);
    $this->getJson(attentionReportUrl(['page' => 2, 'operator_page' => 2]))->assertOk()->assertJsonCount(1, 'data.operatorAttention.operators')
        ->assertJsonPath('data.operatorAttention.page', 2)->assertJsonPath('data.table.page', 2)
        ->assertJsonPath('data.operatorAttention.operators.0.average_score', 11);
});

it('validates pagination and report-scope filters and preserves report and driving permissions', function () {
    $this->getJson(attentionReportUrl(['operator_page' => 0]))->assertUnprocessable()->assertJsonValidationErrors('operator_page');
    foreach (['period=month', 'date=2026-11-22', 'period=hour&date=2026-11-22', 'period=month&date=2026-02-30',
        'period=month&date=2026-11-23', 'period=month&date=1899-12-31', 'graded_only=yes'] as $query) {
        $this->getJson('/admin/driving-analysis?'.$query)->assertUnprocessable();
    }
    $staff = User::factory()->create();
    $staff->assignRole('staff')->roles()->firstOrFail()->syncPermissions(['view reports']);
    $this->actingAs($staff)->getJson(attentionReportUrl())->assertOk()->assertJsonMissingPath('data.operatorAttention');
    $this->getJson('/admin/driving-analysis?period=month&date=2026-11-22&graded_only=1')->assertForbidden();
    $staff->givePermissionTo(['manage bookings', 'view fleet tracker']);
    $this->getJson(attentionReportUrl())->assertOk()->assertJsonPath('data.operatorAttention.total', 0);
    $this->actingAs(customerUser())->getJson(attentionReportUrl())->assertForbidden();
});

it('uses the existing displayed average precision at the attention threshold', function () {
    $customer = customerUser();
    $operator = customerUser();
    foreach (range(1, 24) as $index) {
        attentionRental($customer, $operator, $index === 1 ? 69 : 70);
    }
    // 69.9583 displays as 70.0 in Driving Analysis, so it is not flagged below 70.0.
    $this->getJson(attentionReportUrl())->assertOk()->assertJsonPath('data.operatorAttention.total', 0);
});
