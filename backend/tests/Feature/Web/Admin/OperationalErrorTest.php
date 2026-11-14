<?php

use App\Models\OperationalError;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\OperationalErrorService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);
beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
});

it('restricts reading to active administrators and removes resolution', function () {
    $staff = User::factory()->create();
    $staff->assignRole('staff');
    $this->actingAs($staff)->getJson('/admin/errors')->assertForbidden();
    $this->actingAs($this->admin)->getJson('/admin/errors')->assertOk();
    $this->postJson('/admin/errors/1/resolve')->assertNotFound();
    $this->admin->update(['is_active' => false]);
    $this->getJson('/admin/errors')->assertForbidden();
});

it('combines safe business actions and failures with actors', function () {
    activity()->causedBy($this->admin)->event('vehicle_updated')->withProperties(['secret' => 'DO NOT EXPOSE'])->log('DO NOT EXPOSE');
    $this->actingAs($this->admin);
    app(OperationalErrorService::class)->record('payment');
    $response = $this->getJson('/admin/errors')->assertOk()->assertJsonCount(2, 'data');
    expect($response->json('data.0.performedBy'))->toBe($this->admin->name);
    expect(collect($response->json('data'))->pluck('status')->sort()->values()->all())->toBe(['failed', 'success']);
    expect($response->getContent())->not->toContain('DO NOT EXPOSE');
});

it('filters search module action and status excluding telematics and research', function () {
    foreach (['vehicle_created', 'vehicle_deleted', 'telematics_trip_started', 'mobile_rc_research_login'] as $event) {
        activity()->causedBy($this->admin)->event($event)->log('Internal description');
    }
    $this->actingAs($this->admin)->getJson('/admin/errors?module=vehicles&action=created&status=success&search='.urlencode($this->admin->name))
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.message', 'Created vehicle');
    $this->getJson('/admin/errors')->assertJsonCount(2, 'data');
    foreach (['status=open', 'action=status_changed', 'module=telematics', 'search[]=invalid'] as $filter) {
        $this->getJson('/admin/errors?'.$filter)->assertUnprocessable();
    }
});

it('keeps historical failures without inventing an actor', function () {
    OperationalError::create(['category' => 'settings', 'resolved_at' => now()]);
    $this->actingAs($this->admin)->getJson('/admin/errors?status=failed')->assertOk()
        ->assertJsonPath('data.0.performedBy', 'Not recorded')->assertJsonPath('data.0.status', 'failed');
});

it('records supported failures with the actor for each attempt', function () {
    $this->actingAs($this->admin);
    $service = app(OperationalErrorService::class);
    $service->record('settings');
    $service->record('settings');
    $service->record('sensitive untrusted text');
    expect(OperationalError::count())->toBe(2);
    expect(OperationalError::first()->actor_user_id)->toBe($this->admin->id);
});

it('paginates the combined log without rolled back successes', function () {
    for ($i = 0; $i < 12; $i++) {
        activity()->causedBy($this->admin)->event('vehicle_created')->log('Created');
    }
    try {
        DB::transaction(function () {
            activity()->causedBy($this->admin)->event('vehicle_deleted')->log('Rolled back');
            throw new RuntimeException('Rollback');
        });
    } catch (RuntimeException) {
    }
    $this->actingAs($this->admin)->getJson('/admin/errors')->assertOk()->assertJsonCount(10, 'data')->assertJsonPath('meta.total', 12);
    $this->getJson('/admin/errors?page=2')->assertJsonCount(2, 'data');
    $this->getJson('/admin/errors?action=deleted')->assertJsonCount(0, 'data');
});

it('captures server failures on business writes excluding validation and telematics', function () {
    Route::middleware(['web', 'auth'])->post('/admin/personnel/audit-failure-test', fn () => abort(503, 'private details'));
    Route::middleware(['web', 'auth'])->post('/admin/personnel/audit-validation-test', fn () => throw ValidationException::withMessages(['name' => 'Required']));
    Route::middleware(['web', 'auth'])->post('/admin/telematics/audit-failure-test', fn () => abort(503));
    $this->actingAs($this->admin)->postJson('/admin/personnel/audit-failure-test')->assertStatus(503);
    $this->postJson('/admin/personnel/audit-validation-test')->assertUnprocessable();
    $this->postJson('/admin/telematics/audit-failure-test')->assertStatus(503);
    expect(OperationalError::count())->toBe(1);
    expect(OperationalError::first()->category)->toBe('personnel');
});

it('allows owners with admin membership', function () {
    $owner = User::factory()->create();
    $owner->assignRole(['owner', 'admin']);
    $this->actingAs($owner)->getJson('/admin/errors')->assertOk();
});

it('includes historical pricing changes document decisions and personnel deletions', function () {
    activity('delivery-pricing')->causedBy($this->admin)->log('Historical pricing');
    activity('late-return-pricing')->causedBy($this->admin)->log('Historical pricing');
    activity()->causedBy($this->admin)->event('document_reviewed')->withProperties(['status' => 'approved'])->log('Old approval');
    activity()->causedBy($this->admin)->event('document_reviewed')->withProperties(['status' => 'rejected'])->log('Old rejection');
    activity()->causedBy($this->admin)->event('personnel_permanently_deleted')->log('Historical deletion');
    $this->actingAs($this->admin)->getJson('/admin/errors?module=settings&action=updated')->assertOk()->assertJsonCount(2, 'data');
    $this->getJson('/admin/errors?action=approved')->assertJsonCount(1, 'data')->assertJsonPath('data.0.message', 'Approved verification document');
    $this->getJson('/admin/errors?action=rejected')->assertJsonCount(1, 'data')->assertJsonPath('data.0.message', 'Rejected verification document');
    $this->getJson('/admin/errors?action=deleted')->assertJsonCount(1, 'data');
    $this->getJson('/admin/errors?search=pricing')->assertJsonCount(2, 'data');
    $this->getJson('/admin/errors')->assertJsonPath('meta.total', 5);
});

it('handles every module action status combination including empty pages', function () {
    activity()->causedBy($this->admin)->event('vehicle_updated')->log('Update');
    $this->actingAs($this->admin);
    app(OperationalErrorService::class)->record('settings');
    $service = app(AuditLogService::class);
    foreach (['all', 'bookings', 'payments', 'vehicles', 'maintenance', 'personnel', 'documents', 'settings'] as $module) {
        foreach (['all', 'created', 'updated', 'deleted', 'approved', 'rejected'] as $action) {
            foreach (['all', 'success', 'failed'] as $status) {
                $result = $service->paginate(compact('module', 'action', 'status'));
                $expected = ($module === 'all' || $module === 'vehicles') && ($action === 'all' || $action === 'updated') && $status !== 'failed' ? 1 : 0;
                $expected += ($module === 'all' || $module === 'settings') && ($action === 'all' || $action === 'updated') && $status !== 'success' ? 1 : 0;
                expect($result->total())->toBe($expected);
                expect($result->items())->toHaveCount($expected);
            }
        }
    }
});

it('shows only new entries after the saved start boundary without deleting history', function () {
    $old = activity()->causedBy($this->admin)->event('vehicle_updated')->log('Old activity');
    $failure = OperationalError::create(['category' => 'settings']);
    DB::table('activity_log_settings')->where('id', 1)->update([
        'activity_after_id' => $old->id, 'failure_after_id' => $failure->id,
    ]);
    activity()->causedBy($this->admin)->event('vehicle_created')->log('New activity');
    $this->actingAs($this->admin);
    app(OperationalErrorService::class)->record('settings');
    $this->getJson('/admin/errors')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2);
    $this->getJson('/admin/errors?status=success')->assertJsonCount(1, 'data')->assertJsonPath('data.0.message', 'Created vehicle');
    $this->getJson('/admin/errors?status=failed')->assertJsonCount(1, 'data');
    $this->assertDatabaseHas('activity_log', ['id' => $old->id]);
    $this->assertDatabaseHas('operational_errors', ['id' => $failure->id]);
});

it('excludes retired technical issues and rejects the technical filter', function () {
    OperationalError::create(['category' => 'address']);
    $this->actingAs($this->admin)->getJson('/admin/errors')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/admin/errors?module=technical')->assertUnprocessable();
    app(OperationalErrorService::class)->record('address');
    expect(OperationalError::count())->toBe(1);
});
