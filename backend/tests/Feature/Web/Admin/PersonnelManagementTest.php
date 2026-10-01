<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingAdditionalCharge;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
});

function personnelPayload(User $user, array $overrides = []): array
{
    return array_replace([
        'first_name' => 'Test', 'last_name' => 'Personnel', 'email' => $user->email,
        'phone_number' => null, 'role' => $user->hasRole('driver') ? 'driver' : 'staff',
        'is_active' => $user->is_active,
    ], $overrides);
}

function personnelServiceBooking(User $driver, BookingStatus $status = BookingStatus::Confirmed): Booking
{
    return Booking::create([
        'booking_code' => 'BK-PER-'.Str::upper(Str::random(8)),
        'user_id' => customerUser()->id, 'vehicle_id' => availableVehicle()->id,
        'rental_type' => RentalType::OwnersDriver,
        'rental_start_at' => now(), 'rental_end_at' => now()->addDay(),
        'pickup_location_type' => 'shop', 'pickup_location' => 'Test Garage', 'return_location' => 'Test Garage',
        'status' => $status, 'payment_status' => 'unpaid', 'price_per_day' => 3500,
        'duration_days' => 1, 'subtotal' => 3500, 'total_amount' => 3500, 'remaining_balance' => 3500,
        'assigned_driver_id' => $driver->id, 'driver_assigned_at' => now(),
    ]);
}

function personnelDriverCharge(User $driver): BookingAdditionalCharge
{
    return BookingAdditionalCharge::create([
        'booking_id' => personnelServiceBooking($driver, BookingStatus::Completed)->id,
        'type' => 'vehicle_damage', 'description' => 'Test repair charge', 'amount' => 500,
        'responsibility' => 'driver', 'responsible_user_id' => $driver->id,
    ]);
}

it('lists only fixed personnel categories with filters and pagination', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $driver = createDriverUser();
    customerUser();
    $this->actingAs($this->admin)->getJson('/admin/personnel?role=driver&per_page=1')
        ->assertOk()->assertJsonCount(1, 'data.users')
        ->assertJsonPath('data.users.0.category', 'driver')
        ->assertJsonPath('data.users.0.personnelId', sprintf('PER-%04d', $driver->id))
        ->assertJsonPath('data.summary.staff', 1)->assertJsonPath('data.summary.drivers', 1)
        ->assertJsonPath('data.summary.total', 2)->assertJsonPath('data.pagination.total', 1)
        ->assertJsonCount(2, 'data.roles')->assertJsonMissingPath('data.modules');
    $this->getJson('/admin/personnel?role=staff&search=not-found')->assertOk()->assertJsonCount(0, 'data.users');
    $this->getJson('/admin/personnel?role=staff&status=inactive')->assertOk()->assertJsonCount(0, 'data.users');
    $this->getJson('/admin/personnel?status=unknown&role=custom&page=0&per_page=101')
        ->assertUnprocessable()->assertJsonValidationErrors(['status', 'role', 'page', 'per_page']);
});

it('creates normalized accounts with fixed access', function (string $role) {
    $this->actingAs($this->admin)->postJson('/admin/personnel/users', [
        'first_name' => '  Test   ', 'last_name' => ' Personnel ',
        'email' => ' PERSONNEL@JAMJADE.TEST ', 'phone_number' => ' 09170000999 ',
        'role' => $role, 'password' => 'Password@123', 'password_confirmation' => 'Password@123',
    ])->assertCreated()->assertJsonPath('data.user.name', 'Test Personnel')
        ->assertJsonPath('data.user.email', 'personnel@jamjade.test')->assertJsonPath('data.user.category', $role);
    $account = User::where('email', 'personnel@jamjade.test')->firstOrFail();
    expect(Hash::check('Password@123', $account->password))->toBeTrue()
        ->and($account->can('manage bookings'))->toBe($role === 'staff')
        ->and($account->can('manage personnel'))->toBeFalse();
})->with(['staff', 'driver']);

it('rejects protected and custom roles and privilege input', function (string $role) {
    Role::findOrCreate('fleet_clerk', 'web');
    $user = User::factory()->make();
    $this->actingAs($this->admin)->postJson('/admin/personnel/users', [
        ...personnelPayload($user, ['role' => $role]),
        'password' => 'Password@123', 'password_confirmation' => 'Password@123',
        'modules' => ['booking_management'], 'permissions' => ['manage bookings'],
    ])->assertUnprocessable()->assertJsonValidationErrors(['role', 'modules', 'permissions']);
})->with(['admin', 'customer', 'owner', 'fleet_clerk']);

it('validates account fields and uniqueness', function () {
    $staff = User::factory()->create(['phone_number' => '09170000123']);
    $staff->assignRole('staff');
    $this->actingAs($this->admin)->postJson('/admin/personnel/users', [
        'first_name' => 'Name123', 'last_name' => 'Name!', 'email' => $staff->email,
        'phone_number' => $staff->phone_number, 'role' => 'staff',
        'password' => 'weakpassword', 'password_confirmation' => 'different',
    ])->assertUnprocessable()->assertJsonValidationErrors(['first_name', 'last_name', 'email', 'phone_number', 'password']);
});

it('blocks non-admin personnel administration even with a direct permission', function (string $role) {
    $user = User::factory()->create();
    $user->assignRole($role);
    $user->givePermissionTo('manage personnel');
    $this->actingAs($user)->getJson('/admin/personnel')->assertForbidden();
    $this->postJson('/admin/personnel/users', [])->assertForbidden();
    $this->putJson("/admin/personnel/users/{$user->id}", personnelPayload($user))->assertForbidden();
})->with(['staff', 'driver', 'customer']);

it('blocks unauthenticated personnel access', function () {
    $this->getJson('/admin/personnel')->assertUnauthorized();
});

it('retires role editing and account deletion', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($this->admin)->postJson('/staff/management/roles', [])->assertNotFound();
    $this->putJson('/staff/management/roles/1', [])->assertNotFound();
    $this->deleteJson('/staff/management/roles/1')->assertNotFound();
    $this->postJson('/admin/personnel/roles', [])->assertNotFound();
    $this->deleteJson("/admin/personnel/users/{$staff->id}")->assertStatus(405);
    $this->assertDatabaseHas('users', ['id' => $staff->id]);
});

it('protects Admin Customer and mixed-role accounts from personnel mutations', function (string $role) {
    $user = User::factory()->create();
    $user->assignRole($role);
    if ($role === 'admin') {
        $user->assignRole('staff');
    }
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$user->id}", personnelPayload($user, ['role' => 'driver']))
        ->assertUnprocessable()->assertJsonValidationErrors('role');
    expect($user->fresh()->hasRole($role))->toBeTrue();
})->with(['admin', 'customer']);

it('preserves the existing password and status when omitted during updates', function () {
    $staff = User::factory()->create(['password' => 'Existing-password@123', 'is_active' => false]);
    $staff->assignRole('staff');
    $payload = personnelPayload($staff, ['first_name' => 'Updated']);
    unset($payload['is_active']);
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$staff->id}", $payload)
        ->assertOk()->assertJsonPath('data.user.name', 'Updated Personnel')->assertJsonPath('data.user.isActive', false);
    expect(Hash::check('Existing-password@123', $staff->fresh()->password))->toBeTrue();
});

it('keeps Driver mobile login while denying web login and stale sessions', function () {
    $driver = createDriverUser(['password' => 'Password@123']);
    $driver->givePermissionTo(['view dashboard', 'manage bookings']);
    $this->postJson('/admin/login', ['email' => $driver->email, 'password' => 'Password@123'])
        ->assertUnprocessable()->assertJsonValidationErrors('email');
    $this->actingAs($driver)->getJson('/admin/dashboard')->assertForbidden();
    $this->getJson('/admin/bookings')->assertForbidden();
    $this->postJson('/api/mobile/login', ['login' => $driver->email, 'password' => 'Password@123'])
        ->assertOk()->assertJsonPath('data.user.roles.0', 'driver');
});

it('allows only assigned services and denies customer booking mutations to Drivers', function () {
    $driver = createDriverUser();
    $own = personnelServiceBooking($driver);
    $other = personnelServiceBooking(createDriverUser());
    Sanctum::actingAs($driver, ['mobile']);
    $this->getJson('/api/mobile/driver/services')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson("/api/mobile/driver/services/{$own->id}")->assertOk();
    $this->getJson("/api/mobile/driver/services/{$other->id}")->assertNotFound();
    $this->getJson('/api/mobile/bookings')->assertForbidden();
    $this->postJson('/api/mobile/bookings', [])->assertForbidden();
    $this->postJson("/api/mobile/bookings/{$own->id}/cancel")->assertForbidden();
});

it('preserves Staff web operations and denies Staff mobile login', function () {
    $staff = User::factory()->create(['password' => 'Password@123']);
    $staff->assignRole('staff');
    $this->postJson('/admin/login', ['email' => $staff->email, 'password' => 'Password@123'])->assertOk();
    $this->getJson('/admin/bookings')->assertOk();
    $this->getJson('/admin/reports')->assertOk();
    $this->postJson('/api/mobile/login', ['login' => $staff->email, 'password' => 'Password@123'])->assertUnprocessable();
});

it('blocks Driver role changes and deactivation for active assignments', function (string $status, string $change) {
    $driver = createDriverUser();
    $booking = personnelServiceBooking($driver, BookingStatus::from($status));
    $driver->createToken('test-device');
    $overrides = $change === 'role' ? ['role' => 'staff'] : ['is_active' => false];
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$driver->id}", personnelPayload($driver, $overrides))
        ->assertUnprocessable()->assertJsonValidationErrors($change === 'role' ? 'role' : 'is_active');
    expect($driver->fresh()->is_active)->toBeTrue()->and($driver->fresh()->hasRole('driver'))->toBeTrue()
        ->and($driver->tokens()->count())->toBe(1)->and($booking->fresh()->assigned_driver_id)->toBe($driver->id);
})->with(['pending', 'confirmed', 'ongoing'])->with(['role', 'status']);

it('allows contact updates during an active Driver service', function () {
    $driver = createDriverUser();
    personnelServiceBooking($driver, BookingStatus::Ongoing);
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$driver->id}", personnelPayload($driver, ['first_name' => 'Updated']))
        ->assertOk()->assertJsonPath('data.user.name', 'Updated Personnel');
});

it('preserves Driver settlement access until unpaid obligations are settled', function (string $change) {
    $driver = createDriverUser();
    personnelDriverCharge($driver);
    $overrides = $change === 'role' ? ['role' => 'staff'] : ['is_active' => false];
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$driver->id}", personnelPayload($driver, $overrides))
        ->assertUnprocessable()->assertJsonValidationErrors($change === 'role' ? 'role' : 'is_active');
    expect($driver->fresh()->is_active)->toBeTrue()->and($driver->fresh()->hasRole('driver'))->toBeTrue();
})->with(['role', 'status']);

it('allows deactivation after paid charges while preserving service history', function () {
    $driver = createDriverUser();
    $charge = personnelDriverCharge($driver);
    $payment = Payment::create([
        'booking_id' => $charge->booking_id, 'user_id' => $driver->id, 'payment_method' => 'PayPal',
        'status' => 'completed', 'amount' => 500, 'transaction_id' => 'PAID-TEST', 'completed_at' => now(),
    ]);
    $charge->payments()->attach($payment->id, ['amount' => 500]);
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$driver->id}", personnelPayload($driver, ['is_active' => false]))->assertOk();
    expect($charge->fresh()->responsible_user_id)->toBe($driver->id);
    $this->assertDatabaseHas('booking_assignments', ['booking_id' => $charge->booking_id, 'driver_id' => $driver->id]);
    $this->assertDatabaseHas('payments', ['id' => $payment->id]);
});

it('revokes tokens and denies inactive authenticated requests', function () {
    $driver = createDriverUser();
    $driver->createToken('test-device');
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$driver->id}", personnelPayload($driver, ['is_active' => false]))->assertOk();
    expect($driver->tokens()->count())->toBe(0);
    Sanctum::actingAs($driver->fresh(), ['mobile']);
    $this->getJson('/api/mobile/driver/services')->assertForbidden();
    $this->getJson('/api/mobile/me')->assertForbidden();
});

it('allows a debt-free unassigned conversion and clears direct privileges and tokens', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $staff->givePermissionTo('manage bookings');
    $staff->createToken('legacy-device');
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$staff->id}", personnelPayload($staff, ['role' => 'driver']))
        ->assertOk()->assertJsonPath('data.user.category', 'driver');
    expect($staff->fresh()->getAllPermissions())->toHaveCount(0)->and($staff->tokens()->count())->toBe(0);
});

it('migrates Driver access without changing Staff permissions or service history', function () {
    $driver = createDriverUser();
    $booking = personnelServiceBooking($driver);
    $driver->givePermissionTo('manage bookings');
    Role::findByName('driver')->givePermissionTo('view dashboard');
    $old = Permission::findOrCreate('manage staff management', 'web');
    $this->admin->givePermissionTo($old);
    $staffPermissions = Role::findByName('staff')->permissions->pluck('name')->all();
    Role::create(['name' => 'unused_clerk', 'guard_name' => 'web']);
    $migration = require database_path('migrations/2026_09_29_000002_fix_personnel_roles.php');
    $migration->up();
    $migration->up();
    expect($driver->fresh()->getAllPermissions())->toHaveCount(0)
        ->and(Role::findByName('staff')->permissions->pluck('name')->all())->toBe($staffPermissions)
        ->and($this->admin->fresh()->can('manage personnel'))->toBeTrue();
    $this->assertDatabaseMissing('roles', ['name' => 'unused_clerk']);
    $this->assertDatabaseMissing('permissions', ['name' => 'manage staff management']);
    $this->assertDatabaseHas('booking_assignments', ['booking_id' => $booking->id, 'driver_id' => $driver->id]);
});

it('requires explicit mapping for assigned custom roles', function () {
    $role = Role::create(['name' => 'fleet_clerk', 'guard_name' => 'web']);
    $user = User::factory()->create();
    $user->assignRole($role);
    $migration = require database_path('migrations/2026_09_29_000002_fix_personnel_roles.php');
    expect(fn () => $migration->up())->toThrow(LogicException::class);
    $this->assertDatabaseHas('model_has_roles', ['role_id' => $role->id, 'model_id' => $user->id]);
});

it('requires resolving mixed Driver roles before removing privileges', function () {
    $driver = createDriverUser();
    $driver->assignRole('staff');
    $driver->givePermissionTo('manage bookings');
    $migration = require database_path('migrations/2026_09_29_000002_fix_personnel_roles.php');
    expect(fn () => $migration->up())->toThrow(LogicException::class);
    expect($driver->fresh()->can('manage bookings'))->toBeTrue();
});

it('retains Admin login and personnel administration without adding Owner', function () {
    $this->admin->update(['password' => 'Existing-password@123']);
    $this->postJson('/admin/login', ['email' => strtoupper($this->admin->email), 'password' => 'Existing-password@123'])
        ->assertOk()->assertJsonPath('data.user.roles.0', 'admin');
    $this->getJson('/admin/personnel')->assertOk();
    $this->assertDatabaseMissing('roles', ['name' => 'owner']);
});
