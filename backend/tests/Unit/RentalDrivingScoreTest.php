<?php

use App\Services\RentalDrivingScoreService;

it('applies the agreed two and three point deductions', function () {
    $result = (new RentalDrivingScoreService)->calculate([
        'harsh_acceleration' => 2, 'harsh_braking' => 3,
        'harsh_cornering' => 1, 'harsh_swerve' => 2,
    ]);
    expect($result['score'])->toBe(81)
        ->and($result['confirmed_events'])->toBe(8)
        ->and($result['deductions'])->toBe(19)
        ->and($result['breakdown']['harsh_braking'])->toBe(['count' => 3, 'points_each' => 2, 'deduction' => 6]);
});

it('keeps the calculation between zero and one hundred', function () {
    $service = new RentalDrivingScoreService;
    expect($service->calculate([])['score'])->toBe(100)
        ->and($service->calculate(['harsh_swerve' => 40])['score'])->toBe(0);
});

it('withholds a perfect score when no readings were received', function () {
    $service = new RentalDrivingScoreService;
    expect($service->forReceivedReadings([], false)['score'])->toBeNull()
        ->and($service->forReceivedReadings([], false)['status'])->toBe('not_graded')
        ->and($service->forReceivedReadings([], true)['score'])->toBe(100)
        ->and($service->forReceivedReadings([], true)['status'])->toBe('provisional');
});
