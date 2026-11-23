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
    $admin->assignRole(UserRole::Owner->value);
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
        ->assertJsonPath('data.charts.1.points.0.completed', 1)
        ->json('data');

    expect(reportMetrics($result))->toBe([
        'Net receipts' => 1040,
        'Rentals completed' => 1,
        'Customers served' => 1,
        'Cancellations' => 0,
    ]);

    $bookings = $this->getJson('/admin/reports?period=day&date=2026-11-02&section=bookings')->assertOk()
        ->assertJsonPath('data.table.total', 2)
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

it('summarizes completed rentals and customers without duplicating financial detail on Overview', function () {
    $customer = customerUser();
    $otherCustomer = customerUser();
    $vehicle = availableVehicle(['name' => 'Vios', 'plate_number' => 'OVERVIEW-01']);
    $otherVehicle = availableVehicle(['name' => 'Innova', 'plate_number' => 'OVERVIEW-02']);
    $first = periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-1', '2026-10-10 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-02 01:00:00',
    ]);
    periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-2', '2026-10-10 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-03 01:00:00', 'rental_type' => RentalType::OwnersDriver,
    ]);
    periodReportBooking($otherCustomer, $vehicle->id, 'BK-OVERVIEW-3', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-03 02:00:00',
    ]);
    periodReportBooking($customer, $otherVehicle->id, 'BK-OVERVIEW-4', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-03 03:00:00',
    ]);
    $cancelled = periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-CANCELLED', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Cancelled, 'cancelled_at' => '2026-11-04 01:00:00',
    ]);
    $noShow = periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-NO-SHOW', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Cancelled, 'cancelled_at' => '2026-11-04 02:00:00',
    ]);
    $noShow->cancellation()->create(['kind' => 'no_show', 'reason' => 'No collection']);
    periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-REJECTED', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Rejected, 'rejected_at' => '2026-11-04 03:00:00',
    ]);
    $pending = periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-PENDING', '2026-11-01 01:00:00');
    periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-PAST', '2026-10-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-10-02 01:00:00',
    ]);
    $deleted = periodReportBooking($customer, $vehicle->id, 'BK-OVERVIEW-DELETED', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-05 01:00:00',
    ]);
    $deleted->delete();
    $duplicate = $first->events()->create(['event_type' => 'status_changed', 'new_status' => 'completed']);
    $duplicate->forceFill(['created_at' => '2026-11-02 02:00:00'])->saveQuietly();
    periodReportPayment($first, '2026-11-02 01:00:00', 1500);
    periodReportPayment($pending, '2026-11-02 01:00:00', 500);
    $cancelled->cancellation()->create(['kind' => 'management', 'reason' => 'Changed plans', 'refund_amount' => 200, 'refunded_at' => '2026-11-04 01:00:00']);

    $query = 'period=month&date=2026-11-02';
    $data = $this->getJson('/admin/reports?'.$query)->assertOk()->assertJsonPath('data.table', null)->json('data');
    expect(reportMetrics($data))->toBe(['Net receipts' => 1800, 'Rentals completed' => 4, 'Customers served' => 2, 'Cancellations' => 1])
        ->and(array_column($data['charts'], 'title'))->toBe(['Receipts over time', 'Most booked vehicles'])
        ->and($data['charts'][1]['points'])->toBe([
            ['label' => 'Vios (OVERVIEW-01)', 'completed' => 3], ['label' => 'Innova (OVERVIEW-02)', 'completed' => 1],
        ]);
    $csv = $this->get('/admin/reports/csv?'.$query)->assertOk()->streamedContent();
    $lines = explode("\n", trim(substr($csv, 3)));
    $columns = str_getcsv(array_shift($lines), ',', '"', '');
    $rows = collect($lines)->map(fn ($line) => array_combine($columns, str_getcsv($line, ',', '"', '')))->keyBy('Period');
    expect($rows->get('Nov 2')['Rentals completed'])->toBe('1')
        ->and($rows->get('Nov 3')['Rentals completed'])->toBe('3')
        ->and($rows->get('Nov 3')['Self Drive'])->toBe('2')
        ->and($rows->get('Nov 3')['Assigned Driver'])->toBe('1')
        ->and($rows->get('Nov 3')['Customers served'])->toBe('2')
        ->and($rows->get('Nov 4')['Cancellations'])->toBe('1')
        ->and($columns)->not->toContain('Bookings created');
    $this->getJson('/admin/reports?'.$query.'&vehicle_id='.$otherVehicle->id)->assertOk()
        ->assertJsonPath('data.metrics.1.value', 1)->assertJsonPath('data.metrics.2.value', 1)->assertJsonPath('data.metrics.3.value', 0);
    $this->getJson('/admin/reports?'.$query.'&rental_type=owners_driver')->assertOk()
        ->assertJsonPath('data.metrics.1.value', 1)->assertJsonPath('data.charts.1.points.0.completed', 1);
    $this->getJson('/admin/reports?'.$query.'&search=BK-OVERVIEW-4')->assertOk()
        ->assertJsonPath('data.metrics.1.value', 1)->assertJsonPath('data.charts.1.points.0.label', 'Innova (OVERVIEW-02)');
    $empty = $this->getJson('/admin/reports?'.$query.'&search=Nobody')->assertOk()
        ->assertJsonCount(0, 'data.charts.1.points')->json('data');
    expect(reportMetrics($empty))->toBe(['Net receipts' => 0, 'Rentals completed' => 0, 'Customers served' => 0, 'Cancellations' => 0]);
    $revenue = $this->getJson('/admin/reports?'.$query.'&section=revenue')->assertOk()->json('data');
    expect(reportMetrics($revenue))->toBe(['Net receipts' => 1800, 'Payments received' => 2, 'Bookings with payments' => 2, 'Average payment' => 1000])
        ->and($revenue['metrics'][0]['details'])->toBe([
            ['label' => 'Gross receipts', 'value' => 2000, 'format' => 'money'],
            ['label' => 'Refunds paid', 'value' => 200, 'format' => 'money'],
        ]);
});

it('limits the completed vehicle ranking to five with deterministic ties and period boundaries', function () {
    $customer = customerUser();
    foreach (range(1, 6) as $index) {
        $vehicle = availableVehicle(['name' => 'Vehicle '.$index, 'plate_number' => 'OVERVIEW-'.$index]);
        periodReportBooking($customer, $vehicle->id, 'BK-RANK-'.$index, '2026-10-01 01:00:00', [
            'status' => BookingStatus::Completed, 'completed_at' => '2026-11-01 16:00:00',
        ]);
    }
    $this->getJson('/admin/reports?period=day&date=2026-11-02')->assertOk()
        ->assertJsonPath('data.metrics.1.value', 6)->assertJsonPath('data.metrics.2.value', 1)
        ->assertJsonCount(5, 'data.charts.1.points')->assertJsonPath('data.charts.1.points.0.label', 'Vehicle 1 (OVERVIEW-1)')
        ->assertJsonPath('data.charts.1.points.4.label', 'Vehicle 5 (OVERVIEW-5)');
    $this->getJson('/admin/reports?period=day&date=2026-11-01')->assertOk()
        ->assertJsonPath('data.metrics.1.value', 0)->assertJsonCount(0, 'data.charts.1.points');
});

it('lists one final status per booking in the report table and CSV while keeping created metrics', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    $finals = [];
    foreach (BookingStatus::terminalValues() as $status) {
        $booking = periodReportBooking($customer, $vehicle->id, 'BK-FINAL-'.$status, '2026-11-02 00:00:00', ['status' => $status]);
        $event = $booking->events()->create(['event_type' => 'status_changed', 'new_status' => $status]);
        $event->forceFill(['created_at' => '2026-11-02 02:00:00'])->saveQuietly();
        $finals[$status] = $booking;
    }
    $duplicate = $finals['completed']->events()->create(['event_type' => 'status_changed', 'new_status' => 'completed']);
    $duplicate->forceFill(['created_at' => '2026-11-02 03:00:00'])->saveQuietly();
    foreach ([BookingStatus::Pending, BookingStatus::Confirmed, BookingStatus::Ongoing, BookingStatus::Returned] as $status) {
        periodReportBooking($customer, $vehicle->id, 'BK-OPEN-'.$status->value, '2026-11-02 00:00:00', ['status' => $status]);
    }
    $deleted = periodReportBooking($customer, $vehicle->id, 'BK-FINAL-DELETED', '2026-11-02 00:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-02 04:00:00',
    ]);
    $deleted->delete();
    periodReportBooking($customer, $vehicle->id, 'BK-FINAL-UNDATED', '2026-11-02 00:00:00', ['status' => BookingStatus::Completed]);
    periodReportBooking($customer, $vehicle->id, 'BK-FINAL-OUTSIDE', '2026-11-02 00:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-03 02:00:00',
    ]);

    $query = 'section=bookings&period=day&date=2026-11-02';
    $data = $this->getJson('/admin/reports?'.$query)->assertOk()
        ->assertJsonPath('data.table.total', 4)->assertJsonPath('data.table.columns.4.label', 'Status')->json('data');
    $rows = collect($data['table']['rows'])->keyBy('booking');
    expect($rows->keys()->sort()->values()->all())->toBe(collect($finals)->pluck('booking_code')->sort()->values()->all())
        ->and($rows->pluck('outcome')->sort()->values()->all())->toBe(['Cancelled', 'Completed', 'No-show', 'Rejected'])
        ->and($rows->get('BK-FINAL-completed')['occurred_at'])->toBe('2026-11-02T03:00:00.000000Z')
        ->and(reportMetrics($data)['Bookings created'])->toBe(10);
    $this->getJson('/admin/reports?'.$query.'&per_page=2')->assertOk()->assertJsonCount(2, 'data.table.rows')
        ->assertJsonPath('data.table.total', 4)->assertJsonPath('data.table.lastPage', 2);
    $this->getJson('/admin/reports?'.$query.'&per_page=2&page=2')->assertOk()->assertJsonCount(2, 'data.table.rows');
    $csv = $this->get('/admin/reports/csv?'.$query.'&page=2')->assertOk()->streamedContent();
    expect(substr_count($csv, "\n"))->toBe(5)
        ->and(substr_count($csv, 'BK-FINAL-completed'))->toBe(1)
        ->and($csv)->toContain('Status', 'No-show')->not->toContain('Created', 'BK-OPEN-', 'BK-FINAL-DELETED', 'BK-FINAL-UNDATED', 'BK-FINAL-OUTSIDE');
});

it('filters final booking rows by the final date, search, vehicle and rental type', function () {
    $customer = customerUser();
    $vehicle = availableVehicle();
    $booking = periodReportBooking($customer, $vehicle->id, 'BK-FINAL-OLD-CREATION', '2026-10-10 01:00:00', [
        'status' => BookingStatus::Rejected, 'rejected_at' => '2026-11-01 16:00:00', 'rental_type' => RentalType::OwnersDriver,
    ]);
    periodReportBooking($customer, availableVehicle()->id, 'BK-FINAL-OTHER', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-02 01:00:00',
    ]);
    $query = 'section=bookings&period=day&date=2026-11-02&vehicle_id='.$vehicle->id.'&rental_type=owners_driver&search=OLD-CREATION';
    $data = $this->getJson('/admin/reports?'.$query)->assertOk()->assertJsonPath('data.table.total', 1)
        ->assertJsonPath('data.table.rows.0.booking', $booking->booking_code)->assertJsonPath('data.table.rows.0.outcome', 'Rejected')->json('data');
    expect(reportMetrics($data)['Bookings created'])->toBe(0);
    $this->getJson('/admin/reports?'.$query.'&page=2')->assertOk()->assertJsonCount(0, 'data.table.rows');
    $this->getJson('/admin/reports?section=bookings&period=day&date=2026-11-01&search=OLD-CREATION')->assertOk()
        ->assertJsonPath('data.table.total', 0);
    $csv = $this->get('/admin/reports/csv?'.$query)->assertOk()->streamedContent();
    expect($csv)->toContain('BK-FINAL-OLD-CREATION', '2026-11-02T00:00:00+08:00')->not->toContain('BK-FINAL-OTHER');
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
    expect($result['metrics'][0]['details'][0]['value'])->toBe(1300);

    $response = $this->get("/admin/reports/csv?{$filters}&page=2")
        ->assertOk()->assertDownload('jamjade-revenue-2026-11-01-2026-11-30.csv')
        ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    $csv = $response->streamedContent();
    expect(substr_count($csv, "\n"))->toBe(105)
        ->and($csv)->toContain("BK-CSV,'=1+1", '2026-11-03T12:00:00+08:00')
        ->and($csv)->not->toContain('BK-OTHER');
});

it('reconciles Revenue purposes, vehicle cash and distinct paid bookings across all pages', function () {
    $customer = customerUser();
    $vehicle = availableVehicle(['name' => 'Vios', 'plate_number' => 'REVENUE-1']);
    $otherVehicle = availableVehicle(['name' => 'Vios', 'plate_number' => 'REVENUE-2']);
    $first = periodReportBooking($customer, $vehicle->id, 'BK-REVENUE-1', '2026-10-01 01:00:00');
    $second = periodReportBooking($customer, $otherVehicle->id, 'BK-REVENUE-2', '2026-10-01 01:00:00');
    foreach ([['down_payment', 500.25], ['remaining_balance', 100.25], ['customer_outstanding', 50], ['driver_outstanding', 25], [null, 10], ['unknown_purpose', 10]] as [$purpose, $amount]) {
        Payment::create(['booking_id' => $first->id, 'user_id' => $customer->id, 'provider' => 'paypal', 'purpose' => $purpose,
            'status' => 'completed', 'currency' => 'PHP', 'amount' => $amount, 'completed_at' => '2026-11-02 01:00:00']);
    }
    $legacyPayment = Payment::create(['booking_id' => $second->id, 'user_id' => $customer->id, 'provider' => 'manual', 'purpose' => 'manual_booking_payment',
        'status' => 'completed', 'currency' => 'PHP', 'amount' => 300, 'completed_at' => null]);
    $legacyPayment->forceFill(['created_at' => '2026-11-02 01:00:00'])->saveQuietly();
    foreach ([['status' => 'pending'], ['status' => 'failed'], ['currency' => 'USD'], ['amount' => 0], ['amount' => -10], ['completed_at' => '2026-11-02 16:00:00']] as $excluded) {
        Payment::create(['booking_id' => $first->id, 'user_id' => $customer->id, 'provider' => 'paypal',
            'status' => 'completed', 'currency' => 'PHP', 'amount' => 900, 'completed_at' => '2026-11-02 01:00:00', ...$excluded]);
    }
    $first->cancellation()->create(['kind' => 'management', 'reason' => 'Paid refund', 'refund_amount' => 100.25, 'refunded_at' => '2026-11-02 02:00:00']);
    $second->cancellation()->create(['kind' => 'management', 'reason' => 'Unpaid decision', 'refund_amount' => 200, 'reviewed_at' => '2026-11-02 02:00:00']);
    $second->delete();
    $query = 'section=revenue&period=day&date=2026-11-02&per_page=1';
    $data = $this->getJson('/admin/reports?'.$query)->assertOk()->assertJsonPath('data.table.total', 8)->json('data');
    expect(reportMetrics($data))->toBe(['Net receipts' => 895.25, 'Payments received' => 7, 'Bookings with payments' => 2, 'Average payment' => 142.21])
        ->and($data['metrics'][0]['details'][0]['value'])->toBe(995.5)
        ->and($data['metrics'][0]['details'][1]['value'])->toBe(100.25)
        ->and(collect($data['charts'][0]['points'])->sum('gross'))->toBe(995.5)
        ->and(collect($data['charts'][0]['points'])->keyBy('label')->get('Other payments')['gross'])->toBe(20)
        ->and($data['charts'][1]['points'])->toBe([
            ['label' => 'Vios (REVENUE-1)', 'net' => 595.25], ['label' => 'Vios (REVENUE-2)', 'net' => 300],
        ]);
    $this->getJson('/admin/reports?'.$query.'&page=2')->assertOk()->assertJsonPath('data.metrics', $data['metrics'])
        ->assertJsonPath('data.charts', $data['charts']);
    $this->getJson('/admin/reports?'.$query.'&vehicle_id='.$vehicle->id)->assertOk()
        ->assertJsonPath('data.metrics.0.value', 595.25)->assertJsonPath('data.metrics.2.value', 1);
    $this->getJson('/admin/reports?'.$query.'&search=BK-REVENUE-2')->assertOk()
        ->assertJsonPath('data.metrics.0.value', 300)->assertJsonPath('data.metrics.1.value', 1)
        ->assertJsonPath('data.charts.0.points.0.label', 'Manual payments');
    $csv = $this->get('/admin/reports/csv?'.$query)->assertOk()->streamedContent();
    expect(substr_count($csv, "\n"))->toBe(9)
        ->and($csv)->toContain('Purpose', 'Down payments', 'Balance payments', 'Customer charges', 'Driver charges', 'Manual payments', '-100.25');
});

it('retains refund-only negative amounts and does not invent a payment average for empty Revenue', function () {
    $booking = periodReportBooking(customerUser(), availableVehicle(['name' => 'Refund vehicle'])->id, 'BK-REFUND-ONLY', '2026-10-01 01:00:00');
    $booking->cancellation()->create(['kind' => 'management', 'reason' => 'Refund of prior payment', 'refund_amount' => 120,
        'refunded_at' => '2026-11-02 01:00:00']);
    $query = '/admin/reports?section=revenue&period=day&date=2026-11-02';
    $data = $this->getJson($query)->assertOk()->assertJsonCount(0, 'data.charts.0.points')
        ->assertJsonPath('data.charts.1.points.0.net', -120)->json('data');
    expect(reportMetrics($data))->toBe(['Net receipts' => -120, 'Payments received' => 0, 'Bookings with payments' => 0, 'Average payment' => null]);
    $empty = $this->getJson($query.'&search=Nobody')->assertOk()->assertJsonCount(0, 'data.charts.0.points')
        ->assertJsonCount(0, 'data.charts.1.points')->json('data');
    expect(reportMetrics($empty))->toBe(['Net receipts' => 0, 'Payments received' => 0, 'Bookings with payments' => 0, 'Average payment' => null]);
});

it('groups remaining vehicle cash into Other vehicles without losing refunds or changing totals', function () {
    $customer = customerUser();
    foreach (range(1, 7) as $index) {
        $vehicle = availableVehicle(['name' => 'Revenue vehicle '.$index, 'plate_number' => 'REV-'.$index]);
        $booking = periodReportBooking($customer, $vehicle->id, 'BK-VEHICLE-REVENUE-'.$index, '2026-10-01 01:00:00');
        if ($index <= 6) {
            periodReportPayment($booking, '2026-11-02 01:00:00', 100);
        } else {
            $booking->cancellation()->create(['kind' => 'management', 'reason' => 'Refund', 'refund_amount' => 40, 'refunded_at' => '2026-11-02 01:00:00']);
        }
    }
    $data = $this->getJson('/admin/reports?section=revenue&period=day&date=2026-11-02')->assertOk()
        ->assertJsonCount(6, 'data.charts.1.points')->assertJsonPath('data.charts.1.points.0.label', 'Revenue vehicle 1 (REV-1)')
        ->assertJsonPath('data.charts.1.points.5', ['label' => 'Other vehicles', 'net' => 60])->json('data');
    expect(collect($data['charts'][1]['points'])->sum('net'))->toBe(reportMetrics($data)['Net receipts']);
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
            ->assertJsonPath('data.charts.0.points.0.gross', 125)
            ->json('data');
        expect($result['metrics'][0]['details'][0]['value'])->toBe(125);
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
        ->assertJsonPath('data.table.rows.0.last_completed', '2026-11-03T01:00:00.000000Z')
        ->assertJsonMissingPath('data.table.rows.0.first_completed');

    $risk = $this->getJson('/admin/reports?section=telematics&period=day&date=2026-11-02')->assertOk()
        ->assertJsonPath('data.table.total', 2)->assertJsonMissingPath('data.table.rows.0.latitude')->json('data');
    expect(reportMetrics($risk))->toBe([
        'Rentals released' => 1, 'Monitoring started' => 1, 'Geofence exits' => 1, 'Monitoring interruptions' => 1,
    ]);
});

it('reports customer spending, rental types and favorite vehicles from the filtered completed rentals', function () {
    $customer = customerUser(['name' => 'Customer Report']);
    $driver = createDriverUser();
    $firstVehicle = availableVehicle(['name' => 'Vios', 'plate_number' => 'REPORT-A']);
    $secondVehicle = availableVehicle(['name' => 'Innova', 'plate_number' => 'REPORT-B']);
    $first = periodReportBooking($customer, $firstVehicle->id, 'BK-CUSTOMER-1', '2026-10-20 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-02 01:00:00',
    ]);
    $second = periodReportBooking($customer, $firstVehicle->id, 'BK-CUSTOMER-2', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-03 01:00:00', 'rental_type' => RentalType::OwnersDriver,
    ]);
    $third = periodReportBooking($customer, $secondVehicle->id, 'BK-CUSTOMER-3', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-04 01:00:00', 'rental_type' => RentalType::OwnersDriver,
    ]);
    periodReportBooking($customer, $secondVehicle->id, 'BK-CUSTOMER-4', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-06 01:00:00',
    ]);
    $past = periodReportBooking($customer, $firstVehicle->id, 'BK-CUSTOMER-PAST', '2026-09-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-10-01 01:00:00',
    ]);
    $pending = periodReportBooking($customer, $firstVehicle->id, 'BK-CUSTOMER-PENDING', '2026-11-01 01:00:00');
    $deleted = periodReportBooking($customer, $firstVehicle->id, 'BK-CUSTOMER-DELETED', '2026-11-01 01:00:00', [
        'status' => BookingStatus::Completed, 'completed_at' => '2026-11-08 01:00:00',
    ]);
    periodReportPayment($first, '2026-10-20 01:00:00', 1200);
    periodReportPayment($first, '2026-11-02 01:00:00', 300);
    periodReportPayment($second, '2026-11-02 01:00:00', 2000);
    periodReportPayment($third, '2026-11-02 01:00:00', 3000);
    periodReportPayment($third, '2026-11-12 01:00:00', 500);
    foreach ([$past, $pending, $deleted] as $excluded) {
        periodReportPayment($excluded, '2026-11-02 01:00:00', 10000);
    }
    $deleted->delete();
    foreach ([['user_id' => $driver->id], ['purpose' => 'driver_outstanding'], ['currency' => 'USD'], ['status' => 'failed'], ['status' => 'pending']] as $invalid) {
        Payment::create(['booking_id' => $first->id, 'user_id' => $customer->id, 'provider' => 'paypal',
            'status' => 'completed', 'currency' => 'PHP', 'completed_at' => '2026-11-02 01:00:00', 'amount' => 9000, ...$invalid]);
    }
    $first->cancellation()->create(['kind' => 'management', 'reason' => 'Historical refund', 'refund_amount' => 100, 'refunded_at' => '2026-11-05 01:00:00']);
    $second->cancellation()->create(['kind' => 'management', 'reason' => 'Not paid yet', 'refund_amount' => 250, 'reviewed_at' => '2026-11-05 01:00:00']);
    $third->cancellation()->create(['kind' => 'management', 'reason' => 'Later refund', 'refund_amount' => 500, 'refunded_at' => '2026-11-12 01:00:00']);

    $query = '/admin/reports?section=customers&period=month&date=2026-11-02';
    $data = $this->getJson($query)->assertOk()->assertJsonPath('data.table.rows.0', [
        'customer' => 'Customer Report', 'self_drive' => 2, 'owners_driver' => 2, 'total_spent' => 6400,
        'most_booked_vehicle' => 'Innova (REPORT-B)', 'last_completed' => '2026-11-06T01:00:00.000000Z',
        'lifetime_rating' => null, 'customer_id' => $customer->id, 'rating_count' => 0,
    ])->json('data');
    expect(array_column($data['table']['columns'], 'label'))->toBe([
        'Customer', 'Self Drive', 'Assigned Driver', 'Total spent', 'Most booked vehicle', 'Last completed rental', 'Lifetime ratings',
    ])->and(reportMetrics($data))->toBe(['Customers' => 1, 'Self Drive completed' => 2, 'Assigned Driver completed' => 2, 'Total spent' => 6400]);
    $this->getJson($query.'&vehicle_id='.$firstVehicle->id)->assertOk()
        ->assertJsonPath('data.table.rows.0.self_drive', 1)->assertJsonPath('data.table.rows.0.owners_driver', 1)
        ->assertJsonPath('data.table.rows.0.total_spent', 3400)->assertJsonPath('data.table.rows.0.most_booked_vehicle', 'Vios (REPORT-A)');
    $this->getJson($query.'&rental_type=owners_driver')->assertOk()
        ->assertJsonPath('data.table.rows.0.self_drive', 0)->assertJsonPath('data.table.rows.0.owners_driver', 2)
        ->assertJsonPath('data.table.rows.0.total_spent', 5000)->assertJsonPath('data.table.rows.0.last_completed', '2026-11-04T01:00:00.000000Z');
    $this->getJson($query.'&search=BK-CUSTOMER-1')->assertOk()->assertJsonPath('data.table.rows.0.total_spent', 1400);
    $csv = $this->get(str_replace('/admin/reports?', '/admin/reports/csv?', $query))->assertOk()->streamedContent();
    expect($csv)->toContain('"Self Drive","Assigned Driver","Total spent","Most booked vehicle","Last completed rental"', '6400', 'Innova (REPORT-B)')
        ->not->toContain('First completed rental', 'Renters');
});

it('paginates customer rows without changing totals and breaks favorite ties consistently', function () {
    $vehicle = availableVehicle(['name' => 'First vehicle', 'plate_number' => 'REPORT-FIRST']);
    $tiedVehicle = availableVehicle(['name' => 'Second vehicle']);
    foreach (range(1, 11) as $index) {
        $customer = customerUser(['name' => sprintf('Customer %02d', $index)]);
        $booking = periodReportBooking($customer, $vehicle->id, 'BK-CUSTOMER-PAGE-'.$index, '2026-11-01 01:00:00', [
            'status' => BookingStatus::Completed, 'completed_at' => '2026-11-02 01:00:00',
        ]);
        periodReportPayment($booking, '2026-11-02 01:00:00', 10.25);
        periodReportBooking($customer, $tiedVehicle->id, 'BK-CUSTOMER-TIE-'.$index, '2026-11-01 01:00:00', [
            'status' => BookingStatus::Completed, 'completed_at' => '2026-11-02 01:00:00',
        ]);
    }
    $query = '/admin/reports?section=customers&period=month&date=2026-11-02';
    $first = $this->getJson($query)->assertOk()->assertJsonCount(10, 'data.table.rows')
        ->assertJsonPath('data.table.total', 11)->assertJsonPath('data.table.rows.0.most_booked_vehicle', 'First vehicle (REPORT-FIRST)')->json('data');
    $this->getJson($query.'&page=2')->assertOk()->assertJsonCount(1, 'data.table.rows')
        ->assertJsonPath('data.metrics', $first['metrics']);
    expect(reportMetrics($first)['Total spent'])->toBe(112.75);
    $this->getJson($query.'&search=Nobody')->assertOk()->assertJsonCount(0, 'data.table.rows')
        ->assertJsonPath('data.metrics.0.value', 0)->assertJsonPath('data.metrics.3.value', 0);
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

it('counts the distinct no-show final status without calling it a cancellation', function () {
    $booking = periodReportBooking(customerUser(), availableVehicle()->id, 'BK-NEW-NO-SHOW', '2026-11-01 00:00:00', ['status' => BookingStatus::NoShow]);
    $event = $booking->events()->create(['event_type' => 'status_changed', 'old_status' => 'confirmed', 'new_status' => 'no_show']);
    $event->forceFill(['created_at' => CarbonImmutable::parse('2026-11-02T06:00:00Z')])->saveQuietly();
    $booking->cancellation()->create(['kind' => 'no_show', 'reason' => 'No collection', 'refund_amount' => 0]);
    $result = $this->getJson('/admin/reports?period=day&date=2026-11-02&section=bookings')->assertOk()
        ->assertJsonPath('data.table.rows.0.outcome', 'No-show')->json('data');
    expect(reportMetrics($result))->toMatchArray(['No-shows' => 1, 'Cancellations' => 0]);
});
