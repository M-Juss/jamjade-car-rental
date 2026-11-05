<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\RcProcessingRun;
use App\Support\RcNativeProtocol as Protocol;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Compatibility checks supplement, but cannot replace, the operator's physical-mount confirmation. */
class RcReferenceReuseService
{
    public function __construct(private readonly RcNativeResearchService $research, private readonly RcMotionProcessing $motion) {}

    public function compatibility(RcNativeRecording $target, array $targetManifest, RcNativeRecording $source, array $sourceManifest): ?string
    {
        if ($target->id === $source->id || $target->user_id !== $source->user_id
            || $source->state !== 'verified' || $source->capture_state !== 'stopped'
            || ($sourceManifest['context']['recording_kind'] ?? null) !== 'forward_reference') {
            return 'Use a completed forward-reference recording from this account.';
        }
        if ($source->started_at->getTimestampMs() + $source->duration_ms > $target->started_at->getTimestampMs()) {
            return 'The reference must have finished before this trial started.';
        }
        $targetBinding = $targetManifest['collection_binding'] ?? null;
        $sourceBinding = $sourceManifest['collection_binding'] ?? null;
        if ($targetBinding !== null || $sourceBinding !== null) {
            if (! is_array($targetBinding) || ! is_array($sourceBinding)
                || ($targetBinding['research_session_id'] ?? null) !== ($sourceBinding['research_session_id'] ?? null)
                || ($targetBinding['mount_version_id'] ?? null) !== ($sourceBinding['mount_version_id'] ?? null)) {
                return 'Capture a forward reference for this research session and mount.';
            }
        }
        $targetProfile = $this->profile($targetManifest);
        $sourceProfile = $this->profile($sourceManifest);
        if ($targetProfile === null || $sourceProfile === null) {
            return 'Phone, sensor or mount metadata is incomplete. Capture a new reference and trial.';
        }
        if ($targetProfile['context']['recording_group_id'] !== $sourceProfile['context']['recording_group_id']) {
            return 'The reference belongs to a different collection group.';
        }
        if (Protocol::canonical($targetProfile) !== Protocol::canonical($sourceProfile)) {
            return 'The phone, sensors, mount or surface/slope setup does not match this trial.';
        }

        return null;
    }

    private function profile(array $manifest): ?array
    {
        $profile = [];
        foreach (['context' => ['recording_group_id', 'preset_id', 'rc_model', 'mount_method', 'mount_location',
            'mount_orientation', 'screen_facing', 'phone_top_toward_rc_front', 'surface', 'slope'],
            'device' => ['manufacturer', 'model', 'android_api', 'native_adapter_version']] as $section => $fields) {
            foreach ($fields as $field) {
                $value = $manifest[$section][$field] ?? null;
                if ($value === null || $value === '' || (! is_scalar($value))) {
                    return null;
                }
                $profile[$section][$field] = $value;
            }
        }
        if (! Str::isUuid($profile['context']['recording_group_id'])
            || ($manifest['source'] ?? null) !== 'android_sensor_manager_v2'
            || ($manifest['coordinate_frame'] ?? null) !== 'android_device_natural'
            || ! in_array($manifest['natural_orientation'] ?? null, ['portrait', 'landscape'], true)) {
            return null;
        }
        $profile['natural_orientation'] = $manifest['natural_orientation'];
        foreach (['accelerometer', 'gyroscope'] as $channel) {
            foreach (['sensor_type', 'unit', 'name', 'vendor', 'version', 'maximum_range', 'resolution',
                'min_delay_us', 'max_delay_us', 'wake_up', 'value_layout', 'sampling_period_us', 'max_report_latency_us'] as $field) {
                $value = $manifest['channels'][$channel][$field] ?? null;
                if ($value === null || $value === '') {
                    return null;
                }
                $profile['channels'][$channel][$field] = $value;
            }
            if (($manifest['channels'][$channel]['availability'] ?? null) !== 'registered'
                || $profile['channels'][$channel]['value_layout'] !== ['x', 'y', 'z']) {
                return null;
            }
        }

        return $profile;
    }

    public function runProblem(RcProcessingRun $run, array $payload): ?string
    {
        if ($run->version !== RcMotionProcessing::VERSION || $run->reference_run_id !== null
            || ($payload['version'] ?? null) !== RcMotionProcessing::VERSION
            || ($payload['config']['confirmed'] ?? null) !== true || isset($payload['config']['reference_run_id'])) {
            return 'Choose an original forward-reference processing run; chained references are unavailable.';
        }
        $rest = $payload['config']['ranges']['rest'] ?? [];
        if (! is_array($rest) || count($rest) !== 2 || $rest[1] - $rest[0] < 5000) {
            return 'Reuse requires at least a five-second resting reference window.';
        }

        return null;
    }

    public function resolve(RcNativeRecording $target, array $manifest, RcProcessingRun $run, array $payload): array
    {
        $source = $run->recording;
        abort_unless($source && $source->user_id === $target->user_id, 404);
        $sourceManifest = $this->research->manifest($source);
        $problem = $this->compatibility($target, $manifest, $source, $sourceManifest) ?? $this->runProblem($run, $payload);
        if ($problem) {
            throw ValidationException::withMessages(['reference_run_id' => $problem]);
        }
        abort_unless(($payload['source']['recording_id'] ?? null) === $source->id
            && ($payload['source']['manifest_sha256'] ?? null) === $source->manifest_sha256
            && ($payload['source']['chunk_inventory_sha256'] ?? null) === $sourceManifest['chunk_inventory_sha256'],
            409, 'The saved reference source could not be matched.');
        $config = $payload['config'];
        // Re-read and hash-verify source originals; never use client matrices or fit the maneuver trial.
        $a = $this->research->window($source, 'accelerometer', $config['start_ms'], $config['end_ms'])['events'];
        $g = $this->research->window($source, 'gyroscope', $config['start_ms'], $config['end_ms'])['events'];
        $recomputed = $this->motion->calculate($a, $g, $sourceManifest['started_elapsed_ns'], $config)['reference'];
        foreach (['rotation_rfu', 'acceleration_mean', 'gyroscope_mean'] as $field) {
            abort_unless(Protocol::canonical($recomputed[$field]) === Protocol::canonical($payload['reference'][$field] ?? null),
                409, 'The reference calculation no longer matches its saved version.');
        }

        return ['reference' => $recomputed, 'origin' => ['run_id' => $run->id, 'recording_id' => $source->id,
            'recording_name' => $source->name, 'version' => $run->version, 'run_fingerprint' => $run->fingerprint,
            'payload_sha256' => $run->payload_sha256, 'manifest_sha256' => $source->manifest_sha256,
            'chunk_inventory_sha256' => $sourceManifest['chunk_inventory_sha256'], 'ranges' => $config['ranges'],
            'window' => [$config['start_ms'], $config['end_ms']],
            'setup_sha256' => hash('sha256', Protocol::canonical($this->profile($manifest))),
            'same_mount_confirmed' => true]];
    }
}
