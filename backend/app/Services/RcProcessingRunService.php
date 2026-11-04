<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\RcProcessingRun;
use App\Support\RcNativeProtocol as Protocol;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RcProcessingRunService
{
    public function __construct(private readonly RcNativeResearchService $research, private readonly RcMotionProcessing $motion,
        private readonly RcReferenceReuseService $reuse) {}

    public function referenceOptions(RcNativeRecording $target, int $perPage): LengthAwarePaginator
    {
        $manifest = $this->research->manifest($target);
        abort_unless($target->state === 'verified' && ($manifest['context']['recording_kind'] ?? null) === 'maneuver_trial', 422,
            'Reference selection is available for uploaded maneuver trials.');
        $page = RcProcessingRun::with('recording')->where('version', RcMotionProcessing::VERSION)->whereNull('reference_run_id')
            ->whereHas('recording', fn ($q) => $q->where('user_id', $target->user_id)->where('state', 'verified')->where('id', '!=', $target->id)
                ->where('started_at', '<=', $target->started_at))
            ->latest('created_at')->orderByDesc('id')->paginate($perPage);
        $page->setCollection($page->getCollection()->map(function (RcProcessingRun $run) use ($target, $manifest) {
            try {
                $reason = $this->reuse->compatibility($target, $manifest, $run->recording, $this->research->manifest($run->recording))
                    ?? $this->reuse->runProblem($run, $this->result($run));
            } catch (HttpException $error) {
                if ($error->getStatusCode() !== 503) {
                    throw $error;
                }
                $reason = 'The reference file could not be verified.';
            }

            return ['id' => $run->id, 'recording_id' => $run->recording_id, 'recording_name' => $run->recording->name,
                'created_at' => $run->created_at->toISOString(), 'cutoff_hz' => $run->cutoff_hz,
                'compatible' => $reason === null, 'unavailable_reason' => $reason];
        }));

        return $page;
    }

    public function create(RcNativeRecording $record, array $input): RcProcessingRun
    {
        $written = null;
        try {
            return DB::transaction(function () use ($record, $input, &$written) {
                $record = RcNativeRecording::whereKey($record->id)->lockForUpdate()->firstOrFail();
                abort_unless($record->state === 'verified', 409, 'Finish uploading this recording before processing.');
                abort_unless($input['end_ms'] <= $record->duration_ms, 422, 'The window extends beyond this recording.');
                $manifest = $this->research->manifest($record);
                $reusing = isset($input['reference_run_id']);
                abort_unless($manifest['context']['recording_kind'] === ($reusing ? 'maneuver_trial' : 'forward_reference'), 422,
                    'Choose reference intervals for a forward recording, or a saved reference for a maneuver trial.');
                $config = ['start_ms' => (float) $input['start_ms'], 'end_ms' => (float) $input['end_ms'],
                    'cutoff_hz' => (int) $input['cutoff_hz'], 'confirmed' => true];
                $referenceRun = null;
                $resolved = null;
                if ($reusing) {
                    $referenceRun = RcProcessingRun::whereHas('recording', fn ($q) => $q->where('user_id', $record->user_id))->findOrFail($input['reference_run_id']);
                    $resolved = $this->reuse->resolve($record, $manifest, $referenceRun, $this->result($referenceRun));
                    $config['reference_run_id'] = $referenceRun->id;
                    $config['same_mount_confirmed'] = true;
                } else {
                    $config['ranges'] = [];
                    foreach (['rest', 'starting', 'stopping'] as $phase) {
                        $config['ranges'][$phase] = array_map('floatval', $input['ranges'][$phase]);
                    }
                }
                $version = $reusing ? RcMotionProcessing::REUSE_VERSION : RcMotionProcessing::VERSION;
                $source = ['recording_id' => $record->id, 'manifest_sha256' => $record->manifest_sha256,
                    'chunk_inventory_sha256' => $manifest['chunk_inventory_sha256'], 'protocol_version' => 2];
                $identity = ['version' => $version, 'source' => $source, 'config' => $config];
                if ($resolved) {
                    $identity['reference_origin'] = $resolved['origin'];
                }
                $fingerprint = hash('sha256', Protocol::canonical($identity));
                $runs = RcProcessingRun::where('recording_id', $record->id);
                if ($existing = (clone $runs)->where('fingerprint', $fingerprint)->first()) {
                    $this->result($existing);

                    return $existing;
                }
                abort_if((clone $runs)->count() >= 100, 409, 'This recording has reached its processing-run limit.');
                $events = [];
                foreach (['accelerometer', 'gyroscope'] as $channel) {
                    $events[$channel] = $this->research->window($record, $channel, $config['start_ms'], $config['end_ms'])['events'];
                }
                $result = $this->motion->calculate($events['accelerometer'], $events['gyroscope'], $manifest['started_elapsed_ns'], $config, $resolved['reference'] ?? null);
                if ($resolved) {
                    $result['reference_origin'] = $resolved['origin'];
                }
                $json = json_encode(['version' => $version, 'source' => $source, ...$result], JSON_THROW_ON_ERROR);
                abort_if(strlen($json) > 4194304, 422, 'Select a shorter processing window.');
                $id = (string) Str::uuid();
                $path = 'rc-research-v2/'.$record->id.'/processing/'.$id.'.encrypted';
                $written = $path;
                abort_unless(Storage::disk('local')->put($path, Crypt::encryptString($json)), 503, 'Processing storage is unavailable.');

                return RcProcessingRun::create(['id' => $id, 'recording_id' => $record->id, 'version' => $version, 'reference_run_id' => $referenceRun?->id,
                    'cutoff_hz' => $config['cutoff_hz'], 'fingerprint' => $fingerprint, 'payload_path' => $path, 'payload_sha256' => hash('sha256', $json)]);
            });
        } catch (\Throwable $error) {
            if ($written) {
                Storage::disk('local')->delete($written);
            }
            throw $error;
        }
    }

    public function result(RcProcessingRun $run): array
    {
        try {
            $json = Crypt::decryptString(Storage::disk('local')->get($run->payload_path));
            if (! hash_equals($run->payload_sha256, hash('sha256', $json))) {
                throw new \RuntimeException;
            }

            return json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            abort(503, 'The processing result could not be verified.');
        }
    }
}
