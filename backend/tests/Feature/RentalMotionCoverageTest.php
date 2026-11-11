<?php

use App\Models\Booking;
use App\Models\DriveMonitoringSession;
use App\Models\User;
use App\Services\RentalMotionCoverageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('merges overlapping windows and retries without counting time twice', function () {
    $session = DriveMonitoringSession::create([
        'user_id' => User::factory()->create()->id, 'client_session_id' => (string) Str::uuid(),
        'status' => 'active', 'model_sha256' => str_repeat('a', 64),
        'coverage_version' => 1, 'consented_at' => now(),
    ]);
    $service = app(RentalMotionCoverageService::class);
    $windows = [['start_ms' => 0, 'end_ms' => 400], ['start_ms' => 200, 'end_ms' => 600],
        ['start_ms' => 1000, 'end_ms' => 1400]];
    DB::transaction(function () use ($service, $session, $windows) {
        $service->receive($session, $windows);
        $service->receive($session, $windows);
    });
    $intervals = DB::table('rental_motion_intervals')->where('session_id', $session->id)->orderBy('start_ms')->get();
    expect($intervals)->toHaveCount(2)
        ->and((int) $intervals[0]->start_ms)->toBe(0)
        ->and((int) $intervals[0]->end_ms)->toBe(600);
    $service->receive($session, [['start_ms' => 400, 'end_ms' => 1200]]);
    expect(DB::table('rental_motion_intervals')->count())->toBe(1);
    $session->update(['coverage_version' => null]);
    $service->receive($session, [['start_ms' => 1400, 'end_ms' => 1800]]);
    expect((int) DB::table('rental_motion_intervals')->value('end_ms'))->toBe(1400);
});

it('does not invent a coverage percentage when release timing is missing', function () {
    $booking = new Booking;
    $booking->setRelation('telematicsSetupSession', null);
    $booking->setRelation('returnRecord', null);
    $booking->setRelation('telematicsTrip', null);
    $result = app(RentalMotionCoverageService::class)->forBooking($booking, null);
    expect($result['percent'])->toBeNull()->and($result['analyzed_ms'])->toBeNull();
});
