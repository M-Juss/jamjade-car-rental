<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

// Invalidation only: queued jobs and socket messages contain no rental or GPS data.
class FleetMonitoringChanged implements ShouldBroadcast
{
    public function broadcastOn(): array
    {
        return [new PrivateChannel('fleet-monitoring')];
    }

    public function broadcastAs(): string
    {
        return 'fleet.changed';
    }

    public function broadcastWith(): array
    {
        return [];
    }

    public function broadcastQueue(): string
    {
        return 'fleet-monitoring';
    }
}
