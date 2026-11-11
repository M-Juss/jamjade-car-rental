<?php

namespace App\Services;

use Throwable;

class RcDemoInferenceService
{
    public const MODEL_SHA256 = '4812bc8090d396b414db06ed9e6373b078ba610d43e4adf5e7fbf54133c14d18';

    public function predict(array $input): array
    {
        abort_unless(app()->isLocal(), 503, 'RC demo inference is unavailable.');
        try {
            return app(RcRuntimeForestService::class)->predict($input);
        } catch (Throwable) {
            abort(503, 'Drive Monitoring classification is unavailable. Check the private model and retry.');
        }
    }
}
