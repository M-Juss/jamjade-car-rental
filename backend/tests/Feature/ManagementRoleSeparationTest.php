<?php

use App\Mail\OwnerVerificationMail;
use App\Models\Booking;
use App\Models\DeliveryPricingSetting;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
});

function managementRoleUser(string $role): User
{
    $user = User::factory()->create(['is_active' => true]);
    $user->assignRole($role);

    return $user;
}

it('allows an Owner-only account to log in and retain business access without Admin membership', function () {
    $owner = managementRoleUser('owner');
    $owner->update(['password' => 'SecurePassword123!']);
    $this->postJson('/admin/login', ['email' => $owner->email, 'password' => 'SecurePassword123!'])->assertOk()
        ->assertJsonPath('data.user.roles', ['owner']);
    $this->getJson('/admin/bookings')->assertOk();
    $this->getJson('/admin/personnel')->assertOk();
    $this->getJson('/admin/technical-dashboard')->assertForbidden();
    $this->getJson('/admin/rc-research/native-recordings')->assertForbidden();
});

it('denies obsolete direct business grants to a technical Admin', function (string $url) {
    $admin = managementRoleUser('admin');
    $admin->givePermissionTo(['manage bookings', 'manage vehicles', 'manage personnel', 'view personnel', 'view reports', 'manage delivery pricing']);
    expect($admin->can('manage bookings'))->toBeFalse();
    $this->actingAs($admin)->getJson($url)->assertForbidden();
})->with(['/admin/bookings', '/admin/vehicles', '/admin/personnel', '/admin/reports', '/admin/delivery-pricing']);

it('keeps technical views available without exposing financial or document access', function () {
    $admin = managementRoleUser('admin');
    $this->actingAs($admin)->getJson('/admin/technical-dashboard')->assertOk()
        ->assertJsonPath('data.recordings', 0)->assertJsonMissingPath('data.summary.monthRevenue');
    $this->getJson('/admin/geofences')->assertOk();
    $this->getJson('/admin/fleet-tracker')->assertOk();
    $this->getJson('/admin/driving-analysis')->assertOk();
    $this->getJson('/admin/errors')->assertOk();
    $this->getJson('/admin/self-drive-verification/customers')->assertForbidden();
    $this->getJson('/admin/dashboard?start=2026-11-01&end=2026-11-30')->assertForbidden();
    $this->putJson('/admin/fee-pricing', [])->assertForbidden();
    Mail::assertNothingSent();
});

it('uses Owner precedence for any retained mixed Owner Admin membership', function () {
    $owner = managementRoleUser('owner');
    $owner->assignRole('admin');
    expect($owner->can('manage bookings'))->toBeTrue()->and($owner->can('view research'))->toBeFalse();
    $this->actingAs($owner)->getJson('/admin/me')->assertOk();
    $this->getJson('/admin/technical-dashboard')->assertForbidden();
});

it('lets Staff read only the Driver directory and denies account mutations', function () {
    $staff = managementRoleUser('staff');
    $driver = createDriverUser();
    managementRoleUser('admin');
    managementRoleUser('staff');
    $this->actingAs($staff)->getJson('/admin/personnel')->assertOk()
        ->assertJsonCount(1, 'data.users')->assertJsonPath('data.users.0.id', $driver->id)
        ->assertJsonPath('data.users.0.availableNow', true);
    $this->postJson('/admin/personnel/users', [])->assertForbidden();
    $this->putJson('/admin/personnel/users/'.$driver->id, [])->assertForbidden();
    $this->deleteJson('/admin/personnel/users/'.$driver->id)->assertForbidden();
    $this->deleteJson('/admin/personnel/users/'.$driver->id.'/photo')->assertForbidden();
    $this->getJson('/admin/personnel?role=staff')->assertUnprocessable();
});

it('limits Staff to operational report sections and denies financial exports', function () {
    $this->actingAs(managementRoleUser('staff'));
    foreach (['bookings', 'telematics'] as $section) {
        $response = $this->getJson('/admin/reports?section='.$section)->assertOk();
        expect(collect($response->json('data.metrics'))->pluck('format')->all())->not->toContain('money');
    }
    foreach (['overview', 'revenue', 'customers', 'fleet'] as $section) {
        $this->getJson('/admin/reports?section='.$section)->assertForbidden();
        $this->getJson('/admin/reports/csv?section='.$section)->assertForbidden();
    }
    $this->getJson('/admin/reports?range=all_time')->assertForbidden();
    $this->getJson('/admin/reports/pdf')->assertForbidden();
    $this->getJson('/admin/reports/excel')->assertForbidden();
    $this->getJson('/admin/dashboard?start=2026-11-01&end=2026-11-30')->assertOk()
        ->assertJsonPath('data.summary.monthRevenue', null)->assertJsonPath('data.overview.balances', null);
});

it('holds a sensitive Staff edit until the Owner code succeeds and audits the approval', function () {
    $owner = managementRoleUser('owner');
    $staff = managementRoleUser('staff');
    $before = DeliveryPricingSetting::current()->minimum_fee;
    $data = ['minimum_fee' => 888, 'included_km' => 2, 'per_km_rate' => 40];
    $this->actingAs($staff)->putJson('/admin/delivery-pricing', $data)->assertStatus(428);
    $issued = $this->withHeaders(['X-Owner-Verification' => 'request'])->putJson('/admin/delivery-pricing', $data)->assertOk();
    expect(DeliveryPricingSetting::current()->minimum_fee)->toBe($before);
    $mail = Mail::sent(OwnerVerificationMail::class)->last();
    expect($mail->hasTo($owner->email))->toBeTrue();
    $this->flushHeaders();
    $this->withHeaders(['X-Owner-Verification-Id' => $issued->json('data.verificationId'), 'X-Owner-Code' => $mail->code])
        ->putJson('/admin/delivery-pricing', $data)->assertOk();
    expect((float) DeliveryPricingSetting::current()->minimum_fee)->toBe(888.0);
    $this->assertDatabaseHas('activity_log', ['event' => 'owner_verified_change', 'causer_id' => $staff->id]);
    expect(DB::table('activity_log')->where('event', 'owner_verified_change')->value('properties'))->not->toContain($mail->code);
});

it('permits ordinary Staff vehicle edits but requires verification for a rate change', function () {
    managementRoleUser('owner');
    $vehicle = availableVehicle();
    $this->actingAs(managementRoleUser('staff'))->putJson('/admin/vehicles/'.$vehicle->id, ['description' => 'Updated rental details'])->assertOk();
    $this->putJson('/admin/vehicles/'.$vehicle->id, ['price_per_day' => 4000])->assertStatus(428);
    expect($vehicle->fresh()->description)->toBe('Updated rental details')->and((float) $vehicle->fresh()->price_per_day)->not->toBe(4000.0);
    $this->postJson('/admin/vehicles', [])->assertForbidden();
    $this->deleteJson('/admin/vehicles/'.$vehicle->id)->assertForbidden();
    $this->postJson('/admin/geofences', [])->assertForbidden();
    $this->postJson('/admin/maintenance-plans', [])->assertForbidden();
});

it('returns only driving-analysis fields to the technical Admin', function () {
    $customer = customerUser();
    $booking = Booking::create([
        'booking_code' => 'ROLE-ANALYSIS', 'user_id' => $customer->id, 'vehicle_id' => availableVehicle()->id,
        'status' => 'completed', 'rental_type' => 'self_drive', 'payment_status' => 'paid',
        'rental_start_at' => now()->subDays(2), 'rental_end_at' => now()->subDay(),
        'duration_days' => 1, 'price_per_day' => 3500, 'subtotal' => 3500, 'total_amount' => 3500,
        'remaining_balance' => 0, 'pickup_location_type' => 'shop', 'pickup_location' => 'Garage', 'return_location' => 'Garage',
        'admin_notes' => 'Private operational note',
    ]);
    $this->actingAs(managementRoleUser('admin'))->getJson('/admin/driving-analysis/bookings/'.$booking->id)
        ->assertOk()->assertJsonPath('data.bookingCode', 'ROLE-ANALYSIS')->assertJsonMissingPath('data.totalAmount')
        ->assertJsonMissingPath('data.customer.email')->assertJsonMissingPath('data.payments')
        ->assertJsonMissingPath('data.adminNotes')->assertJsonMissingPath('data.inspections');
    $this->getJson('/admin/bookings/'.$booking->id)->assertForbidden();
});

it('migrates existing memberships and can restore the saved permission snapshot', function () {
    $owner = managementRoleUser('owner');
    $owner->assignRole('admin');
    $adminRole = Role::findByName('admin');
    $migration = require database_path('migrations/2026_11_23_000001_separate_management_role_permissions.php');
    // RefreshDatabase has already applied it; re-run against a representative legacy state.
    $migration->down();
    $adminRole->syncPermissions(['manage bookings']);
    $migration->up();
    expect($owner->fresh()->hasRole('admin'))->toBeFalse()->and($owner->fresh()->hasRole('owner'))->toBeTrue();
    $migration->down();
    expect($owner->fresh()->hasRole('admin'))->toBeTrue()
        ->and(Role::findByName('admin')->permissions->pluck('name')->all())->toBe(['manage bookings']);
    $migration->up();
});
