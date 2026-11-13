<?php

use App\Services\RcDemoInferenceService;
use App\Services\RcResearchAccessService;
use App\Services\RcRuntimeForestService;
use App\Services\RentalMotionMonitoringService;
use App\Services\TelematicsCalibrationProfileService;
use App\Services\TelematicsHandoverEligibilityService;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

it('requires both hosted opt-in and the RC profile outside development', function (bool $enabled, string $profile, bool $expected) {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => $enabled, 'telematics.calibration_profile' => $profile]);

    expect(app(RcResearchAccessService::class)->enabled())->toBe($expected)
        ->and(app(RentalMotionMonitoringService::class)->enabled())->toBe($expected)
        ->and(app(TelematicsCalibrationProfileService::class)->active()['id'])->toBe($expected ? 'rc_demo' : 'standard');
})->with([[false, 'rc_demo', false], [true, 'standard', false], [true, 'rc_demo', true]]);

it('keeps release test bypasses disabled in a hosted RC demo', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => true, 'telematics.calibration_profile' => 'rc_demo',
        'telematics.handover_test_mode' => true, 'telematics.early_start_test_mode' => true]);

    expect(app(TelematicsHandoverEligibilityService::class)->testModeEnabled())->toBeFalse()
        ->and(app(TelematicsHandoverEligibilityService::class)->earlyStartTestModeEnabled())->toBeFalse();
});

it('uses the existing PHP runtime in an opted-in hosted demo', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => true, 'telematics.calibration_profile' => 'rc_demo']);
    $input = ['version' => 'rc-demo-inference-v1', 'windows' => []];
    $result = ['version' => 'rc-demo-inference-v1', 'predictions' => []];
    $this->mock(RcRuntimeForestService::class)->shouldReceive('predict')->once()->with($input)->andReturn($result);

    expect(app(RcDemoInferenceService::class)->predict($input))->toBe($result);
});

it('returns unavailable when the hosted private model has not been transferred', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => true, 'telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');
    try {
        app(RcDemoInferenceService::class)->predict(['version' => 'rc-demo-inference-v1',
            'windows' => [['id' => 'one', 'features' => array_fill(0, 35, 0.0)]]]);
        $this->fail('Missing model should be unavailable.');
    } catch (HttpException $exception) {
        expect($exception->getStatusCode())->toBe(503);
    }
});

it('reports a missing private model without exposing its contents', function () {
    $this->app->detectEnvironment(fn () => 'production');
    config(['telematics.hosted_rc_demo' => true, 'telematics.calibration_profile' => 'rc_demo']);
    Storage::fake('local');

    $this->artisan('telematics:check-rental-motion')
        ->expectsOutput('The private runtime model is missing.')
        ->assertFailed();
});
