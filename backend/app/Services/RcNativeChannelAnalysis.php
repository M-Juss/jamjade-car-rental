<?php

namespace App\Services;

use App\Support\RcNativeProtocol as Protocol;

/** Streaming statistics of original phone-axis values. No filtering or calibration. */
class RcNativeChannelAnalysis
{
    private int $count = 0;

    private ?int $first = null;

    private ?int $last = null;

    private ?int $lastSequence = null;

    private int $maxGap = 0;

    private int $duplicates = 0;

    private int $backwards = 0;

    private int $sequenceGaps = 0;

    private int $outside = 0;

    private array $mean = [0.0, 0.0, 0.0];

    private array $m2 = [0.0, 0.0, 0.0];

    private float $squared = 0;

    private float $peak = 0;

    public function __construct(private readonly int $start, private readonly int $end) {}

    public function add(array $event): void
    {
        $time = Protocol::ns($event['sensor_timestamp_ns']);
        if ($this->lastSequence !== null && $event['sequence'] <= $this->lastSequence) {
            Protocol::invalid('payload');
        }
        $this->sequenceGaps += $this->lastSequence === null ? $event['sequence'] : $event['sequence'] - $this->lastSequence - 1;
        $this->lastSequence = $event['sequence'];
        if ($this->last !== null) {
            $gap = $time - $this->last;
            $this->duplicates += (int) ($gap === 0);
            $this->backwards += (int) ($gap < 0);
            $this->maxGap = max($this->maxGap, $gap);
        }
        $this->outside += (int) ($time < $this->start || $time > $this->end);
        $this->first ??= $time;
        $this->last = $time;
        $this->count++;
        $magnitude = 0;
        foreach ([0, 1, 2] as $axis) {
            $value = $event['values'][$axis];
            $delta = $value - $this->mean[$axis];
            $this->mean[$axis] += $delta / $this->count;
            $this->m2[$axis] += $delta * ($value - $this->mean[$axis]);
            $magnitude += $value ** 2;
        }
        $this->squared += $magnitude;
        $this->peak = max($this->peak, sqrt($magnitude));
    }

    public function summary(): array
    {
        $span = $this->first !== null && $this->last !== null ? $this->last - $this->first : 0;

        return ['event_count' => $this->count, 'rate_hz' => $this->count > 1 && $span > 0 ? ($this->count - 1) * 1e9 / $span : null,
            'max_gap_ms' => $this->count > 1 ? $this->maxGap / 1e6 : null,
            'startup_gap_ms' => $this->first !== null ? max(0, $this->first - $this->start) / 1e6 : null,
            'trailing_gap_ms' => $this->last !== null ? max(0, $this->end - $this->last) / 1e6 : null,
            'duplicate_timestamps' => $this->duplicates, 'backwards_timestamps' => $this->backwards,
            'sequence_gaps' => $this->sequenceGaps, 'out_of_interval' => $this->outside,
            'mean_xyz' => $this->count ? $this->mean : null,
            'std_xyz' => $this->count ? array_map(fn ($value) => sqrt(max(0, $value / $this->count)), $this->m2) : null,
            'rms_magnitude' => $this->count ? sqrt($this->squared / $this->count) : null,
            'peak_magnitude' => $this->count ? $this->peak : null];
    }
}
