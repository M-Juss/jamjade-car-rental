<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;
use App\Services\TelematicsCalibrationService;

class StoreSetupAttemptRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rules = [
            'status' => ['prohibited'],
            'evidence' => ['required', 'array'],
            'evidence.status' => ['prohibited'],
        ];

        if (str_ends_with((string) $this->route('step'), '_calibration')) {
            $evidenceRules = self::calibrationEvidenceRules();
            $rules['evidence'] = ['required', 'array:'.implode(',', array_keys($evidenceRules))];
            foreach ($evidenceRules as $key => $rule) {
                $rules["evidence.{$key}"] = $rule;
            }
        }

        return $rules;
    }

    public static function calibrationEvidenceRules(): array
    {
        return [
            'protocol_version' => ['required', 'integer', 'in:'.TelematicsCalibrationService::PROTOCOL_VERSION],
            'context' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
            'consent' => ['required', 'boolean', 'accepted'],
            'supervised' => ['required', 'boolean', 'accepted'],
            'started_at' => ['required', 'date_format:Y-m-d\TH:i:s.v\Z'],
            'ended_at' => ['required', 'date_format:Y-m-d\TH:i:s.v\Z', 'after:evidence.started_at'],
            'forward_x' => ['required', 'numeric', 'between:-100,100'],
            'forward_y' => ['required', 'numeric', 'between:-100,100'],
            'forward_z' => ['required', 'numeric', 'between:-100,100'],
            'forward_duration_ms' => ['required', 'numeric', 'between:0,1000'],
            'forward_sample_count' => ['required', 'integer', 'between:0,40'],
            'forward_coherence' => ['required', 'numeric', 'between:0,1'],
            'sample_count' => ['required', 'integer', 'between:1,2000'],
            'sensor_duration_ms' => ['required', 'numeric', 'between:0,60000'],
            'max_gap_ms' => ['required', 'numeric', 'between:0,60000'],
            'linear_rms' => ['required', 'numeric', 'between:0,100'],
            'linear_mean_x' => ['required', 'numeric', 'between:-100,100'],
            'linear_mean_y' => ['required', 'numeric', 'between:-100,100'],
            'linear_mean_z' => ['required', 'numeric', 'between:-100,100'],
            'linear_stddev' => ['required', 'numeric', 'between:0,100'],
            'horizontal_rms' => ['required', 'numeric', 'between:0,100'],
            'rotation_mean_x' => ['required', 'numeric', 'between:-2000,2000'],
            'rotation_mean_y' => ['required', 'numeric', 'between:-2000,2000'],
            'rotation_mean_z' => ['required', 'numeric', 'between:-2000,2000'],
            'rotation_rms' => ['required', 'numeric', 'between:0,2000'],
            'rotation_stddev' => ['required', 'numeric', 'between:0,2000'],
            'rotation_peak' => ['required', 'numeric', 'between:0,2000'],
            'longitudinal_min' => ['required', 'numeric', 'between:-100,100'],
            'longitudinal_max' => ['required', 'numeric', 'between:-100,100', 'gte:evidence.longitudinal_min'],
            'yaw_left_degrees' => ['required', 'numeric', 'between:0,720'],
            'yaw_right_degrees' => ['required', 'numeric', 'between:0,720'],
            'max_tilt_degrees' => ['required', 'numeric', 'between:0,180'],
            'gravity_x' => ['required', 'numeric', 'between:-20,20'],
            'gravity_y' => ['required', 'numeric', 'between:-20,20'],
            'gravity_z' => ['required', 'numeric', 'between:-20,20'],
        ];
    }
}
