<?php

namespace App\Services;

use App\Models\RcCollectionContext;
use App\Models\RcCollectionSession;
use App\Models\RcMountVersion;
use App\Models\RcNativeRecording;
use App\Models\RcObservationRevision;
use App\Support\RcNativeProtocol;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RcCollectionService
{
    public function recordingFilterSessions(int $userId): array
    {
        $recordingName = RcNativeRecording::query()->select('rc_native_recordings.name')
            ->join('rc_collection_contexts', 'rc_collection_contexts.recording_id', '=', 'rc_native_recordings.id')
            ->join('rc_mount_versions', 'rc_mount_versions.id', '=', 'rc_collection_contexts.mount_id')
            ->whereColumn('rc_mount_versions.session_id', 'rc_collection_sessions.id')
            ->where('rc_native_recordings.user_id', $userId)
            ->oldest('rc_native_recordings.started_at')->orderBy('rc_native_recordings.id')->limit(1);

        return RcCollectionSession::query()->where('user_id', $userId)
            ->select(['id', 'session_number', 'payload'])->addSelect(['recording_name' => $recordingName])
            ->orderBy('session_number')->orderBy('id')->get()
            ->whereNotNull('recording_name')
            ->map(function (RcCollectionSession $session) {
                $payload = $session->payload;

                return ['id' => $session->id, 'session_number' => (int) $session->session_number,
                    'group_id' => $payload['recording_group_id'], 'surface' => $payload['conditions']['surface'],
                    'recording_name' => $session->recording_name];
            })->values()->all();
    }

    public function catalog(string $version = RcNativeProtocol::CURRENT_EXERCISE_CATALOG): array
    {
        abort_unless(in_array($version, RcNativeProtocol::EXERCISE_CATALOGS, true), 422, 'Unsupported exercise protocol version.');

        return json_decode(file_get_contents(resource_path("research/{$version}.json")), true, 32, JSON_THROW_ON_ERROR);
    }

    private function hash(array $value): string
    {
        return hash('sha256', RcNativeProtocol::canonical($value));
    }

    public function context(RcNativeRecording $record, array $input): RcCollectionContext
    {
        abort_unless($record->state === 'verified', 409, 'Verify the original recording before syncing collection details.');
        $protocol = collect($this->catalog($input['catalog_version'])['protocols'])->firstWhere('code', $input['protocol_code']);
        if (! is_array($protocol) || ! hash_equals($this->hash($protocol), $input['protocol_sha256']) || $input['manifest_sha256'] !== $record->manifest_sha256
            || $input['recording_id'] !== $record->client_recording_id) {
            throw ValidationException::withMessages(['protocol_code' => 'Protocol or original recording identity does not match.']);
        }
        $manifest = app(RcNativeResearchService::class)->manifest($record);
        $original = $manifest['context'];
        $p = $input['preflight'];
        $binding = ['contract_version' => 'rc-collection-v1', 'research_session_id' => $input['session']['id'],
            'mount_version_id' => $input['mount']['id'], 'preflight_id' => $p['id'], 'clock_context_id' => $p['clock_context_id'],
            'catalog_version' => $input['catalog_version'], 'protocol_code' => $input['protocol_code'], 'protocol_sha256' => $input['protocol_sha256']];
        if (! isset($manifest['collection_binding']) || $this->hash($manifest['collection_binding']) !== $this->hash($binding)) {
            throw ValidationException::withMessages(['preflight' => 'Setup binding does not match the sealed original.']);
        }
        if (($original['recording_group_id'] ?? null) !== $input['session']['recording_group_id']
            || ($original['recording_number'] ?? null) !== $input['capture_number']
            || $original['recording_kind'] !== $protocol['recording_kind']
            || $original['surface'] !== $input['session']['conditions']['surface']
            || ($original['slope'] ?? null) !== $input['session']['conditions']['slope']
            || (int) $p['end_elapsed_ns'] > (int) $manifest['started_elapsed_ns']
            || CarbonImmutable::parse($p['started_at'])->gt(CarbonImmutable::parse($manifest['started_at_utc']))) {
            throw ValidationException::withMessages(['preflight' => 'Collection details do not match the original capture.']);
        }
        // No client-provided display name, course dimensions, pass, or accepted alignment is trusted.
        $input['protocol_snapshot'] = $protocol;
        $input['capture_stage'] = 'pilot';
        $input['display_code'] = sprintf('S%02d-%s-R%03d', $input['session']['session_number'], $protocol['code'], $input['capture_number']);
        $input['course_snapshot'] = ['layout_key' => $protocol['layout_key'], 'layout_revision' => 1,
            'status' => 'provisional', 'spacing_m' => null, 'radius_m' => null];

        return DB::transaction(function () use ($record, $input) {
            // Lock the authenticated owner to serialize first-use parent allocations and avoid concurrent identity races.
            DB::table('users')->where('id', $record->user_id)->lockForUpdate()->first();
            $session = $input['session'];
            $mount = $input['mount'];
            $saved = RcCollectionSession::find($session['id']);
            if ($saved) {
                abort_unless($saved->user_id === $record->user_id && hash_equals($saved->content_sha256, $this->hash($session)), 409, 'Session identity already has different content.');
            } else {
                abort_if(RcCollectionSession::where('user_id', $record->user_id)->where('device_profile_id', $session['device_profile_id'])
                    ->where('session_number', $session['session_number'])->exists(), 409, 'Session number is already allocated.');
                RcCollectionSession::create(['id' => $session['id'], 'user_id' => $record->user_id, 'device_profile_id' => $session['device_profile_id'],
                    'session_number' => $session['session_number'], 'payload' => $session, 'content_sha256' => $this->hash($session)]);
            }
            $savedMount = RcMountVersion::find($mount['id']);
            if ($savedMount) {
                abort_unless($savedMount->session_id === $session['id'] && hash_equals($savedMount->content_sha256, $this->hash($mount)), 409, 'Mount identity already has different content.');
            } else {
                abort_if(RcMountVersion::where('session_id', $session['id'])->where('mount_number', $mount['mount_number'])->exists(), 409, 'Mount number is already allocated.');
                RcMountVersion::create(['id' => $mount['id'], 'session_id' => $session['id'], 'mount_number' => $mount['mount_number'],
                    'payload' => $mount, 'content_sha256' => $this->hash($mount)]);
            }
            $existing = RcCollectionContext::find($record->id);
            if ($existing) {
                abort_unless(hash_equals($existing->content_sha256, $this->hash($input)), 409, 'Collection details already have different content.');

                return $existing;
            }
            abort_if(RcCollectionContext::where('preflight_id', $input['preflight']['id'])->exists(), 409, 'Setup evidence has already been used.');

            return RcCollectionContext::create(['recording_id' => $record->id, 'mount_id' => $mount['id'], 'preflight_id' => $input['preflight']['id'],
                'capture_number' => $input['capture_number'], 'display_code' => $input['display_code'], 'payload' => $input, 'content_sha256' => $this->hash($input)]);
        });
    }

    public function observe(RcNativeRecording $record, array $input): RcObservationRevision
    {
        abort_unless($record->state === 'verified', 409, 'Verify the original before syncing observations.');

        return DB::transaction(function () use ($record, $input) {
            RcNativeRecording::whereKey($record->id)->lockForUpdate()->firstOrFail();
            if (isset($input['initial_deviation']) && ($record->collectionContext()->first()?->payload['protocol_code'] ?? null) !== 'SW') {
                throw ValidationException::withMessages([
                    'initial_deviation' => 'Initial deviation is available for swerve recordings only.',
                ]);
            }
            $existing = RcObservationRevision::find($input['id']);
            if ($existing) {
                abort_unless($existing->recording_id === $record->id && hash_equals($existing->content_sha256, $this->hash($input)), 409, 'Observation identity already has different content.');

                return $existing;
            }
            $latest = (int) RcObservationRevision::where('recording_id', $record->id)->max('revision');
            abort_unless($latest === $input['base_revision'], 409, 'Observations changed. Refresh before saving.');

            return RcObservationRevision::create(['id' => $input['id'], 'recording_id' => $record->id, 'user_id' => $record->user_id,
                'revision' => $latest + 1, 'payload' => $input, 'content_sha256' => $this->hash($input), 'created_at' => now()]);
        });
    }
}
