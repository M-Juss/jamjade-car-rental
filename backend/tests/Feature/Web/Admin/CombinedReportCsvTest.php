<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\RentalDrivingReport;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-11-25 12:00:00', 'Asia/Manila'));
    $this->actingAs(vehicleManagerUser());
});

function combinedCsvBooking(User $customer, int $vehicleId, string $code, array $attributes = []): Booking
{
    return Booking::create([
        'booking_code' => $code, 'user_id' => $customer->id, 'vehicle_id' => $vehicleId,
        'rental_type' => RentalType::SelfDrive, 'status' => BookingStatus::Completed, 'completed_at' => '2026-11-20 01:00:00',
        'rental_start_at' => '2026-11-19 01:00:00', 'rental_end_at' => '2026-11-20 01:00:00',
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'price_per_day' => 1500, 'duration_days' => 1, 'subtotal' => 1500, 'total_amount' => 1500, ...$attributes,
    ]);
}

function combinedCsvUrl(array $filters = []): string
{
    return '/admin/reports/csv?'.http_build_query(['export_scope' => 'all', 'period' => 'month', 'date' => '2026-11-25', ...$filters]);
}

function combinedCsvRows(string $csv): array
{
    $stream = fopen('php://temp', 'w+');
    fwrite($stream, substr($csv, 3));
    rewind($stream);
    $rows = [];
    while (($row = fgetcsv($stream, null, ',', '"', '')) !== false) {
        $rows[] = $row;
    }
    fclose($stream);

    return $rows;
}

it('exports all accessible tabs with labeled sections and records beyond page one', function () {
    $customer = customerUser();
    $vehicle = availableVehicle(['name' => 'Combined CSV car']);
    foreach (range(1, 12) as $index) {
        combinedCsvBooking($customer, $vehicle->id, 'BK-ALL-'.$index);
    }
    $refund = combinedCsvBooking($customer, $vehicle->id, 'BK-REFUND', ['status' => BookingStatus::Cancelled, 'completed_at' => null]);
    $refund->cancellation()->create(['kind' => 'management', 'reason' => 'Cancelled', 'refund_amount' => 150, 'refunded_at' => '2026-11-20 01:00:00']);
    $csv = $this->get(combinedCsvUrl(['page' => 2, 'per_page' => 1]))->assertOk()
        ->assertDownload('JamJade-Reports-and-Analytics-Month-Nov-2026.csv')
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')->assertHeader('Cache-Control', 'no-store, private')->streamedContent();
    expect(str_starts_with($csv, "\xEF\xBB\xBF"))->toBeTrue()->and(str_contains($csv, "\r\n"))->toBeTrue();
    $rows = combinedCsvRows($csv);
    foreach (['Overview', 'Revenue', 'Bookings', 'Fleet Performance', 'Customer Insights', 'Risk & Telematics'] as $section) {
        expect($rows)->toContain([$section]);
    }
    expect($rows)->toContain(['Metric', 'Value', 'Unit'], ['Rentals completed', '12', 'Count'],
        ['Period', 'Nov 1, 2026 - Nov 30, 2026'], ['Currency', 'PHP'], ['Net receipts', '-150.00', 'PHP'], ['Most rented vehicles'], ['No records found.']);
    $bookings = array_values(array_filter($rows, fn ($row) => isset($row[1]) && str_starts_with($row[1], 'BK-ALL-')));
    expect($bookings)->toHaveCount(12)->and(count($bookings[0]))->toBe(5)
        ->and($bookings[0][0])->toBe('Nov 20, 2026, 9:00 AM')->and($bookings[0][2])->toBe('Combined CSV car');
    expect($csv)->not->toContain('Last completed rental', 'UTC+8', 'Asia/Manila');
});

it('applies period vehicle rental type and literal search across exported sections', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    $match = combinedCsvBooking($customer, $vehicle->id, 'BK-SCOPE-100%');
    combinedCsvBooking($customer, $vehicle->id, 'BK-SCOPE-100X');
    combinedCsvBooking($customer, $vehicle->id, 'BK-SCOPE-100%-PAST', ['completed_at' => '2026-10-31 15:59:59']);
    combinedCsvBooking($customer, $vehicle->id, 'BK-SCOPE-100%-DRIVER', ['rental_type' => RentalType::OwnersDriver]);
    combinedCsvBooking($customer, availableVehicle()->id, 'BK-SCOPE-100%-VEHICLE');
    Payment::create(['booking_id' => $match->id, 'user_id' => $customer->id, 'status' => 'completed',
        'provider' => 'paypal', 'currency' => 'PHP', 'amount' => 1500, 'completed_at' => '2026-11-20 01:00:00']);
    $csv = $this->get(combinedCsvUrl(['search' => '100%', 'vehicle_id' => $vehicle->id, 'rental_type' => 'self_drive']))->assertOk()->streamedContent();
    expect($csv)->toContain('BK-SCOPE-100%', '1500.00')->not->toContain('BK-SCOPE-100X', 'BK-SCOPE-100%-PAST', 'BK-SCOPE-100%-DRIVER', 'BK-SCOPE-100%-VEHICLE');
    expect(combinedCsvRows($csv))->toContain(['Rentals completed', '1', 'Count'], ['Gross receipts', '1500.00', 'PHP'], ['Rental type', 'Self Drive']);
    $vehicle->delete();
    $archived = $this->get(combinedCsvUrl(['vehicle_id' => $vehicle->id]))->assertOk()->streamedContent();
    expect($archived)->toContain('BK-SCOPE-100%')->and(combinedCsvRows($archived))->toContain(['Vehicle', $vehicle->name.' ('.$vehicle->plate_number.')']);
});

it('keeps commas quotes and multiline text in cells and neutralizes formulas', function () {
    $name = "=SUM(1,2)\n\"Quoted customer\"";
    $customer = customerUser(['name' => $name]);
    $vehicle = availableVehicle(['name' => 'Car, "quoted"']);
    combinedCsvBooking($customer, $vehicle->id, 'BK-CSV-CELLS');
    $rows = combinedCsvRows($this->get(combinedCsvUrl())->assertOk()->streamedContent());
    $record = collect($rows)->first(fn ($row) => $row[0] === "'".$name);
    expect($record)->not->toBeNull()->and($record[1])->toBe('1')->and($record[4])->toContain('Car, "quoted"');
});

it('exports every below-threshold operator and incomplete sync context across pages', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    foreach (range(1, 11) as $index) {
        $operator = customerUser(['name' => 'CSV Operator '.$index]);
        $booking = combinedCsvBooking($customer, $vehicle->id, 'BK-OPERATOR-'.$index);
        $booking->telematicsTrips()->create(['operator_user_id' => $operator->id, 'status' => 'ended']);
        RentalDrivingReport::create(['booking_id' => $booking->id, 'score' => 50, 'confirmed_events' => 1, 'finalized_at' => now(),
            'snapshot' => ['grading' => ['sync_incomplete' => true], 'maneuvers' => ['harsh_acceleration' => 1]]]);
    }
    $rows = combinedCsvRows($this->get(combinedCsvUrl(['operator_page' => 2]))->assertOk()->streamedContent());
    $operators = array_values(array_filter($rows, fn ($row) => str_starts_with($row[0] ?? '', 'CSV Operator ')));
    expect($operators)->toHaveCount(11)->and($operators[0])->toHaveCount(8)->and($operators[0][6])->toBe('1')->and($operators[0][7])->toBe('Yes');
    expect($rows)->toContain(['Harsh acceleration', '11', 'Count']);
});

it('limits export sections by permissions and validates export-only options', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff')->roles()->firstOrFail()->syncPermissions(['view reports']);
    $rows = combinedCsvRows($this->actingAs($staff)->get(combinedCsvUrl())->assertOk()->streamedContent());
    expect($rows)->toContain(['Bookings'], ['Risk & Telematics'])
        ->not->toContain(['Overview'], ['Revenue'], ['Fleet Performance'], ['Customer Insights'], ['Operators needing attention (Below 70)']);
    $this->get(combinedCsvUrl(['section' => 'revenue']))->assertForbidden();
    $this->getJson(combinedCsvUrl(['export_scope' => 'invalid']))->assertUnprocessable()->assertJsonValidationErrors('export_scope');
    $this->getJson('/admin/reports?section=bookings&export_scope=all')->assertUnprocessable()->assertJsonValidationErrors('export_scope');
    $this->actingAs(customerUser())->get(combinedCsvUrl())->assertForbidden();
});

it('names the combined file from the selected calendar timeframe', function (string $period, string $date, string $range) {
    $this->get(combinedCsvUrl(['period' => $period, 'date' => $date]))->assertOk()
        ->assertDownload('JamJade-Reports-and-Analytics-'.$range.'.csv');
})->with([
    ['day', '2026-11-25', 'Day-Nov-25-2026'],
    ['week', '2026-11-25', 'Week-Nov-23-2026-to-Nov-29-2026'],
    ['week', '2026-01-01', 'Week-Dec-29-2025-to-Jan-04-2026'],
    ['month', '2024-02-29', 'Month-Feb-2024'],
    ['year', '2026-11-25', 'Year-2026'],
]);
