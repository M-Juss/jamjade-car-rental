<?php

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Activity;
use App\Models\Booking;
use App\Models\BookingAdditionalCharge;
use App\Models\BookingEvent;
use App\Models\BookingGeofence;
use App\Models\CustomerDocument;
use App\Models\Geofence;
use App\Models\Payment;
use App\Models\TelematicsSetupStep;
use App\Models\TelematicsTrip;
use App\Models\User;
use App\Models\VehicleInspection;
use App\Models\VehicleInspectionSignature;
use App\Models\VehicleMaintenancePlan;
use App\Models\VehicleMaintenanceRecord;
use App\Services\DriverAssignmentService;
use App\Services\PersonnelService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
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
    $this->deleteJson("/admin/personnel/users/{$user->id}")->assertForbidden();
})->with(['driver', 'customer']);

it('blocks unauthenticated personnel access', function () {
    $this->getJson('/admin/personnel')->assertUnauthorized();
});

it('keeps custom role editing retired', function () {
    $this->actingAs($this->admin)->postJson('/staff/management/roles', [])->assertNotFound();
    $this->putJson('/staff/management/roles/1', [])->assertNotFound();
    $this->deleteJson('/staff/management/roles/1')->assertNotFound();
    $this->postJson('/admin/personnel/roles', [])->assertNotFound();
});

it('adds and rolls back the deletion column without removing accounts', function () {
    $staff = User::factory()->create();
    $migration = require database_path('migrations/2026_11_06_000002_add_soft_deletes_to_users.php');
    $migration->down();
    expect(Schema::hasColumn('users', 'deleted_at'))->toBeFalse();
    $this->assertDatabaseHas('users', ['id' => $staff->id]);
    $migration->up();
    expect(Schema::hasColumn('users', 'deleted_at'))->toBeTrue()->and($staff->fresh()->trashed())->toBeFalse();
});

it('soft deletes personnel and retains their identity and audit records', function (string $role) {
    $account = User::factory()->create(['password' => 'Password@123', 'remember_token' => 'old-token']);
    $account->assignRole($role);
    $token = $account->createToken('device')->plainTextToken;
    $past = activity()->causedBy($account)->performedOn($account)->event('past_action')->log('Past action.');

    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$account->id}")->assertOk();

    $deleted = User::withTrashed()->findOrFail($account->id);
    $this->assertSoftDeleted('users', ['id' => $account->id]);
    expect(User::find($account->id))->toBeNull()
        ->and($deleted->is_active)->toBeFalse()
        ->and($deleted->remember_token)->not->toBe('old-token')
        ->and($deleted->tokens()->count())->toBe(0)
        ->and($deleted->hasRole($role))->toBeTrue()
        ->and($deleted->email)->toBe($account->email);
    $past = Activity::findOrFail($past->id);
    expect($past->causer->id)->toBe($account->id)->and($past->subject->id)->toBe($account->id);
    $audit = Activity::where('event', 'personnel_deleted')->sole();
    expect($audit->causer_id)->toBe($this->admin->id)
        ->and($audit->subject_id)->toBe($account->id)
        ->and($audit->subject->trashed())->toBeTrue()
        ->and($audit->properties->all())->toBe(['role' => $role])
        ->and($audit->created_at)->not->toBeNull();
    $this->getJson('/admin/personnel')->assertOk()->assertJsonCount(0, 'data.users')
        ->assertJsonPath('data.summary.total', 0)->assertJsonPath('data.pagination.total', 0);
    $this->deleteJson("/admin/personnel/users/{$account->id}")->assertNotFound();
    $this->putJson("/admin/personnel/users/{$account->id}", personnelPayload($account))->assertNotFound();
    expect(Activity::where('event', 'personnel_deleted')->count())->toBe(1);
    $this->app['auth']->forgetGuards();
    $this->getJson('/api/mobile/me', ['Authorization' => 'Bearer '.$token])->assertUnauthorized();
    $this->postJson('/api/mobile/login', ['login' => $account->email, 'password' => 'Password@123'])->assertUnprocessable();
    $this->postJson('/admin/login', ['email' => $account->email, 'password' => 'Password@123'])->assertUnprocessable();
})->with(['staff', 'driver']);

it('blocks deletion while a Driver has an active assignment', function (string $status) {
    $driver = createDriverUser();
    $booking = personnelServiceBooking($driver, BookingStatus::from($status));
    $driver->createToken('device');
    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$driver->id}")
        ->assertUnprocessable()->assertJsonValidationErrors('personnel');
    expect($driver->fresh()->is_active)->toBeTrue()->and($driver->tokens()->count())->toBe(1)
        ->and($booking->fresh()->assignedDriver->id)->toBe($driver->id)
        ->and(Activity::where('event', 'personnel_deleted')->exists())->toBeFalse();
    $this->assertNotSoftDeleted('users', ['id' => $driver->id]);
})->with(['pending', 'confirmed', 'ongoing']);

it('rejects an existing Staff browser session after deletion', function () {
    $staff = User::factory()->create(['password' => 'Password@123']);
    $staff->assignRole('staff');
    $this->postJson('/admin/login', ['email' => $staff->email, 'password' => 'Password@123'])->assertOk();
    $this->getJson('/admin/me')->assertOk()->assertJsonPath('data.user.id', $staff->id);

    app(PersonnelService::class)->delete($staff, $this->admin);
    $this->app['auth']->forgetGuards();

    $this->getJson('/admin/me')->assertUnauthorized();
    $this->getJson('/admin/bookings')->assertUnauthorized();
});

it('excludes deleted Drivers from new assignment choices while retaining loaded history', function () {
    $deletedDriver = createDriverUser();
    $availableDriver = createDriverUser();
    $booking = personnelServiceBooking($deletedDriver, BookingStatus::Completed);
    app(PersonnelService::class)->delete($deletedDriver, $this->admin);

    expect(app(DriverAssignmentService::class)->driverCandidates()->modelKeys())->toBe([$availableDriver->id]);
    $history = Booking::with(['assignedDriver', 'assignment.driver'])->findOrFail($booking->id);
    expect($history->assignedDriver->id)->toBe($deletedDriver->id)
        ->and($history->assignedDriver->trashed())->toBeTrue()
        ->and($history->assignment->driver->id)->toBe($deletedDriver->id);
});

it('blocks deletion for unpaid Driver charges', function () {
    $driver = createDriverUser();
    personnelDriverCharge($driver);
    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$driver->id}")
        ->assertUnprocessable()->assertJsonValidationErrors('personnel');
    $this->assertNotSoftDeleted('users', ['id' => $driver->id]);
});

it('preserves paid Driver charges payments and assignment history after deletion', function () {
    $driver = createDriverUser();
    $charge = personnelDriverCharge($driver);
    $payment = Payment::create([
        'booking_id' => $charge->booking_id, 'user_id' => $driver->id, 'payment_method' => 'PayPal',
        'status' => 'completed', 'amount' => 500, 'transaction_id' => 'DELETE-HISTORY-TEST', 'completed_at' => now(),
    ]);
    $charge->payments()->attach($payment->id, ['amount' => 500]);
    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$driver->id}")->assertOk();
    expect($charge->fresh()->responsibleUser->id)->toBe($driver->id)
        ->and($payment->fresh()->user->id)->toBe($driver->id)
        ->and($charge->booking->fresh()->assignedDriver->id)->toBe($driver->id)
        ->and($charge->booking->assignment->driver->id)->toBe($driver->id);
    $this->assertDatabaseHas('booking_assignments', ['booking_id' => $charge->booking_id, 'driver_id' => $driver->id]);
    $this->assertDatabaseHas('payments', ['id' => $payment->id]);
    $this->assertDatabaseHas('payment_charge_allocations', ['payment_id' => $payment->id]);
});

it('preserves personnel attribution on historical records', function (string $model, string $foreignKey, string $relation) {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$staff->id}")->assertOk();
    $record = new $model([$foreignKey => $staff->id]);
    expect($record->{$relation}->id)->toBe($staff->id)->and($record->{$relation}->name)->toBe($staff->name);
})->with([
    [BookingEvent::class, 'actor_user_id', 'actor'],
    [VehicleInspection::class, 'created_by', 'creator'],
    [VehicleInspectionSignature::class, 'user_id', 'user'],
    [VehicleMaintenancePlan::class, 'created_by', 'creator'],
    [VehicleMaintenanceRecord::class, 'created_by', 'creator'],
    [VehicleMaintenanceRecord::class, 'started_by', 'starter'],
    [VehicleMaintenanceRecord::class, 'completed_by', 'completer'],
    [VehicleMaintenanceRecord::class, 'cancelled_by', 'canceller'],
    [Geofence::class, 'created_by', 'creator'],
    [BookingGeofence::class, 'assigned_by', 'assignedBy'],
    [TelematicsSetupStep::class, 'actor_user_id', 'actor'],
    [TelematicsTrip::class, 'operator_user_id', 'operator'],
    [CustomerDocument::class, 'reviewed_by', 'reviewer'],
]);

it('rolls back deletion and access revocation if the audit cannot be recorded', function () {
    $staff = User::factory()->create(['remember_token' => 'original-token']);
    $staff->assignRole('staff');
    $staff->createToken('device');
    Activity::creating(function (Activity $activity) {
        if ($activity->event === 'personnel_deleted') {
            throw new RuntimeException('Audit unavailable.');
        }
    });
    try {
        $this->withoutExceptionHandling();
        expect(fn () => $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$staff->id}"))
            ->toThrow(RuntimeException::class, 'Audit unavailable.');
    } finally {
        Activity::flushEventListeners();
    }
    $this->assertNotSoftDeleted('users', ['id' => $staff->id]);
    expect($staff->fresh()->is_active)->toBeTrue()->and($staff->tokens()->count())->toBe(1)
        ->and($staff->fresh()->remember_token)->toBe('original-token');
});

it('protects Admin Customer and mixed-role accounts from deletion', function (array $roles) {
    $account = User::factory()->create();
    $account->assignRole($roles);
    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$account->id}")
        ->assertUnprocessable()->assertJsonValidationErrors('personnel');
    $this->assertNotSoftDeleted('users', ['id' => $account->id]);
})->with([['roles' => ['admin']], ['roles' => ['customer']], ['roles' => ['staff', 'driver']], ['roles' => ['admin', 'staff']]]);

it('denies unauthenticated and inactive Admin deletion requests', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->deleteJson("/admin/personnel/users/{$staff->id}")->assertUnauthorized();
    $this->admin->update(['is_active' => false]);
    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$staff->id}")->assertForbidden();
    $this->assertNotSoftDeleted('users', ['id' => $staff->id]);
});

it('keeps deleted personnel email and phone identities reserved', function () {
    $staff = User::factory()->create(['phone_number' => '09170000123']);
    $staff->assignRole('staff');
    $this->actingAs($this->admin)->deleteJson("/admin/personnel/users/{$staff->id}")->assertOk();
    $this->postJson('/admin/personnel/users', [
        ...personnelPayload($staff), 'phone_number' => $staff->phone_number,
        'password' => 'Password@123', 'password_confirmation' => 'Password@123',
    ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'phone_number']);
});

it('records personnel creation and updates without sensitive values in audit metadata', function () {
    $this->actingAs($this->admin)->postJson('/admin/personnel/users', [
        'first_name' => 'Test', 'last_name' => 'Personnel', 'email' => 'audit@example.test',
        'role' => 'staff', 'password' => 'Password@123', 'password_confirmation' => 'Password@123',
    ])->assertCreated();
    $staff = User::where('email', 'audit@example.test')->sole();
    $this->putJson("/admin/personnel/users/{$staff->id}", personnelPayload($staff, ['is_active' => false, 'password' => 'Changed@123', 'password_confirmation' => 'Changed@123']))->assertOk();
    $created = Activity::where('event', 'personnel_created')->sole();
    $updated = Activity::where('event', 'personnel_updated')->sole();
    expect($created->causer_id)->toBe($this->admin->id)->and($created->subject_id)->toBe($staff->id)
        ->and($updated->properties['password_changed'])->toBeTrue()
        ->and($updated->properties['is_active'])->toBeFalse()
        ->and($updated->properties->toJson())->not->toContain('Changed@123', 'audit@example.test', $staff->password);
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
    $this->postJson("/api/mobile/bookings/{$own->id}/cancel")->assertNotFound();
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

it('retains Admin login and personnel administration alongside Owner', function () {
    $this->admin->update(['password' => 'Existing-password@123']);
    $this->postJson('/admin/login', ['email' => strtoupper($this->admin->email), 'password' => 'Existing-password@123'])
        ->assertOk()->assertJsonPath('data.user.roles.0', 'admin');
    $this->getJson('/admin/personnel')->assertOk();
    $this->assertDatabaseHas('roles', ['name' => 'owner']);
});

it('enforces personnel visibility and creation by management role', function () {
    $owner = User::factory()->create();
    $owner->assignRole(['owner', 'admin']);
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $driver = createDriverUser();
    $this->actingAs($owner)->getJson('/admin/personnel?role=admin')->assertOk()->assertJsonCount(1, 'data.users')->assertJsonPath('data.users.0.id', $this->admin->id);
    $this->actingAs($this->admin)->getJson('/admin/personnel?role=admin')->assertUnprocessable();
    $this->actingAs($staff)->getJson('/admin/personnel')->assertOk()->assertJsonCount(1, 'data.roles')->assertJsonPath('data.roles.0.name', 'driver')
        ->assertJsonCount(1, 'data.users')->assertJsonPath('data.users.0.id', $driver->id)->assertJsonPath('data.summary.total', 1);
    $this->putJson("/admin/personnel/users/{$this->admin->id}", personnelPayload($this->admin))->assertUnprocessable();
    $this->deleteJson("/admin/personnel/users/{$staff->id}")->assertUnprocessable();
    $this->putJson("/admin/personnel/users/{$driver->id}", personnelPayload($driver))->assertOk();
    $new = User::factory()->make();
    $payload = [...personnelPayload($new), 'password' => 'Password@123', 'password_confirmation' => 'Password@123'];
    $this->postJson('/admin/personnel/users', $payload)->assertUnprocessable()->assertJsonValidationErrors('role');
    $this->postJson('/admin/personnel/users', [...$payload, 'role' => 'driver'])->assertCreated();
    $newAdmin = User::factory()->make();
    $this->actingAs($owner)->postJson('/admin/personnel/users', [...personnelPayload($newAdmin, ['role' => 'admin']), 'password' => 'Password@123', 'password_confirmation' => 'Password@123'])->assertCreated();
    $createdAdmin = User::where('email', $newAdmin->email)->firstOrFail();
    $this->putJson("/admin/personnel/users/{$createdAdmin->id}", personnelPayload($createdAdmin, ['role' => 'admin', 'first_name' => 'Updated']))->assertOk();
    $this->putJson("/admin/personnel/users/{$createdAdmin->id}", personnelPayload($createdAdmin, ['role' => 'staff']))->assertUnprocessable();
    $this->deleteJson("/admin/personnel/users/{$createdAdmin->id}")->assertOk();
    $this->putJson("/admin/personnel/users/{$staff->id}", personnelPayload($staff, ['role' => 'admin']))->assertUnprocessable();
    $this->deleteJson("/admin/personnel/users/{$owner->id}")->assertUnprocessable();
    $this->actingAs($this->admin)->putJson("/admin/personnel/users/{$this->admin->id}", personnelPayload($this->admin, ['role' => 'admin']))->assertUnprocessable();
    $this->deleteJson("/admin/personnel/users/{$this->admin->id}")->assertUnprocessable();
});
