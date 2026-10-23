<?php

namespace App\Services;

use App\Events\FleetMonitoringChanged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class FleetMonitoringPublisher
{
    public function changed(): void
    {
        DB::afterCommit(function () {
            try {
                event(new FleetMonitoringChanged);
            } catch (Throwable) {
                // A notification failure must not reject an accepted location or rental action.
                Log::warning('Fleet Monitoring notification could not be queued.');
            }
        });
    }
}
