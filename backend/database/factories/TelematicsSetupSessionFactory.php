<?php

namespace Database\Factories;

use App\Enums\TelematicsSetupStatus;
use App\Models\TelematicsSetupSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<TelematicsSetupSession> */
class TelematicsSetupSessionFactory extends Factory
{
    protected $model = TelematicsSetupSession::class;

    public function definition(): array
    {
        return ['status' => TelematicsSetupStatus::Locked];
    }
}
