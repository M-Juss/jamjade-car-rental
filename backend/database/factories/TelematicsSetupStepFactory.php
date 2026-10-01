<?php

namespace Database\Factories;

use App\Enums\TelematicsSetupStepStatus;
use App\Enums\TelematicsSetupStepType;
use App\Models\TelematicsSetupStep;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<TelematicsSetupStep> */
class TelematicsSetupStepFactory extends Factory
{
    protected $model = TelematicsSetupStep::class;

    public function definition(): array
    {
        return [
            'step_type' => TelematicsSetupStepType::DeviceCheck,
            'attempt_number' => 1,
            'status' => TelematicsSetupStepStatus::Pending,
        ];
    }
}
