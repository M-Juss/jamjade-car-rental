<?php

use App\Services\RcRuntimeForestService;

function syntheticRuntime(): RcRuntimeForestService
{
    $runtime = new RcRuntimeForestService;
    $tree = ['left' => [1, -1, -1], 'right' => [2, -1, -1], 'feature' => [0, -2, -2],
        'threshold' => [1 + 2 ** -26, -2, -2], 'value' => [[0, 0], [2, 0], [0, 3]]];
    (new ReflectionProperty($runtime, 'forest'))->setValue($runtime, ['classes' => ['a', 'b'], 'trees' => [$tree, $tree]]);

    return $runtime;
}

it('uses float32 feature values before traversing sklearn split thresholds', function () {
    $row = array_fill(0, 35, 0.0);
    $row[0] = 1 + 2 ** -25;
    expect(syntheticRuntime()->probabilities([$row]))->toBe([[1.0, 0.0]]);
    $row[0] = 1 + 2 ** -23;
    expect(syntheticRuntime()->probabilities([$row]))->toBe([[0.0, 1.0]]);
});

it('rejects malformed and float32-overflowing inputs', function () {
    $row = array_fill(0, 35, 0.0);
    $row[0] = 1e300;
    expect(fn () => syntheticRuntime()->probabilities([$row]))->toThrow(RuntimeException::class);
    $row[0] = true;
    expect(fn () => syntheticRuntime()->probabilities([$row]))->toThrow(RuntimeException::class);
    expect(fn () => syntheticRuntime()->probabilities([[]]))->toThrow(RuntimeException::class);
});

it('explains the same float32 traversal and normalized leaf scores as inference', function () {
    $row = array_fill(0, 35, 0.0);
    $row[0] = 1 + 2 ** -25;
    $runtime = syntheticRuntime();
    $explanation = $runtime->explain($row);
    expect($explanation['scores'])->toBe(['a' => 1.0, 'b' => 0.0])
        ->and($explanation['scores'])->toBe(array_combine(['a', 'b'], $runtime->probabilities([$row])[0]))
        ->and($explanation['trees'][0]['path'][0])->toMatchArray([
            'feature' => 0, 'value' => 1.0, 'threshold' => 1 + 2 ** -26, 'operator' => '<=',
        ]);
});

it('averages mixed per-tree leaf class probabilities in the explanation', function () {
    $runtime = new RcRuntimeForestService;
    (new ReflectionProperty($runtime, 'forest'))->setValue($runtime, ['classes' => ['a', 'b'], 'trees' => [
        ['left' => [-1], 'right' => [-1], 'feature' => [-2], 'threshold' => [-2], 'value' => [[1, 3]]],
        ['left' => [-1], 'right' => [-1], 'feature' => [-2], 'threshold' => [-2], 'value' => [[3, 2]]],
    ]]);
    $explanation = $runtime->explain(array_fill(0, 35, 0.0));
    expect($explanation['scores'])->toBe(['a' => 0.425, 'b' => 0.575])
        ->and($explanation['scores'])->toBe(array_combine(['a', 'b'], $runtime->probabilities([array_fill(0, 35, 0.0)])[0]))
        ->and($explanation['prediction'])->toBe('b');
});
