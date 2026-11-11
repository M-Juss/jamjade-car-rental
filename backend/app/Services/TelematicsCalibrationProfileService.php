<?php

namespace App\Services;

class TelematicsCalibrationProfileService
{
    public function active(): array
    {
        $id = app()->environment(['local', 'testing']) && config('telematics.calibration_profile') === 'rc_demo'
            ? 'rc_demo' : 'standard';
        $settings = config('telematics.calibration');
        if ($id === 'rc_demo') {
            $settings = array_replace_recursive($settings, config('telematics.calibration_rc_overrides', []));
        }

        // Native coordinates and the forward quality window need fresh setup evidence.
        $profile = ['id' => $id, 'revision' => $id === 'rc_demo' ? 7 : 6, 'settings' => $settings];

        return [...$profile, 'fingerprint' => hash('sha256', json_encode($profile, JSON_THROW_ON_ERROR))];
    }

    public function matches(?array $evidence): bool
    {
        $active = $this->active();
        $saved = $evidence['calibration_profile'] ?? null;
        if ($saved === null) {
            // Existing unprofiled attempts used the standard rules. Their
            // physical test platform is unknown; never relabel them as RC data.
            return $active['id'] === 'standard';
        }

        return ($saved['id'] ?? null) === $active['id']
            && ($saved['revision'] ?? null) === $active['revision']
            && is_string($saved['fingerprint'] ?? null)
            && hash_equals($active['fingerprint'], $saved['fingerprint']);
    }

    public function identity(array $profile): array
    {
        return array_intersect_key($profile, array_flip(['id', 'revision', 'fingerprint']));
    }
}
