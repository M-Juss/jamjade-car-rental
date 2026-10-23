<?php

use App\Events\FleetMonitoringChanged;
use App\Models\User;
use App\Services\FleetMonitoringPublisher;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => Str::random(24),
        'broadcasting.connections.reverb.secret' => Str::random(48),
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    Broadcast::purge('reverb');
    require base_path('routes/channels.php');
});

function fleetAuthPayload(array $overrides = []): array
{
    return ['socket_id' => '123.456', 'channel_name' => 'private-fleet-monitoring', ...$overrides];
}

it('signs only the private fleet channel for active permitted web personnel', function () {
    foreach (['admin', 'staff'] as $role) {
        $user = User::factory()->create();
        $user->assignRole($role);
        $response = $this->actingAs($user, 'web')->postJson('/admin/broadcasting/auth', fleetAuthPayload())
            ->assertOk()->assertJsonStructure(['data' => ['auth']]);
        $expected = config('broadcasting.connections.reverb.key').':'.hash_hmac('sha256', '123.456:private-fleet-monitoring', config('broadcasting.connections.reverb.secret'));
        expect($response->json('data.auth'))->toBe($expected)
            ->and($response->headers->get('Cache-Control'))->toContain('no-store');
    }
});

it('denies guests inactive accounts other roles and staff whose permission was revoked', function () {
    $this->postJson('/admin/broadcasting/auth', fleetAuthPayload())->assertUnauthorized();
    foreach (['customer', 'driver'] as $role) {
        $user = User::factory()->create();
        $user->assignRole($role)->givePermissionTo('view fleet tracker');
        $this->actingAs($user)->postJson('/admin/broadcasting/auth', fleetAuthPayload())->assertForbidden();
    }
    $staff = User::factory()->create(['is_active' => false]);
    $staff->assignRole('staff');
    $this->actingAs($staff)->postJson('/admin/broadcasting/auth', fleetAuthPayload())->assertForbidden();
    $staff->update(['is_active' => true]);
    Role::findByName('staff')->revokePermissionTo('view fleet tracker');
    $staff->unsetRelation('roles');
    $this->actingAs($staff)->postJson('/admin/broadcasting/auth', fleetAuthPayload())->assertForbidden();
});

it('validates the socket channel and disallows JSONP', function (array $overrides, string $field) {
    $this->actingAs(vehicleManagerUser())->postJson('/admin/broadcasting/auth', fleetAuthPayload($overrides))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['socket_id' => 'bad'], 'socket_id'],
    [['socket_id' => str_repeat('1', 101)], 'socket_id'],
    [['channel_name' => 'fleet-monitoring'], 'channel_name'],
    [['channel_name' => 'private-other'], 'channel_name'],
    [['callback' => 'handler'], 'callback'],
]);

it('does not accept a mobile bearer token in place of a management web session', function () {
    $user = vehicleManagerUser();
    $token = $user->createToken('test-mobile')->plainTextToken;
    $this->withToken($token)->postJson('/admin/broadcasting/auth', fleetAuthPayload())->assertUnauthorized();
    $this->withToken($token)->getJson('/admin/fleet-tracker')->assertUnauthorized();
});

it('publishes only after commit and does not publish rolled back changes', function () {
    Event::fake([FleetMonitoringChanged::class]);
    DB::transaction(function () {
        app(FleetMonitoringPublisher::class)->changed();
        Event::assertNotDispatched(FleetMonitoringChanged::class);
    });
    Event::assertDispatchedTimes(FleetMonitoringChanged::class, 1);
    DB::beginTransaction();
    app(FleetMonitoringPublisher::class)->changed();
    DB::rollBack();
    Event::assertDispatchedTimes(FleetMonitoringChanged::class, 1);
});

it('keeps rental identifiers locations and models out of socket messages and queued events', function () {
    $event = new FleetMonitoringChanged;
    expect($event->broadcastWith())->toBe([])
        ->and((string) $event->broadcastOn()[0])->toBe('private-fleet-monitoring')
        ->and($event->broadcastAs())->toBe('fleet.changed')
        ->and($event->broadcastQueue())->toBe('fleet-monitoring')
        ->and(get_object_vars($event))->toBe([]);
});

it('isolates unavailable broadcast transport from accepted business work', function () {
    config(['broadcasting.default' => 'null']);
    Event::listen(FleetMonitoringChanged::class, fn () => throw new RuntimeException('Transport unavailable'));
    app(FleetMonitoringPublisher::class)->changed();
    expect(true)->toBeTrue();
});
