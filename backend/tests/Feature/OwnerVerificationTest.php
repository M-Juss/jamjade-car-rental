<?php

use App\Mail\OwnerVerificationMail;
use App\Models\DeliveryPricingSetting;
use App\Models\LateReturnPricingSetting;
use App\Models\OwnerVerification;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
    $this->owner = User::factory()->create(['is_active' => true]);
    $this->owner->assignRole('owner', 'admin');
    $this->actingAs($this->owner, 'web');
    $this->values = ['minimum_fee' => 200, 'included_km' => 2, 'per_km_rate' => 40];
    $this->url = '/admin/delivery-pricing';
});

function issueOwnerCode($test): array
{
    $response = $test->withHeaders(['X-Owner-Verification' => 'request'])->putJson($test->url, $test->values)->assertOk();
    $test->flushHeaders();
    $mail = Mail::sent(OwnerVerificationMail::class)->last();

    return [$response->json('data.verificationId'), $mail->code];
}

it('requires a code and binds a single use to the validated write', function () {
    $this->putJson($this->url, $this->values)->assertStatus(428);
    [$id, $code] = issueOwnerCode($this);
    expect($code)->toHaveLength(6);
    Mail::assertSent(OwnerVerificationMail::class, fn ($mail) => $mail->hasTo($this->owner->email));
    $headers = ['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $code];
    $this->withHeaders($headers)->putJson($this->url, [...$this->values, 'minimum_fee' => 201])->assertUnprocessable();
    $this->withHeaders($headers)->putJson($this->url, $this->values)->assertOk();
    expect((float) DeliveryPricingSetting::current()->minimum_fee)->toBe(200.0);
    $this->withHeaders($headers)->putJson($this->url, $this->values)->assertUnprocessable();
});

it('limits wrong codes and rejects expired and stale challenges', function () {
    [$id, $code] = issueOwnerCode($this);
    for ($i = 0; $i < 5; $i++) {
        $this->withHeaders(['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $code === '000000' ? '111111' : '000000'])->putJson($this->url, $this->values)->assertUnprocessable();
    }
    expect(OwnerVerification::findOrFail($id)->failed_attempts)->toBe(5);
    $this->withHeaders(['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $code])->putJson($this->url, $this->values)->assertUnprocessable();
});

it('rejects a code when the underlying settings changed', function () {
    [$id, $code] = issueOwnerCode($this);
    DeliveryPricingSetting::current()->update(['minimum_fee' => 300]);
    $this->withHeaders(['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $code])->putJson($this->url, $this->values)->assertUnprocessable();
});

it('expires codes and rotates them only after the resend delay', function () {
    [$id, $old] = issueOwnerCode($this);
    $this->withHeaders(['X-Owner-Verification' => 'request', 'X-Owner-Verification-Id' => $id])->putJson($this->url, $this->values)->assertStatus(429);
    $this->travel(61)->seconds();
    $this->withHeaders(['X-Owner-Verification' => 'request', 'X-Owner-Verification-Id' => $id])->putJson($this->url, $this->values)->assertOk();
    $new = Mail::sent(OwnerVerificationMail::class)->last()->code;
    expect($new)->not->toBe($old);
    $this->flushHeaders();
    $this->withHeaders(['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $old])->putJson($this->url, $this->values)->assertUnprocessable();
    $this->travel(15)->minutes();
    $this->withHeaders(['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $new])->putJson($this->url, $this->values)->assertUnprocessable();
});

it('does not allow another actor or a removed owner to use a code', function () {
    [$id, $code] = issueOwnerCode($this);
    $admin = User::factory()->create(['is_active' => true]);
    $admin->assignRole('admin');
    $headers = ['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $code];
    $this->actingAs($admin, 'web')->withHeaders($headers)->putJson($this->url, $this->values)->assertUnprocessable();
    $this->owner->removeRole('owner');
    $this->actingAs($this->owner, 'web')->withHeaders($headers)->putJson($this->url, $this->values)->assertStatus(503);
});

it('guards the combined pricing save and commits both settings', function () {
    $this->url = '/admin/fee-pricing';
    $this->values += ['small_vehicle_hourly_rate' => 100, 'large_vehicle_hourly_rate' => 200];
    $this->putJson($this->url, $this->values)->assertStatus(428);
    [$id, $code] = issueOwnerCode($this);
    $this->withHeaders(['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $code])->putJson($this->url, $this->values)->assertOk();
    expect((float) DeliveryPricingSetting::current()->minimum_fee)->toBe(200.0)
        ->and((float) LateReturnPricingSetting::current()->small_vehicle_hourly_rate)->toBe(100.0);
});

it('rejects a code sent to an earlier owner email address', function () {
    [$id, $code] = issueOwnerCode($this);
    $this->owner->update(['email' => 'changed-owner@example.test']);
    $this->withHeaders(['X-Owner-Verification-Id' => $id, 'X-Owner-Code' => $code])
        ->putJson($this->url, $this->values)->assertUnprocessable();
});
