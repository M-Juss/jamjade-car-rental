<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-11-11 16:00:00', 'Asia/Manila'));
    $admin = User::factory()->create();
    $admin->assignRole(UserRole::Admin->value);
    $this->actingAs($admin);
});

function periodReportBooking(User $customer, int $vehicleId, string $code, string $createdAt, array $attributes = []): Booking
{
    $booking = new Booking([
        'booking_code' => $code,
        'user_id' => $customer->id,
        'vehicle_id' => $vehicleId,
        'rental_type' => RentalType::SelfDrive,
        'rental_start_at' => '2026-11-02 08:00:00',
        'rental_end_at' => '2026-11-02 17:00:00',
        'pickup_location_type' => 'shop',
        'pickup_location' => 'Jamjade Garage',
        'return_location' => 'Jamjade Garage',
        'price_per_day' => 1500,
        'duration_days' => 1,
        'subtotal' => 1500,
        'total_amount' => 1500,
        ...$attributes,
    ]);
    $booking->created_at = $createdAt;
    $booking->save();

    return $booking;
}

function periodReportPayment(Booking $booking, string $paidAt, float $amount, string $status = 'completed'): void
{
    Payment::create([
        'booking_id' => $booking->id,
        'user_id' => $booking->user_id,
        'provider' => 'paypal',
        'status' => $status,
        'completed_at' => $paidAt,
        'amount' => $amount,
    ]);
}

function reportMetrics(array $response): array
{
    return array_column($response['metrics'], 'value', 'label');
}

it('uses Manila period boundaries and the actual dates of payments, refunds and booking outcomes', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    $oldBooking = periodReportBooking($customer, $vehicle->id, 'BK-OLD', '2026-10-15 00:00:00', [
        'status' => BookingStatus::Completed,
        'completed_at' => '2026-11-02 01:00:00',
    ]);
    $newBooking = periodReportBooking($customer, $vehicle->id, 'BK-NEW', '2026-11-01 16:00:00', [
        'status' => BookingStatus::Cancelled,
        'cancelled_at' => '2026-11-02 06:00:00',
    ]);
    $newBooking->cancellation()->create(['kind' => 'no_show', 'reason' => 'Missed pickup', 'refund_amount' => 0]);
    $refundBooking = periodReportBooking($customer, $vehicle->id, 'BK-REFUND', '2026-10-12 00:00:00');
    $refundBooking->cancellation()->create(['kind' => 'management', 'reason' => 'Booking cancelled', 'refund_amount' => 450, 'refunded_at' => '2026-11-02 03:00:00']);
    $oldBooking->cancellation()->create(['kind' => 'management', 'reason' => 'Booking cancelled', 'refund_amount' => 300, 'reviewed_at' => '2026-11-02 03:00:00']);
    periodReportPayment($oldBooking, '2026-11-01 15:59:59', 250);
    periodReportPayment($oldBooking, '2026-11-01 16:00:00', 1400.35);
    periodReportPayment($oldBooking, '2026-11-02 15:59:59', 89.65);
    periodReportPayment($oldBooking, '2026-11-02 16:00:00', 500);
    periodReportPayment($oldBooking, '2026-11-02 07:00:00', 750, 'pending');

    $result = $this->getJson('/admin/reports?period=day&date=2026-11-02')->assertOk()
        ->assertJsonPath('data.period', ['mode' => 'day', 'startDate' => '2026-11-02', 'endDate' => '2026-11-02'])
        ->assertJsonCount(24, 'data.charts.0.points')
        ->assertJsonPath('data.charts.0.points.0.net', 1400.35)
        ->assertJsonPath('data.charts.0.points.23.net', 89.65)
        ->assertJsonPath('data.charts.1.points.9.completed', 1)
        ->json('data');

    expect(reportMetrics($result))->toBe([
        'Gross receipts' => 1490,
        'Refunds paid' => 450,
        'Net receipts' => 1040,
        'Bookings created' => 1,
        'Rentals completed' => 1,
    ]);

    $bookings = $this->getJson('/admin/reports?period=day&date=2026-11-02&section=bookings')->assertOk()
        ->assertJsonPath('data.table.total', 3)
        ->assertJsonPath('data.table.rows.0.outcome', 'No-show')
        ->assertJsonPath('data.table.rows.1.booking', 'BK-OLD')
        ->json('data');
    expect(reportMetrics($bookings))->toMatchArray(['Cancellations' => 0, 'No-shows' => 1]);
});

it('generates a Monday week, a leap month and a calendar year', function () {
    $this->getJson('/admin/reports?period=week&date=2026-11-04')
        ->assertOk()->assertJsonPath('data.period.startDate', '2026-11-02')
        ->assertJsonPath('data.period.endDate', '2026-11-08')
        ->assertJsonCount(7, 'data.charts.0.points');
    $this->getJson('/admin/reports?period=month&date=2024-02-28')
        ->assertOk()->assertJsonPath('data.period.endDate', '2024-02-29')
        ->assertJsonCount(29, 'data.charts.0.points');
    $this->getJson('/admin/reports?period=year&date=2025-07-15')
        ->assertOk()->assertJsonPath('data.period.startDate', '2025-01-01')
        ->assertJsonPath('data.period.endDate', '2025-12-31')
        ->assertJsonCount(12, 'data.charts.0.points');
    $this->getJson('/admin/reports?period=month&date=2026-11-11')
        ->assertOk()->assertJsonPath('data.period.endDate', '2026-11-30')
        ->assertJsonCount(11, 'data.charts.0.points');
    $this->getJson('/admin/reports?period=hour&date=2026-11-12&section=invalid')
        ->assertUnprocessable()->assertJsonValidationErrors(['period', 'date', 'section']);
});

it('paginates the table and exports all filtered records without a spreadsheet formula', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    $vehicle->update(['name' => '=1+1']);
    $otherVehicle = availableVehicle();
    $booking = periodReportBooking($customer, $vehicle->id, 'BK-CSV', '2026-11-03 01:00:00');
    $other = periodReportBooking($customer, $otherVehicle->id, 'BK-OTHER', '2026-11-03 01:00:00', ['rental_type' => RentalType::OwnersDriver]);
    for ($index = 0; $index < 104; $index++) {
        periodReportPayment($booking, '2026-11-03 04:00:00', 12.5);
    }
    periodReportPayment($other, '2026-11-03 04:00:00', 300);
    $filters = "period=month&date=2026-11-03&section=revenue&vehicle_id={$vehicle->id}&rental_type=self_drive";

    $result = $this->getJson("/admin/reports?{$filters}&page=2")->assertOk()
        ->assertJsonCount(10, 'data.table.rows')
        ->assertJsonPath('data.table.page', 2)
        ->assertJsonPath('data.table.total', 104)
        ->assertJsonPath('data.table.lastPage', 11)
        ->json('data');
    expect(reportMetrics($result)['Gross receipts'])->toBe(1300);

    $response = $this->get("/admin/reports/csv?{$filters}&page=2")
        ->assertOk()->assertDownload('jamjade-revenue-2026-11-01-2026-11-30.csv')
        ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    $csv = $response->streamedContent();
    expect(substr_count($csv, "\n"))->toBe(105)
        ->and($csv)->toContain("BK-CSV,'=1+1", '2026-11-03T12:00:00+08:00')
        ->and($csv)->not->toContain('BK-OTHER');
});

it('searches report totals, detail rows and CSV by booking, customer and vehicle', function () {
    $customer = customerUser(['name' => 'Alma Report']);
    $otherCustomer = customerUser(['name' => 'Mika Report']);
    $vehicle = availableVehicle(['plate_number' => 'REPORT-150']);
    $otherVehicle = availableVehicle(['plate_number' => 'REPORT-250']);
    $booking = periodReportBooking($customer, $vehicle->id, 'BK-SEARCH-100%', '2026-11-03 01:00:00');
    $other = periodReportBooking($otherCustomer, $otherVehicle->id, 'BK-SEARCH-100X', '2026-11-03 01:00:00');
    periodReportPayment($booking, '2026-11-03 04:00:00', 125);
    periodReportPayment($other, '2026-11-03 04:00:00', 250);
    $filters = 'period=month&date=2026-11-03&section=revenue';

    foreach (['BK-SEARCH-100%', 'Alma Report', 'REPORT-150'] as $search) {
        $query = $filters.'&'.http_build_query(['search' => $search]);
        $result = $this->getJson("/admin/reports?{$query}")->assertOk()
            ->assertJsonPath('data.table.total', 1)
            ->assertJsonPath('data.table.rows.0.booking', 'BK-SEARCH-100%')
            ->assertJsonPath('data.charts.0.points.2.gross', 125)
            ->json('data');
        expect(reportMetrics($result)['Gross receipts'])->toBe(125);
    }

    $csv = $this->get("/admin/reports/csv?{$filters}&search=REPORT-150")->assertOk()->streamedContent();
    expect($csv)->toContain('BK-SEARCH-100%')->not->toContain('BK-SEARCH-100X');
    $this->getJson("/admin/reports?{$filters}&vehicle_id={$otherVehicle->id}&search=REPORT-150")
        ->assertOk()->assertJsonPath('data.table.total', 0);
});

it('clips fleet hours and counts returning customers and monitored rentals from existing records', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    periodReportBooking($customer, $vehicle->id, 'BK-PAST', '2026-09-14 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-09-15 01:00:00',
    ]);
    $current = periodReportBooking($customer, $vehicle->id, 'BK-CURRENT', '2026-10-30 01:00:00', [
        'status' => BookingStatus::Completed, 'started_at' => '2026-11-01 14:00:00', 'completed_at' => '2026-11-03 01:00:00',
        'rental_end_at' => '2026-11-02 03:00:00',
    ]);
    $current->returnRecord()->create(['vehicle_received_at' => '2026-11-02 04:00:00']);
    $released = periodReportBooking(customerUser(), $vehicle->id, 'BK-MONITORED', '2026-11-01 17:00:00', [
        'status' => BookingStatus::Ongoing, 'started_at' => '2026-11-02 00:00:00',
    ]);
    $trip = $released->telematicsTrips()->create([
        'operator_user_id' => $released->user_id, 'status' => 'started', 'started_at' => '2026-11-02 00:05:00',
    ]);
    DB::table('telematics_events')->insert([
        ['trip_id' => $trip->id, 'event_type' => 'geofence_exit', 'occurred_at' => '2026-11-02 03:00:00'],
        ['trip_id' => $trip->id, 'event_type' => 'gps_unavailable', 'occurred_at' => '2026-11-02 05:00:00'],
        ['trip_id' => $trip->id, 'event_type' => 'trip_started', 'occurred_at' => '2026-11-02 00:05:00'],
    ]);

    $fleet = $this->getJson('/admin/reports?section=fleet&period=day&date=2026-11-02')
        ->assertOk()->assertJsonPath('data.table.rows.0.rented', 12)->json('data');
    expect(reportMetrics($fleet))->toMatchArray(['Hours rented' => 12, 'Late returns' => 1]);

    $this->getJson('/admin/reports?section=customers&period=month&date=2026-11-02')
        ->assertOk()->assertJsonPath('data.charts.0.points.2.returning', 1)
        ->assertJsonPath('data.table.rows.0.first_completed', '2026-09-15T01:00:00.000000Z');

    $risk = $this->getJson('/admin/reports?section=telematics&period=day&date=2026-11-02')->assertOk()
        ->assertJsonPath('data.table.total', 2)->assertJsonMissingPath('data.table.rows.0.latitude')->json('data');
    expect(reportMetrics($risk))->toBe([
        'Rentals released' => 1, 'Monitoring started' => 1, 'Geofence exits' => 1, 'Monitoring interruptions' => 1,
    ]);
});

it('applies report permissions to analytics and CSV exports', function () {
    $staff = User::factory()->create();
    $staff->assignRole(UserRole::Staff->value);
    $staff->givePermissionTo('view reports');
    $this->actingAs($staff)->getJson('/admin/reports?period=day&date=2026-11-02')->assertOk();
    $this->actingAs($staff)->get('/admin/reports/csv?period=day&date=2026-11-02')->assertOk();
    $this->actingAs(customerUser())->getJson('/admin/reports?period=day&date=2026-11-02')->assertForbidden();
    $this->actingAs(customerUser())->get('/admin/reports/csv?period=day&date=2026-11-02')->assertForbidden();
});
