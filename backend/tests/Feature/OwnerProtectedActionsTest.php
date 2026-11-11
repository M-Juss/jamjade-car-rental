<?php

use App\Mail\OwnerVerificationMail;
use App\Models\OwnerVerification;
use App\Models\User;
use App\Services\BookingReturnService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RoleAndPermissionSeeder::class);
    Mail::fake();
    Storage::fake('local');
    $this->approvalOwner = User::factory()->create(['is_active' => true]);
    $this->approvalOwner->assignRole(['admin', 'owner']);
    $this->actingAs($this->approvalOwner);
});

function protectedActionCode($test, string $method, string $url, array $payload): array
{
    $issued = $test->json($method, $url, $payload, ['X-Owner-Verification' => 'request'])->assertOk();
    $mail = Mail::sent(OwnerVerificationMail::class)->last();
    expect($mail)->not->toBeNull();
    return ['X-Owner-Verification-Id' => $issued->json('data.verificationId'), 'X-Owner-Code' => $mail->code];
}

it('protects vehicle rate changes while allowing other edits', function () {
    $vehicle = availableVehicle();
    $url = "/admin/vehicles/{$vehicle->id}";
    $this->putJson($url, ['description' => 'Updated description'])->assertOk();
    $payload = ['price_per_day' => 4200];
    $this->putJson($url, $payload)->assertStatus(428);
    expect((float) $vehicle->fresh()->price_per_day)->toBe(3500.0);
    $headers = protectedActionCode($this, 'PUT', $url, $payload);
    $this->putJson($url, $payload, $headers)->assertOk();
    expect((float) $vehicle->fresh()->price_per_day)->toBe(4200.0);
});

it('requires separate approval for a refund decision and recording money returned', function () {
    $booking = policyBooking();
    policyPayment($booking);
    $booking->update(['status' => 'cancelled']);
    $booking->cancellation()->create(['kind' => 'management', 'reason' => 'Customer arrangement']);
    $url = "/admin/bookings/{$booking->id}/refund-review";
    $payload = ['amount' => 250, 'reason' => 'Owner approved cancellation refund'];
    $this->postJson($url, $payload)->assertStatus(428);
    $headers = protectedActionCode($this, 'POST', $url, $payload);
    $this->postJson($url, $payload, $headers)->assertOk();
    expect($booking->fresh()->cancellation->refunded_at)->toBeNull();

    $url = "/admin/bookings/{$booking->id}/record-refund";
    $payload = ['confirmed' => true];
    $this->postJson($url, $payload)->assertStatus(428);
    $headers = protectedActionCode($this, 'POST', $url, $payload);
    $this->postJson($url, $payload, $headers)->assertOk();
    expect($booking->fresh()->cancellation->refunded_at)->not->toBeNull();
});

it('requires approval for charge edits and deletions', function () {
    [$booking, , $charge, $data] = editableLifecycleCharge();
    $this->actingAs($this->approvalOwner);
    $url = "/admin/bookings/{$booking->id}/additional-charges/{$charge->id}";
    $payload = ['charges' => [[...$data, 'amount' => 275]]];
    $this->putJson($url, $payload)->assertStatus(428);
    $headers = protectedActionCode($this, 'PUT', $url, $payload);
    $this->putJson($url, $payload, $headers)->assertOk();
    expect((float) $charge->fresh()->amount)->toBe(275.0);
    $this->deleteJson($url)->assertStatus(428);
    $headers = protectedActionCode($this, 'DELETE', $url, []);
    $this->deleteJson($url, [], $headers)->assertOk();
    $this->assertDatabaseMissing('booking_additional_charges', ['id' => $charge->id]);
});

it('allows the calculated late fee and requires verification for a waiver', function () {
    foreach ([false, true] as $waive) {
        $booking = lateReturnBooking();
        app(BookingReturnService::class)->receive($booking, $this->approvalOwner, now()->toISOString());
        incomingForLateReturn($booking);
        $url = "/admin/bookings/{$booking->id}/review-late-charge";
        $payload = ['amount' => $waive ? 0 : 400, 'responsibility' => 'customer', 'adjustment_reason' => $waive ? 'Approved waiver' : null];
        if ($waive) {
            $this->postJson($url, $payload)->assertStatus(428);
            $headers = protectedActionCode($this, 'POST', $url, $payload);
            $this->postJson($url, $payload, $headers)->assertOk();
        } else {
            $this->postJson($url, $payload)->assertOk();
        }
    }
});

it('rolls back consumption when a protected action fails business validation', function () {
    $booking = policyBooking();
    policyPayment($booking);
    $booking->update(['status' => 'cancelled']);
    $booking->cancellation()->create(['kind' => 'management', 'reason' => 'Arranged cancellation']);
    $url = "/admin/bookings/{$booking->id}/refund-review";
    $payload = ['amount' => 5000, 'reason' => 'Exceeds paid amount'];
    $headers = protectedActionCode($this, 'POST', $url, $payload);
    $this->postJson($url, $payload, $headers)->assertUnprocessable();
    expect(OwnerVerification::findOrFail($headers['X-Owner-Verification-Id'])->consumed_at)->toBeNull();
    expect($booking->fresh()->cancellation->reviewed_at)->toBeNull();
});
