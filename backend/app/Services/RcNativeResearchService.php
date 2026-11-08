<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\User;
use App\Support\RcNativeProtocol as Protocol;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class RcNativeResearchService
{
    public function recordingLimit(): int
    {
        return app()->isLocal() ? 1000 : 100;
    }

    public function storageLimit(): int
    {
        return app()->isLocal() ? 2147483648 : 268435456;
    }

    public function recording(User $user, string $id): RcNativeRecording
    {
        return RcNativeRecording::where('user_id', $user->id)->findOrFail($id);
    }

    public function begin(User $user, string $json): RcNativeRecording
    {
        $manifest = Protocol::manifest($json);
        $hash = hash('sha256', $json);
        $written = null;
        try {
            return DB::transaction(function () use ($user, $manifest, $json, $hash, &$written) {
                User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                $records = RcNativeRecording::where('user_id', $user->id);
                $existing = (clone $records)->where('client_recording_id', $manifest['recording_id'])->first();
                if ($existing) {
                    abort_unless(hash_equals($existing->manifest_sha256, $hash), 409, 'This recording identity already has different content.');

                    return $existing;
                }
                $bytes = array_sum(array_column($manifest['chunks'], 'logical_bytes'));
                abort_if((clone $records)->count() >= $this->recordingLimit() || (clone $records)->sum('expected_bytes') + $bytes > $this->storageLimit(),
                    409, 'Research storage limit reached. Contact the administrator.');
                $id = (string) Str::uuid();
                $path = 'rc-research-v2/'.$id.'/manifest.encrypted';
                abort_unless(Storage::disk('local')->put($path, Crypt::encryptString($json)), 503, 'Recording storage is unavailable.');
                $written = $path;

                return RcNativeRecording::create(['id' => $id, 'user_id' => $user->id,
                    'client_recording_id' => $manifest['recording_id'], 'name' => $manifest['context']['name'],
                    'surface' => $manifest['context']['surface'], 'capture_state' => $manifest['state'], 'state' => 'incomplete',
                    'manifest_path' => $path, 'manifest_sha256' => $hash, 'expected_chunks' => count($manifest['chunks']),
                    'expected_bytes' => $bytes, 'duration_ms' => $manifest['duration_ms'], 'started_at' => $manifest['started_at_utc']]);
            });
        } catch (\Throwable $error) {
            if ($written) {
                Storage::disk('local')->delete($written);
            }
            throw $error;
        }
    }

    public function manifest(RcNativeRecording $record): array
    {
        return json_decode($this->verifiedFile($record->manifest_path, $record->manifest_sha256), true, 32, JSON_THROW_ON_ERROR);
    }

    private function verifiedFile(string $path, string $hash): string
    {
        try {
            $json = Crypt::decryptString(Storage::disk('local')->get($path));
            if (! hash_equals($hash, hash('sha256', $json))) {
                throw new \RuntimeException;
            }

            return $json;
        } catch (\Throwable) {
            abort(503, 'The recording file could not be verified.');
        }
    }

    public function chunk(RcNativeRecording $record, string $channel, int $index, string $payload): RcNativeRecording
    {
        $written = null;
        try {
            return DB::transaction(function () use ($record, $channel, $index, $payload, &$written) {
                $record = RcNativeRecording::whereKey($record->id)->lockForUpdate()->firstOrFail();
                $manifest = $this->manifest($record);
                $descriptor = collect($manifest['chunks'])->first(fn ($chunk) => $chunk['channel'] === $channel && $chunk['chunk_index'] === $index);
                abort_unless($descriptor, 422, 'This chunk is not in the recording inventory.');
                $hash = hash('sha256', $payload);
                abort_unless(hash_equals($descriptor['sha256'], $hash) && strlen($payload) === $descriptor['logical_bytes'],
                    409, 'The chunk does not match the original recording.');
                $existing = $record->chunks()->where('channel', $channel)->where('chunk_index', $index)->first();
                if ($existing) {
                    $this->verifiedFile($existing->payload_path, $hash);

                    return $record;
                }
                abort_unless($record->state === 'incomplete', 409, 'The verified recording cannot be changed.');
                $events = Protocol::events($payload, $channel);
                $first = $events[0];
                $last = $events[array_key_last($events)];
                if (count($events) !== $descriptor['event_count'] || $first['sequence'] !== $descriptor['first_sequence']
                    || $last['sequence'] !== $descriptor['last_sequence']
                    || $first['sensor_timestamp_ns'] !== $descriptor['first_sensor_timestamp_ns']
                    || $last['sensor_timestamp_ns'] !== $descriptor['last_sensor_timestamp_ns']) {
                    Protocol::invalid('payload');
                }
                $start = Protocol::ns($manifest['started_elapsed_ns']);
                $end = Protocol::ns($manifest['ended_elapsed_ns']);
                foreach ($events as $event) {
                    if (Protocol::ns($event['received_elapsed_ns']) < $start || Protocol::ns($event['received_elapsed_ns']) > $end) {
                        Protocol::invalid('payload');
                    }
                }
                $path = 'rc-research-v2/'.$record->id.'/'.Str::uuid().'.encrypted';
                abort_unless(Storage::disk('local')->put($path, Crypt::encryptString($payload)), 503, 'Recording storage is unavailable.');
                $written = $path;
                $times = array_map(fn ($event) => Protocol::ns($event['sensor_timestamp_ns']), $events);
                $record->chunks()->create(['channel' => $channel, 'chunk_index' => $index, 'sha256' => $hash,
                    'payload_path' => $path, 'logical_bytes' => strlen($payload), 'event_count' => count($events),
                    'summary' => ['min_timestamp_ns' => (string) min($times), 'max_timestamp_ns' => (string) max($times)]]);

                return $record;
            });
        } catch (\Throwable $error) {
            if ($written) {
                Storage::disk('local')->delete($written);
            }
            throw $error;
        }
    }

    public function finalize(RcNativeRecording $record): RcNativeRecording
    {
        return DB::transaction(function () use ($record) {
            $record = RcNativeRecording::whereKey($record->id)->lockForUpdate()->firstOrFail();
            $manifest = $this->manifest($record);
            $chunks = $record->chunks()->orderBy('channel')->orderBy('chunk_index')->get();
            abort_unless($chunks->count() === $record->expected_chunks && $chunks->sum('logical_bytes') === $record->expected_bytes,
                409, 'Upload is incomplete. Retry the missing chunks.');
            $summary = [];
            foreach (array_keys(Protocol::CHANNELS) as $channel) {
                $analysis = new RcNativeChannelAnalysis(Protocol::ns($manifest['started_elapsed_ns']), Protocol::ns($manifest['ended_elapsed_ns']));
                foreach ($chunks->where('channel', $channel) as $chunk) {
                    foreach (Protocol::events($this->verifiedFile($chunk->payload_path, $chunk->sha256), $channel) as $event) {
                        $analysis->add($event);
                    }
                }
                $summary[$channel] = $analysis->summary();
            }
            $record->forceFill(['state' => 'verified', 'summary' => $summary, 'verified_at' => $record->verified_at ?? now()])->save();

            return $record;
        });
    }

    public function window(RcNativeRecording $record, string $channel, float $startMs, float $endMs): array
    {
        abort_unless($record->state === 'verified', 409, 'Finish uploading this recording before inspection.');
        abort_unless($endMs > $startMs && $endMs - $startMs <= 30000 && $endMs <= max(1, $record->duration_ms), 422, 'Select an interval of at most 30 seconds within the recording.');
        $manifest = $this->manifest($record);
        $origin = Protocol::ns($manifest['started_elapsed_ns']);
        $events = [];
        foreach ($record->chunks()->where('channel', $channel)->orderBy('chunk_index')->get() as $chunk) {
            if ((Protocol::ns($chunk->summary['max_timestamp_ns']) - $origin) / 1e6 < $startMs
                || (Protocol::ns($chunk->summary['min_timestamp_ns']) - $origin) / 1e6 > $endMs) {
                continue;
            }
            foreach (Protocol::events($this->verifiedFile($chunk->payload_path, $chunk->sha256), $channel) as $event) {
                $ms = (Protocol::ns($event['sensor_timestamp_ns']) - $origin) / 1e6;
                if ($ms >= $startMs && $ms <= $endMs) {
                    $events[] = [...$event, 'elapsed_ms' => $ms];
                    abort_if(count($events) > 10000, 422, 'Too many events. Select a shorter interval.');
                }
            }
        }

        return ['channel' => $channel, 'start_ms' => $startMs, 'end_ms' => $endMs, 'events' => $events];
    }
}
