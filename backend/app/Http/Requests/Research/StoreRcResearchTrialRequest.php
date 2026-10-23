<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;
use App\Support\RcResearchProtocol;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreRcResearchTrialRequest extends BaseFormRequest
{
    private array $samples = [];

    public function samples(): array
    {
        return $this->samples;
    }

    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return [
            'client_trial_id' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/'],
            'protocol_version' => ['required', 'integer', 'in:1'],
            'intended_movement' => ['required', Rule::in(RcResearchProtocol::MOVEMENTS)],
            'observed_movement' => ['required', Rule::in(RcResearchProtocol::MOVEMENTS)],
            'intended_intensity' => ['required', Rule::in(RcResearchProtocol::INTENSITIES)],
            'observed_intensity' => ['required', Rule::in(RcResearchProtocol::INTENSITIES)],
            'label_status' => ['required', Rule::in(['confirmed', 'uncertain'])],
            'quality' => ['required', Rule::in(['usable', 'interrupted', 'mount_disturbed'])],
            'event_start_ms' => ['required', 'integer', 'min:0', 'max:86400000'],
            'event_end_ms' => ['required', 'integer', 'gt:event_start_ms', 'max:86400000'],
            'notes' => ['nullable', 'string', 'max:500'],
            'started_at' => ['required', 'date_format:Y-m-d\TH:i:s.v\Z'],
            'ended_at' => ['required', 'date_format:Y-m-d\TH:i:s.v\Z', 'after:started_at'],
            'samples_json' => ['required', 'string', 'max:4000000'],
            'summary' => ['prohibited'], 'samples_path' => ['prohibited'], 'user_id' => ['prohibited'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (! $validator->errors()->has('samples_json')) {
                try {
                    if (strlen($this->input('samples_json')) > 4000000) {
                        throw new \RuntimeException;
                    }
                    $samples = json_decode($this->input('samples_json'), true, 32, JSON_THROW_ON_ERROR);
                    if (! is_array($samples) || ! array_is_list($samples) || count($samples) < 8 || count($samples) > 10000) {
                        throw new \RuntimeException;
                    }
                    foreach ($samples as $sample) {
                        if (! is_array($sample) || count($sample) !== count(RcResearchProtocol::SAMPLE_FIELDS)
                            || array_diff(RcResearchProtocol::SAMPLE_FIELDS, array_keys($sample))) {
                            throw new \RuntimeException;
                        }
                        foreach ($sample as $field => $value) {
                            $limit = $field === 'elapsed_ms' ? 86400000
                                : (str_ends_with($field, '_timestamp_s') ? 1000000000000 : 40000);
                            if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value)
                                || abs($value) > $limit) {
                                throw new \RuntimeException;
                            }
                        }
                        if ($sample['elapsed_ms'] < 0 || $sample['elapsed_ms'] > 86400000
                            || ! in_array($sample['orientation'], [-90, 0, 90, 180], true)) {
                            throw new \RuntimeException;
                        }
                    }
                    $this->samples = $samples;
                } catch (\Throwable) {
                    $validator->errors()->add('samples_json', 'The recording contains invalid or incomplete motion samples.');
                }
            }
            foreach (['intended', 'observed'] as $kind) {
                $movement = $this->input($kind.'_movement');
                $intensity = $this->input($kind.'_intensity');
                if (is_string($movement) && in_array($movement, RcResearchProtocol::MOVEMENTS, true)
                    && (RcResearchProtocol::needsIntensity($movement) ? ! in_array($intensity, ['normal', 'harsh'], true) : $intensity !== 'not_applicable')) {
                    $validator->errors()->add($kind.'_intensity', 'Choose an intensity that matches the movement.');
                }
            }
        });
    }
}
