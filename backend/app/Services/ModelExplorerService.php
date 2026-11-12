<?php

namespace App\Services;

use App\Models\RcNativeRecording;
use App\Models\User;

/** Dedicated, read-only reader of the shared frozen development export. */
class ModelExplorerService
{
    private const SNAPSHOT_SHA256 = '7cc3b2efe0f3284af6bea681c879db0497890bdca92a69e112b6d5845dff7498';

    public function __construct(
        private readonly RcPilotDatasetExportService $export,
        private readonly DriveMonitoringFeatureService $features,
        private readonly RcPilotFeatureService $statistics,
        private readonly RcRuntimeForestService $forest,
    ) {}

    private function examples(): array
    {
        $rows = [];
        foreach ($this->export->streamFrozenDevelopment('pilot-split-v3', self::SNAPSHOT_SHA256) as $interval) {
            $rows[] = $interval;
        }
        $recordings = RcNativeRecording::whereIn('id', array_unique(array_column($rows, 'recording_id')))->pluck('id')->all();

        return array_values(array_filter($rows, fn ($row) => in_array($row['recording_id'], $recordings, true)));
    }

    public function index(User $user): array
    {
        return array_map(fn ($row, $index) => ['id' => $index, 'target' => $row['target'],
            'start_ms' => $row['start_ms'], 'end_ms' => $row['end_ms']],
            $rows = $this->examples(), array_keys($rows));
    }

    public function show(User $user, int $index): array
    {
        $examples = $this->examples();
        abort_unless(isset($examples[$index]), 404, 'Example not found.');
        $selected = $examples[$index];
        $values = $this->features->extract($selected['samples']);
        $groups = [];
        foreach ($examples as $example) {
            $groups[$example['target']][] = $this->features->extract($example['samples']);
        }
        $ranges = [];
        foreach ($groups as $target => $vectors) {
            $ranges[] = ['target' => $target, 'count' => count($vectors),
                'features' => array_map(function ($column) use ($vectors) {
                    $values = array_column($vectors, $column);

                    return ['min' => min($values), 'max' => max($values), 'mean' => array_sum($values) / count($values)];
                }, range(0, 34))];
        }

        return ['id' => $index, 'target' => $selected['target'],
            'start_ms' => $selected['start_ms'], 'end_ms' => $selected['end_ms'],
            'samples' => $selected['samples'], 'features' => $values,
            'feature_names' => [...$this->statistics->definition()['feature_columns'],
                'yaw_phase_count', 'yaw_pair_smaller_area', 'yaw_pair_area_ratio', 'yaw_pair_shorter_span', 'yaw_pair_gap'],
            'sample_columns' => $this->statistics->definition()['sample_columns'],
            'units' => $this->statistics->definition()['units'], 'statistics' => $this->statistics->definition()['statistics'],
            'yaw_details' => $this->features->yawDetails($selected['samples']),
            'snapshot_sha256' => self::SNAPSHOT_SHA256, 'partition' => 'development',
            'ranges' => $ranges, 'decision' => $this->forest->explain($values)];
    }
}
