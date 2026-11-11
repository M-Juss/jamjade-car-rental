<?php

use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->travelTo(Carbon::parse('2026-11-11T01:00:00+08:00')->utc());
});

function dashboardOverviewBooking(array $attributes = []): Booking
{
    return Booking::create(array_merge([
        'booking_code' => 'BK-DASH-'.fake()->unique()->numerify('######'),
        'user_id' => customerUser()->id,
        'vehicle_id' => availableVehicle()->id,
        'rental_type' => 'self_drive', 'status' => 'confirmed', 'payment_status' => 'partial',
        'rental_start_at' => Carbon::parse('2026-11-11T00:30:00+08:00')->utc(),
        'rental_end_at' => Carbon::parse('2026-11-11T23:30:00+08:00')->utc(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'price_per_day' => 3500, 'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500,
        'remaining_balance' => 500,
    ], $attributes));
}

function dashboardOverviewAdmin(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

it('keeps today operations on the Manila date independently of the calendar range', function () {
    $booking = dashboardOverviewBooking();
    dashboardOverviewBooking([
        'status' => 'ongoing',
        'rental_start_at' => now()->subDays(2),
        'rental_end_at' => Carbon::parse('2026-11-10T23:59:00+08:00')->utc(),
    ]);
    $this->actingAs(dashboardOverviewAdmin())->getJson('/admin/dashboard?start=2026-12-01&end=2026-12-31')
        ->assertOk()->assertJsonPath('data.overview.today', '2026-11-11')
        ->assertJsonPath('data.summary.todaysPickups', 1)
        ->assertJsonPath('data.overview.todaysReturns', 1)
        ->assertJsonPath('data.overview.operationsTotal', 2)
        ->assertJsonPath('data.overview.operations.0.kind', 'pickup')
        ->assertJsonPath('data.overview.operations.0.id', $booking->id)
        ->assertJsonPath('data.overview.operations.1.kind', 'return')
        ->assertJsonCount(0, 'data.events');

    $this->getJson('/admin/dashboard?start=2026-11-11&end=2026-11-11')
        ->assertOk()->assertJsonCount(1, 'data.events');
});

it('excludes received returns and terminal balances without adding customer charges twice', function () {
    $booking = dashboardOverviewBooking(['balance_due_at' => now()->subMinute()]);
    $booking->additionalCharges()->create([
        'type' => 'other', 'description' => 'Already included in booking balance', 'amount' => 200,
        'responsibility' => 'customer', 'responsible_user_id' => $booking->user_id,
        'created_by' => dashboardOverviewAdmin()->id,
    ]);
    $received = dashboardOverviewBooking(['status' => 'ongoing', 'remaining_balance' => 0]);
    $received->returnRecord()->create(['vehicle_received_at' => now(), 'received_by' => dashboardOverviewAdmin()->id]);
    dashboardOverviewBooking(['status' => 'cancelled', 'remaining_balance' => 900]);
    dashboardOverviewBooking(['status' => 'pending', 'remaining_balance' => 3500]);

    $this->actingAs(dashboardOverviewAdmin())->getJson('/admin/dashboard?start=2026-11-01&end=2026-11-30')
        ->assertOk()->assertJsonPath('data.overview.todaysReturns', 1)
        ->assertJsonPath('data.overview.balances.amount', 500)
        ->assertJsonPath('data.overview.balances.overdueAmount', 500)
        ->assertJsonPath('data.overview.balances.bookings', 1)
        ->assertJsonPath('data.overview.awaitingPayment', 1);
});

it('hides overview modules without their permissions and denies users without dashboard access', function () {
    dashboardOverviewBooking();
    $user = User::factory()->create();
    // Exercise a management account with dashboard-only access.
    $role = Role::findByName('staff');
    $role->syncPermissions(['view dashboard']);
    $user->assignRole('staff');
    $this->actingAs($user)->getJson('/admin/dashboard?start=2026-11-01&end=2026-11-30')
        ->assertOk()->assertJsonPath('data.overview.operations', null)
        ->assertJsonPath('data.overview.operationsTotal', null)
        ->assertJsonPath('data.overview.balances', null)
        ->assertJsonPath('data.overview.fleet', null)
        ->assertJsonPath('data.overview.maintenance', null)
        ->assertJsonPath('data.overview.pendingDocuments', null)
        ->assertJsonPath('data.overview.awaitingPayment', null);
    $this->actingAs(customerUser())->getJson('/admin/dashboard?start=2026-11-01&end=2026-11-30')->assertForbidden();
});

it('counts required pending customer documents rather than files or legacy document types', function () {
    $customer = customerUser();
    foreach (['drivers_license', 'proof_of_billing', 'passport'] as $type) {
        CustomerDocument::updateOrCreate(['user_id' => $customer->id, 'document_type' => $type], ['status' => 'pending', 'submitted_at' => now()]);
    }
    $this->actingAs(dashboardOverviewAdmin())->getJson('/admin/dashboard?start=2026-11-01&end=2026-11-30')
        ->assertOk()->assertJsonPath('data.overview.pendingDocuments', 2);
});
