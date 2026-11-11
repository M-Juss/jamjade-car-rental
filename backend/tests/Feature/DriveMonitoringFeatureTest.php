<?php

use App\Services\DriveMonitoringFeatureService;

it('extracts sustained yaw phases and mirrored pair measurements', function () {
    $yaw = [...array_fill(0, 6, 2), ...array_fill(0, 3, 0), ...array_fill(0, 6, 2),
        ...array_fill(0, 5, 0), ...array_fill(0, 7, -1)];
    $samples = array_map(fn ($value, $index) => [$index * 20, 0, 0, 0, 0, 0, $value], $yaw, array_keys($yaw));
    $service = app(DriveMonitoringFeatureService::class);
    $values = $service->extract($samples);
    expect($values)->toHaveCount(35)->and($values[30])->toBe(2);
    foreach ([0.14, 7 / 24, 0.14, 0.10] as $index => $expected) {
        expect($values[31 + $index])->toEqualWithDelta($expected, 1e-12);
    }
    $mirrored = array_map(fn ($row) => [...array_slice($row, 0, 6), -$row[6]], $samples);
    expect(array_slice($service->extract($mirrored), 30))->toEqual(array_slice($values, 30));
});

it('keeps zero and single yaw phases finite', function () {
    $service = app(DriveMonitoringFeatureService::class);
    foreach ([0, 1] as $yaw) {
        $rows = array_map(fn ($index) => [$index * 20, 0, 0, 0, 0, 0, $yaw], range(0, 9));
        $values = $service->extract($rows);
        expect($values[30])->toBe($yaw)->and(array_slice($values, 31))->toBe([0.0, 0.0, 0.0, 0.0]);
    }
});
