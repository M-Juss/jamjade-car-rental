<?php

namespace App\Console\Commands;

use App\Services\RcRuntimeForestService;
use App\Services\RentalMotionMonitoringService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

class CheckRentalMotion extends Command
{
    protected $signature = 'telematics:check-rental-motion';

    protected $description = 'Check rental motion configuration and private model availability';

    public function handle(RentalMotionMonitoringService $monitoring, RcRuntimeForestService $runtime): int
    {
        if (! $monitoring->enabled()) {
            $this->error('Rental RC motion is not enabled.');

            return self::FAILURE;
        }

        $path = 'rc-research-v2/datasets/models/pilot-split-v3-yaw-forest-v1/runtime-forest-v1.json.encrypted';
        if (! Storage::disk('local')->exists($path)) {
            $this->error('The private runtime model is missing.');

            return self::FAILURE;
        }

        try {
            $runtime->probabilities([array_fill(0, 35, 0.0)]);
        } catch (Throwable) {
            $this->error('The private runtime model cannot be loaded or verified.');

            return self::FAILURE;
        }

        $this->info('Rental RC motion is enabled and the private model is usable.');

        return self::SUCCESS;
    }
}
