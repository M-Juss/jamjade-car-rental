<?php

namespace App\Support;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class RcNativeProtocol
{
    public const MAX_MANIFEST_BYTES = 1048576;

    public const MAX_CHUNK_BYTES = 1048576;

    public const MAX_RECORDING_BYTES = 67108864;

    public const CURRENT_EXERCISE_CATALOG = 'rc-exercises-v6';

    public const EXERCISE_CATALOGS = ['rc-exercises-v1', 'rc-exercises-v2', 'rc-exercises-v3', 'rc-exercises-v4', 'rc-exercises-v5', self::CURRENT_EXERCISE_CATALOG];

    public const DIRECTIONAL_SWERVE_CODES = ['SWL', 'HSWL', 'SWR', 'HSWR'];

    public const EXERCISE_CODES = ['FSS', 'HA', 'HB', 'LT', 'HLT', 'RT', 'HRT', 'RSS', 'LC', 'SW', ...self::DIRECTIONAL_SWERVE_CODES, 'MD', 'SR', 'FR'];

    public const HARSH_TURN_CODES = ['HLT', 'HRT'];

    public static function exerciseSupported(string $code, string $catalog): bool
    {
        return match (true) {
            $code === 'MD' => $catalog === 'rc-exercises-v6',
            in_array($code, self::DIRECTIONAL_SWERVE_CODES, true) => in_array($catalog, ['rc-exercises-v5', 'rc-exercises-v6'], true),
            $code === 'SW' => ! in_array($catalog, ['rc-exercises-v5', 'rc-exercises-v6'], true),
            $code === 'LC' => in_array($catalog, ['rc-exercises-v4', 'rc-exercises-v5', 'rc-exercises-v6'], true),
            in_array($code, self::HARSH_TURN_CODES, true) => in_array($catalog, ['rc-exercises-v3', 'rc-exercises-v4', 'rc-exercises-v5', 'rc-exercises-v6'], true),
            default => true,
        };
    }

    public const CHANNELS = ['accelerometer' => [1, 'm/s²'], 'gyroscope' => [4, 'rad/s'],
        'gravity' => [9, 'm/s²'], 'linear_acceleration' => [10, 'm/s²'], 'rotation_vector' => [11, 'native_rotation_vector']];

    public static function invalid(string $field = 'manifest_json'): never
    {
        throw ValidationException::withMessages([$field => 'The recording data or its integrity information is invalid.']);
    }

    public static function ns(mixed $value): int
    {
        if (! is_string($value) || ! preg_match('/^(0|[1-9][0-9]{0,18})$/D', $value)
            || (strlen($value) === 19 && strcmp($value, (string) PHP_INT_MAX) > 0)) {
            self::invalid();
        }

        return (int) $value;
    }

    public static function canonical(mixed $value): string
    {
        if (is_array($value)) {
            if (array_is_list($value)) {
                return '['.implode(',', array_map(self::canonical(...), $value)).']';
            }
            ksort($value, SORT_STRING);

            return '{'.implode(',', array_map(fn ($key) => json_encode((string) $key, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE).':'.self::canonical($value[$key]), array_keys($value))).'}';
        }

        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    public static function manifest(string $json): array
    {
        try {
            if (strlen($json) > self::MAX_MANIFEST_BYTES) {
                self::invalid();
            }
            $m = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
            Validator::make($m, [
                'protocol_version' => 'required|integer|in:2', 'source' => 'required|in:android_sensor_manager_v2',
                'recording_id' => 'required|uuid', 'collection_session_id' => 'required|uuid',
                'collection_binding' => 'sometimes|array:contract_version,research_session_id,mount_version_id,preflight_id,clock_context_id,catalog_version,protocol_code,protocol_sha256',
                'collection_binding.contract_version' => 'required_with:collection_binding|in:rc-collection-v1',
                'collection_binding.research_session_id' => 'required_with:collection_binding|uuid',
                'collection_binding.mount_version_id' => 'required_with:collection_binding|uuid',
                'collection_binding.preflight_id' => 'required_with:collection_binding|uuid',
                'collection_binding.clock_context_id' => 'required_with:collection_binding|uuid',
                'collection_binding.catalog_version' => 'required_with:collection_binding|in:'.implode(',', self::EXERCISE_CATALOGS),
                'collection_binding.protocol_code' => 'required_with:collection_binding|in:'.implode(',', self::EXERCISE_CODES),
                'collection_binding.protocol_sha256' => 'required_with:collection_binding|regex:/^[a-f0-9]{64}$/D',
                'coordinate_frame' => 'required|in:android_device_natural',
                'state' => 'required|in:stopped,interrupted', 'integrity' => 'required|in:sealed,verified_prefix',
                'consent_version' => 'required|integer|in:2,3', 'context.consent' => 'required|accepted',
                'context.name' => 'required|string|max:200', 'context.surface' => 'required|string|max:100',
                'context.recording_kind' => 'required|in:maneuver_trial,stationary_reference,forward_reference',
                'context.mount_method' => 'required|string|max:100', 'context.slope' => 'required|in:level,uphill,downhill',
                'started_at_utc' => 'required|date', 'duration_ms' => 'required|numeric|min:0|max:86400000',
                'channels' => 'required|array:accelerometer,gyroscope,gravity,linear_acceleration,rotation_vector',
                'chunks' => 'present|array|max:2000', 'chunk_inventory_sha256' => 'required|regex:/^[a-f0-9]{64}$/D',
            ])->validate();
            $binding = $m['collection_binding'] ?? [];
            if ($binding !== [] && ! self::exerciseSupported($binding['protocol_code'], $binding['catalog_version'])) {
                self::invalid();
            }
            $start = self::ns($m['started_elapsed_ns'] ?? null);
            $end = self::ns($m['ended_elapsed_ns'] ?? null);
            if ($end < $start || abs(($end - $start) / 1e6 - $m['duration_ms']) > 1
                || ! hash_equals($m['chunk_inventory_sha256'], hash('sha256', self::canonical($m['chunks'])))) {
                self::invalid();
            }
            foreach (self::CHANNELS as $channel => [$type, $unit]) {
                $info = $m['channels'][$channel] ?? null;
                if (! is_array($info) || ($info['sensor_type'] ?? null) !== $type || ($info['unit'] ?? null) !== $unit) {
                    self::invalid();
                }
            }
            $indices = [];
            $bytes = 0;
            foreach ($m['chunks'] as $chunk) {
                Validator::make($chunk, [
                    'channel' => 'required|in:'.implode(',', array_keys(self::CHANNELS)),
                    'chunk_index' => 'required|integer|min:0|max:9999', 'sealed' => 'required|accepted',
                    'event_count' => 'required|integer|min:1|max:10000',
                    'logical_bytes' => 'required|integer|min:1|max:'.self::MAX_CHUNK_BYTES,
                    'sha256' => 'required|regex:/^[a-f0-9]{64}$/D',
                    'first_sequence' => 'required|integer|min:0', 'last_sequence' => 'required|integer|gte:first_sequence',
                ])->validate();
                self::ns($chunk['first_sensor_timestamp_ns'] ?? null);
                self::ns($chunk['last_sensor_timestamp_ns'] ?? null);
                $expected = $indices[$chunk['channel']] ?? 0;
                if ($chunk['chunk_index'] !== $expected || $chunk['sealed'] !== true) {
                    self::invalid();
                }
                $indices[$chunk['channel']] = $expected + 1;
                $bytes += $chunk['logical_bytes'];
            }
            if ($bytes > self::MAX_RECORDING_BYTES) {
                self::invalid();
            }

            return $m;
        } catch (\Throwable) {
            self::invalid();
        }
    }

    public static function events(string $payload, string $channel): array
    {
        if (strlen($payload) > self::MAX_CHUNK_BYTES || ! str_ends_with($payload, "\n")) {
            self::invalid('payload');
        }
        $events = [];
        try {
            foreach (explode("\n", substr($payload, 0, -1)) as $line) {
                if (strlen($line) > 2048 || count($events) >= 10000) {
                    self::invalid('payload');
                }
                $event = json_decode($line, true, 8, JSON_THROW_ON_ERROR);
                if (! is_array($event) || count($event) !== 5
                    || array_diff(['sequence', 'sensor_timestamp_ns', 'received_elapsed_ns', 'accuracy', 'values'], array_keys($event))
                    || ! is_int($event['sequence']) || $event['sequence'] < 0 || ! is_int($event['accuracy'])
                    || $event['accuracy'] < -1 || $event['accuracy'] > 3 || ! is_array($event['values'])
                    || ! array_is_list($event['values']) || ($channel === 'rotation_vector' ? ! in_array(count($event['values']), [3, 4, 5]) : count($event['values']) !== 3)) {
                    self::invalid('payload');
                }
                self::ns($event['sensor_timestamp_ns']);
                self::ns($event['received_elapsed_ns']);
                foreach ($event['values'] as $v) {
                    if ((! is_int($v) && ! is_float($v)) || ! is_finite((float) $v) || abs($v) > 1e9) {
                        self::invalid('payload');
                    }
                }
                if ($events && $event['sequence'] <= $events[array_key_last($events)]['sequence']) {
                    self::invalid('payload');
                }
                $events[] = $event;
            }
        } catch (\Throwable) {
            self::invalid('payload');
        }

        return $events;
    }
}
