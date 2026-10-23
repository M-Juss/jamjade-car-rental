<?php

use App\Enums\UserRole;
use App\Models\User;
use App\Services\NotificationService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Pagination\Cursor;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
});

it('lists only the mobile account notifications with filtering and pagination', function (string $role) {
    $user = User::factory()->create();
    $user->assignRole($role);
    $service = app(NotificationService::class);
    $assignment = $service->createForUser($user, 'booking', 'New service assignment', 'A service was assigned.');
    $payment = $service->createForUser($user, 'payment', 'Additional Charge Assigned', 'Review your charge.');
    $other = $service->createForUser(createDriverUser(), 'booking', 'Other assignment', 'Another account update.');
    Sanctum::actingAs($user);

    $response = $this->getJson('/api/mobile/notifications?per_page=1')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.last_page', 2);
    expect($response->json('data.0.id'))->not->toBe((string) $other->id);

    $this->getJson('/api/mobile/notifications?category=booking')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', (string) $assignment->id);
    $this->getJson('/api/mobile/notifications?category=payment')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', (string) $payment->id);
})->with([UserRole::Customer->value, UserRole::Driver->value]);

it('allows a Driver to read only their own notifications', function () {
    $driver = createDriverUser();
    $service = app(NotificationService::class);
    $own = $service->createForUser($driver, 'booking', 'New service assignment', 'A service was assigned.');
    $other = $service->createForUser(createDriverUser(), 'booking', 'Other assignment', 'Another account update.');
    Sanctum::actingAs($driver);

    $this->postJson("/api/mobile/notifications/{$own->id}/read")
        ->assertOk()
        ->assertJsonPath('data.isRead', true);
    $this->postJson("/api/mobile/notifications/{$other->id}/read")->assertForbidden();

    expect($own->fresh()->read_at)->not->toBeNull()
        ->and($other->fresh()->read_at)->toBeNull();
});

it('marks all notifications read only for the authenticated Driver', function () {
    $driver = createDriverUser();
    $service = app(NotificationService::class);
    $own = $service->createForUser($driver, 'booking', 'New service assignment', 'A service was assigned.');
    $other = $service->createForUser(createDriverUser(), 'booking', 'Other assignment', 'Another account update.');
    Sanctum::actingAs($driver);

    $this->postJson('/api/mobile/notifications/read-all')
        ->assertOk()
        ->assertJsonPath('data.updated', 1);

    expect($own->fresh()->read_at)->not->toBeNull()
        ->and($other->fresh()->read_at)->toBeNull();
});

it('validates notification filters for Drivers', function () {
    Sanctum::actingAs(createDriverUser());

    $this->getJson('/api/mobile/notifications?category=unknown&per_page=101')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['category', 'per_page']);
});

it('keeps the mobile notification list unavailable to management roles', function (string $role) {
    $user = User::factory()->create();
    $user->assignRole($role);
    Sanctum::actingAs($user);

    $this->getJson('/api/mobile/notifications')->assertForbidden();
})->with([UserRole::Admin->value, UserRole::Staff->value]);

it('requires authentication to list mobile notifications', function () {
    $this->getJson('/api/mobile/notifications')->assertUnauthorized();
});

it('continues ten recent notifications in batches of five without skipping tied timestamps or new arrivals', function (string $role) {
    $user = User::factory()->create();
    $user->assignRole($role);
    Sanctum::actingAs($user);
    $service = app(NotificationService::class);
    $ids = collect(range(1, 23))->map(fn ($i) => (string) $service->createForUser($user, 'system', "Update {$i}", 'Test update.')->id);
    $other = $service->createForUser(createDriverUser(), 'system', 'Other account', 'Private update.');
    $first = $this->getJson('/api/mobile/notifications?pagination=cursor&per_page=10')
        ->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.has_more', true)
        ->assertJsonPath('meta.unread_count', 23);
    $seen = collect($first->json('data'))->pluck('id');
    expect($seen->all())->toBe($ids->reverse()->take(10)->values()->all());
    $new = $service->createForUser($user, 'system', 'New arrival', 'Arrived during scrolling.');
    $cursor = $first->json('meta.next_cursor');
    foreach ([5, 5, 3] as $size) {
        $next = $this->getJson('/api/mobile/notifications?pagination=cursor&per_page=5&cursor='.urlencode($cursor))
            ->assertOk()->assertJsonCount($size, 'data')->assertJsonPath('meta.unread_count', 24);
        $seen = $seen->concat(collect($next->json('data'))->pluck('id'));
        $cursor = $next->json('meta.next_cursor');
    }
    $next->assertJsonPath('meta.has_more', false)->assertJsonPath('meta.next_cursor', null);
    expect($seen->all())->toBe($ids->reverse()->values()->all())
        ->and($seen->unique()->count())->toBe(23)
        ->and($seen->contains((string) $new->id))->toBeFalse()
        ->and($seen->contains((string) $other->id))->toBeFalse();
    $this->getJson('/api/mobile/notifications?pagination=cursor&per_page=10')
        ->assertJsonPath('data.0.id', (string) $new->id);
})->with([UserRole::Customer->value, UserRole::Driver->value]);

it('reports the end of a preview for zero through ten notifications', function (int $count) {
    $user = User::factory()->create();
    $user->assignRole(UserRole::Customer->value);
    Sanctum::actingAs($user);
    for ($i = 0; $i < $count; $i++) {
        app(NotificationService::class)->createForUser($user, 'system', 'Update', 'Test update.');
    }
    $this->getJson('/api/mobile/notifications?pagination=cursor&per_page=10')
        ->assertOk()->assertJsonCount($count, 'data')
        ->assertJsonPath('meta.has_more', false)->assertJsonPath('meta.next_cursor', null);
})->with([0, 4, 10]);

it('counts unread notifications beyond the preview and marks unloaded records read', function (string $role) {
    $user = User::factory()->create();
    $user->assignRole($role);
    Sanctum::actingAs($user);
    $service = app(NotificationService::class);
    $oldest = $service->createForUser($user, 'system', 'Old update', 'Old notification.');
    for ($i = 0; $i < 12; $i++) {
        $service->createForUser($user, 'payment', 'Payment update', 'Payment notification.');
    }
    $other = $service->createForUser(createDriverUser(), 'system', 'Other update', 'Other notification.');
    $this->getJson('/api/mobile/notifications/unread-count')->assertOk()->assertJsonPath('data.unreadCount', 13);
    $this->postJson("/api/mobile/notifications/{$oldest->id}/read")
        ->assertOk()->assertJsonPath('meta.unread_count', 12);
    $this->postJson("/api/mobile/notifications/{$oldest->id}/read")
        ->assertOk()->assertJsonPath('meta.unread_count', 12);
    $this->getJson('/api/mobile/notifications?pagination=cursor&per_page=10&category=system')
        ->assertOk()->assertJsonPath('meta.unread_count', 12);
    $this->postJson('/api/mobile/notifications/read-all')
        ->assertOk()->assertJsonPath('data.updated', 12)->assertJsonPath('meta.unread_count', 0);
    expect($other->fresh()->read_at)->toBeNull();
    $this->getJson('/api/mobile/notifications/unread-count')->assertJsonPath('data.unreadCount', 0);
})->with([UserRole::Customer->value, UserRole::Driver->value]);

it('rejects malformed notification continuation cursors', function (string $cursor) {
    Sanctum::actingAs(createDriverUser());
    $this->getJson('/api/mobile/notifications?pagination=cursor&cursor='.urlencode($cursor))
        ->assertUnprocessable()->assertJsonValidationErrors(['cursor']);
})->with([
    'not-a-cursor',
    (new Cursor(['id' => 1]))->encode(),
    (new Cursor(['id' => 1, 'created_at' => 'invalid']))->encode(),
    (new Cursor(['id' => 1, 'created_at' => '2026-10-16 00:00:00'], false))->encode(),
]);

it('protects unread counts from management accounts and guests', function () {
    $this->getJson('/api/mobile/notifications/unread-count')->assertUnauthorized();
    $user = User::factory()->create();
    $user->assignRole(UserRole::Staff->value);
    Sanctum::actingAs($user);
    $this->getJson('/api/mobile/notifications/unread-count')->assertForbidden();
});
