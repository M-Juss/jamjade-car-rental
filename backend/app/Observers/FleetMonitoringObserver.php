<?php

namespace App\Observers;

use App\Models\Booking;
use App\Models\TelematicsTrip;
use App\Services\FleetMonitoringPublisher;

class FleetMonitoringObserver
{
    public function __construct(private readonly FleetMonitoringPublisher $publisher) {}

    public function created(Booking|TelematicsTrip $model): void
    {
        $this->publisher->changed();
    }

    public function updated(Booking|TelematicsTrip $model): void
    {
        $fields = $model instanceof Booking
            ? ['status', 'vehicle_id', 'rental_type', 'rental_start_at', 'rental_end_at']
            : ['status', 'last_location_at', 'latest_location'];
        if ($model->wasChanged($fields)) {
            $this->publisher->changed();
        }
    }

    public function deleted(Booking|TelematicsTrip $model): void
    {
        $this->publisher->changed();
    }

    public function restored(Booking $model): void
    {
        $this->publisher->changed();
    }
}
