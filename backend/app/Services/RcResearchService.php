<?php

namespace App\Services;

use App\Models\RcResearchSession;
use App\Models\RcResearchTrial;
use App\Models\User;
use App\Support\RcResearchProtocol;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RcResearchService
{
    public function session(User $user, string $id): RcResearchSession
    {
        $session = RcResearchSession::findOrFail($id);
        Gate::forUser($user)->authorize('view', $session);

        return $session;
    }

    public function createSession(User $user, array $input): RcResearchSession
    {
        unset($input['consent']);

        return RcResearchSession::create([...$input, 'user_id' => $user->id,
            'added_load_g' => 0, 'protocol' => RcResearchProtocol::settings(), 'consented_at' => now()]);
    }

    public function storeTrial(RcResearchSession $session, array $input, array $samples): RcResearchTrial
    {
        $summary = $this->summarize($input, $samples);
        unset($input['samples_json'], $input['protocol_version']);
        $content = json_encode(['protocol' => $session->protocol, 'trial' => $input, 'samples' => $samples], JSON_THROW_ON_ERROR);
        $hash = hash('sha256', $content);

        $writtenPath = null;
        try {
            return DB::transaction(function () use ($session, $input, $summary, $content, $hash, &$writtenPath) {
                RcResearchSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
                $existing = $session->trials()->withTrashed()->where('client_trial_id', $input['client_trial_id'])->first();
                if ($existing) {
                    abort_if($existing->trashed() || ! hash_equals($existing->content_hash, $hash), 409,
                        'This recording was already saved with different details or deleted.');

                    return $existing->load('session');
                }
                $path = 'rc-research/'.Str::uuid().'.encrypted';
                abort_unless(Storage::disk('local')->put($path, Crypt::encryptString($content)), 503,
                    'The recording could not be saved. Try again.');
                $writtenPath = $path;

                return $session->trials()->create([...$input, 'samples_path' => $path,
                    'content_hash' => $hash, 'summary' => $summary])->load('session');
            });
        } catch (\Throwable $error) {
            if ($writtenPath !== null) {
                Storage::disk('local')->delete($writtenPath);
            }
            throw $error;
        }
    }

    public function trial(User $user, string $id, bool $withDeleted = false): RcResearchTrial
    {
        $trial = RcResearchTrial::with('session')->when($withDeleted, fn ($query) => $query->withTrashed())->findOrFail($id);
        Gate::forUser($user)->authorize('view', $trial->session);

        return $trial;
    }

    public function deleteTrial(RcResearchTrial $trial): void
    {
        DB::transaction(function () use ($trial) {
            // Serialize with uploads so a retry cannot restore a deleted trial.
            RcResearchSession::whereKey($trial->session_id)->lockForUpdate()->firstOrFail();
            $record = RcResearchTrial::withTrashed()->whereKey($trial->id)->lockForUpdate()->firstOrFail();
            if ($record->samples_path !== null) {
                // Keep a failed deletion visible so the Admin can retry from Data.
                abort_unless(Storage::disk('local')->delete($record->samples_path), 503,
                    'The recording could not be completely deleted. Try again.');
            }
            $record->delete();
            $record->forceFill(['samples_path' => null, 'notes' => null, 'summary' => []])->save();
        });
    }

    private function summarize(array $input, array $samples): array
    {
        $start = CarbonImmutable::parse($input['started_at']);
        $end = CarbonImmutable::parse($input['ended_at']);
        $duration = $start->diffInMilliseconds($end);
        if ($duration < 1000 || $duration > 86400000 || $start->isAfter(now()->addSeconds(10)) || $end->isAfter(now()->addSeconds(10))) {
            throw ValidationException::withMessages(['ended_at' => 'Recording must last at least one second and have valid timestamps.']);
        }
        $first = $samples[0];
        $previous = null;
        $linearSquared = $rotationSquared = $rotationPeak = $maxGap = $maxTilt = 0;
        $gravity = $linear = $rotation = [0, 0, 0];
        $initialGravity = array_map(fn ($axis) => $first['including_gravity_'.$axis] - $first['linear_'.$axis], ['x', 'y', 'z']);
        $initialMagnitude = sqrt(array_sum(array_map(fn ($v) => $v * $v, $initialGravity)));
        if ($initialMagnitude < 1) {
            throw ValidationException::withMessages(['samples_json' => 'The gravity reference is unavailable. Repeat the recording.']);
        }
        foreach ($samples as $sample) {
            $timestamp = $sample['acceleration_timestamp_s'];
            if ($timestamp < 0 || abs($timestamp - $sample['gravity_timestamp_s']) > 0.101
                || abs($timestamp - $sample['rotation_timestamp_s']) > 0.101
                || $sample['elapsed_ms'] > $duration + 250
                || $previous && ($timestamp <= $previous['acceleration_timestamp_s'] || $sample['elapsed_ms'] <= $previous['elapsed_ms']
                    || $sample['gravity_timestamp_s'] < $previous['gravity_timestamp_s'] || $sample['rotation_timestamp_s'] < $previous['rotation_timestamp_s'])) {
                throw ValidationException::withMessages(['samples_json' => 'The recording timing is inconsistent. Repeat the recording.']);
            }
            $maxGap = max($maxGap, $previous ? ($timestamp - $previous['acceleration_timestamp_s']) * 1000 : $sample['elapsed_ms'],
                $previous ? $sample['elapsed_ms'] - $previous['elapsed_ms'] : 0);
            $pointRotation = $pointLinear = 0;
            $pointGravity = [];
            foreach (['x', 'y', 'z'] as $index => $axis) {
                $linear[$index] += $sample['linear_'.$axis];
                $rotation[$index] += $sample['rotation_'.$axis];
                $pointGravity[$index] = $sample['including_gravity_'.$axis] - $sample['linear_'.$axis];
                $gravity[$index] += $pointGravity[$index];
                $pointLinear += $sample['linear_'.$axis] ** 2;
                $pointRotation += $sample['rotation_'.$axis] ** 2;
            }
            $gravityMagnitude = sqrt(array_sum(array_map(fn ($v) => $v * $v, $pointGravity)));
            if ($gravityMagnitude < 1) {
                throw ValidationException::withMessages(['samples_json' => 'The recording contains an invalid gravity reference.']);
            }
            $dot = array_sum(array_map(fn ($i) => $pointGravity[$i] * $initialGravity[$i], [0, 1, 2]));
            $maxTilt = max($maxTilt, rad2deg(acos(max(-1, min(1, $dot / ($gravityMagnitude * $initialMagnitude))))));
            $linearSquared += $pointLinear;
            $rotationSquared += $pointRotation;
            $rotationPeak = max($rotationPeak, sqrt($pointRotation));
            $previous = $sample;
        }
        $span = ($previous['acceleration_timestamp_s'] - $first['acceleration_timestamp_s']) * 1000;
        if ($span <= 0 || $span > $duration + 250 || $input['event_end_ms'] > $duration) {
            throw ValidationException::withMessages(['event_end_ms' => 'The event must fall inside the recorded interval.']);
        }
        $count = count($samples);
        $rate = ($count - 1) * 1000 / $span;
        $maxGap = max($maxGap, $duration - $previous['elapsed_ms']);
        $flags = array_values(array_filter([
            $rate < 8 ? 'low_sample_rate' : null, $maxGap > 250 ? 'sample_gaps' : null,
            $span / $duration < 0.85 ? 'limited_coverage' : null,
        ]));

        return ['sample_count' => $count, 'duration_ms' => $duration, 'sensor_duration_ms' => $span,
            'mean_rate_hz' => $rate, 'max_gap_ms' => $maxGap, 'linear_rms' => sqrt($linearSquared / $count),
            'rotation_rms' => sqrt($rotationSquared / $count), 'rotation_peak' => $rotationPeak, 'max_tilt_degrees' => $maxTilt,
            'linear_mean' => array_map(fn ($v) => $v / $count, $linear), 'rotation_mean' => array_map(fn ($v) => $v / $count, $rotation),
            'gravity_mean' => array_map(fn ($v) => $v / $count, $gravity), 'quality_flags' => $flags,
            'eligible_for_training' => ! $flags && $input['quality'] === 'usable' && $input['label_status'] === 'confirmed'];
    }
}
