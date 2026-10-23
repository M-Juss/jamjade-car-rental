<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\RcResearchSession;
use App\Models\RcResearchTrial;
use App\Models\User;
use App\Support\RcResearchProtocol;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class RcResearchSyntheticDemoSeeder extends Seeder
{
    private const SESSION_NAME = 'Smooth concrete - Level';

    private const EVENTS = [
        ['stationary', 'not_applicable'],
        ['steady_movement', 'not_applicable'],
        ['acceleration', 'normal'],
        ['acceleration', 'harsh'],
        ['braking', 'normal'],
        ['braking', 'harsh'],
        ['left_turn', 'normal'],
        ['left_turn', 'harsh'],
        ['right_turn', 'normal'],
        ['right_turn', 'harsh'],
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Synthetic RC Research records can only be seeded in local or testing.');
        }

        $user = User::query()
            ->where('is_active', true)
            ->whereHas('roles', fn ($query) => $query->where('name', UserRole::Admin->value))
            ->orderBy('id')
            ->first();

        if (! $user) {
            throw new RuntimeException('An active Admin account is required to seed RC Research demo records.');
        }

        if (RcResearchSession::query()->where('user_id', $user->id)->where('name', self::SESSION_NAME)->exists()) {
            $this->command?->warn('Synthetic RC Research demo records already exist for the first active Admin.');

            return;
        }

        $createdPaths = [];
        try {
            DB::transaction(function () use ($user, &$createdPaths): void {
                $firstStart = CarbonImmutable::create(2026, 10, 17, 9, 0, 0, 'Asia/Manila');
                $session = RcResearchSession::create([
                    'user_id' => $user->id,
                    'name' => self::SESSION_NAME,
                    'phone_model' => null,
                    'rc_model' => null,
                    'surface' => 'Smooth concrete',
                    'slope' => 'level',
                    'mount_orientation' => 'flat',
                    'mount_method' => null,
                    'battery_condition' => 'medium',
                    'rc_configuration' => null,
                    'platform' => 'android',
                    'app_version' => 'synthetic-demo',
                    'added_load_g' => 0,
                    'protocol' => RcResearchProtocol::settings(),
                    'consented_at' => $firstStart->utc(),
                    'created_at' => $firstStart->utc(),
                    'updated_at' => $firstStart->utc(),
                ]);

                $recordIndex = 0;
                $dateCounts = [0, 0, 0];
                foreach (self::EVENTS as [$movement, $intensity]) {
                    for ($replicate = 1; $replicate <= 10; $replicate++) {
                        $dayIndex = min(2, intdiv($recordIndex * 3, 100));
                        $dateCounts[$dayIndex]++;
                        $start = match ($dayIndex) {
                            0 => $firstStart->addMinutes(($dateCounts[$dayIndex] - 1) * 12),
                            1 => CarbonImmutable::create(2026, 10, 18, 9, 0, 0, 'Asia/Manila')->addMinutes(($dateCounts[$dayIndex] - 1) * 12),
                            default => CarbonImmutable::create(2026, 10, 19, 0, 10, 0, 'Asia/Manila')->addMinutes(($dateCounts[$dayIndex] - 1) * 8),
                        };
                        $end = $start->addSeconds(2);
                        $trialId = sprintf('synthetic-%s-%s-%02d', $movement, $intensity, $replicate);
                        $samples = $this->samples($recordIndex);
                        $trialData = [
                            'client_trial_id' => $trialId,
                            'intended_movement' => $movement,
                            'intended_intensity' => $intensity,
                            'observed_movement' => $movement,
                            'observed_intensity' => $intensity,
                            'label_status' => 'uncertain',
                            'quality' => 'interrupted',
                            'event_start_ms' => 500,
                            'event_end_ms' => 1500,
                            'notes' => '',
                            'started_at' => $start->utc(),
                            'ended_at' => $end->utc(),
                        ];
                        $content = json_encode([
                            'protocol' => $session->protocol,
                            'trial' => $trialData,
                            'samples' => $samples,
                        ], JSON_THROW_ON_ERROR);
                        $path = 'rc-research/'.Str::uuid().'.encrypted';
                        if (! Storage::disk('local')->put($path, Crypt::encryptString($content))) {
                            throw new RuntimeException('Could not write an encrypted synthetic sample file.');
                        }
                        $createdPaths[] = $path;

                        RcResearchTrial::create([
                            ...$trialData,
                            'session_id' => $session->id,
                            'samples_path' => $path,
                            'content_hash' => hash('sha256', $content),
                            'summary' => $this->summary($samples),
                            'created_at' => $end->utc(),
                            'updated_at' => $end->utc(),
                        ]);
                        $recordIndex++;
                    }
                }
            });
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($createdPaths);
            throw $error;
        }

        $this->command?->info('');
    }

    private function samples(int $seed): array
    {
        $times = [0, 250, 500, 1000, 1250, 1500, 1750, 1800];

        return array_map(function (int $elapsedMs, int $index) use ($seed): array {
            $linearX = sin(($seed + $index) * 0.7) * 0.12;
            $linearY = cos(($seed + $index) * 0.4) * 0.12;

            return [
                'elapsed_ms' => $elapsedMs,
                'acceleration_timestamp_s' => 1000 + ($seed * 2) + $elapsedMs / 1000,
                'gravity_timestamp_s' => 1000 + ($seed * 2) + $elapsedMs / 1000,
                'rotation_timestamp_s' => 1000 + ($seed * 2) + $elapsedMs / 1000,
                'linear_x' => $linearX,
                'linear_y' => $linearY,
                'linear_z' => 0.03,
                'including_gravity_x' => $linearX,
                'including_gravity_y' => $linearY,
                'including_gravity_z' => 9.84,
                'rotation_x' => sin(($seed + $index) * 0.3),
                'rotation_y' => cos(($seed + $index) * 0.2),
                'rotation_z' => sin(($seed + $index) * 0.5),
                'orientation' => 0,
            ];
        }, $times, array_keys($times));
    }

    private function summary(array $samples): array
    {
        return [
            'sample_count' => count($samples),
            'duration_ms' => 2000,
            'sensor_duration_ms' => 1800,
            'mean_rate_hz' => 3500 / 1800,
            'max_gap_ms' => 500,
            'linear_rms' => 0.18,
            'rotation_rms' => 1.0,
            'rotation_peak' => 1.0,
            'max_tilt_degrees' => 0,
            'linear_mean' => [0, 0, 0.03],
            'rotation_mean' => [0, 0, 0],
            'gravity_mean' => [0, 0, 9.81],
            'quality_flags' => ['low_sample_rate', 'sample_gaps'],
            'eligible_for_training' => false,
        ];
    }
}
