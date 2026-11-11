<?php

namespace App\Services;

use App\Models\DriveMonitoringEvent;
use App\Models\DriveMonitoringSession;

/** Experimental causal grouping. Classification windows remain separate from reviewed labels. */
class DriveMonitoringEventService
{
    private function overlap($first, array $second): int
    {
        return max(0, min($first->end_ms, $second['end_ms']) - max($first->start_ms, $second['start_ms']));
    }

    public function consume(DriveMonitoringSession $session, array $windows, array $predictions): void
    {
        foreach ($windows as $index => $window) {
            $prediction = $predictions[$index];
            $target = $prediction['class'];
            $end = $window['end_ms'];
            if (str_starts_with($target, 'harsh_') && $prediction['vote'] >= .65) {
                $evidence = $window['braking_evidence'];
                $duplicate = $target === 'harsh_braking' && DriveMonitoringEvent::where('session_id', $session->id)
                    ->where('target', $target)->where('peak_ms', $evidence['peak_ms'])->exists();
                $priorSwerves = $target === 'harsh_swerve' ? DriveMonitoringEvent::where('session_id', $session->id)
                    ->where('target', $target)->where('end_ms', '>', $window['start_ms'])->get() : collect();
                $duplicate = $duplicate || $priorSwerves->contains(fn ($event) => $this->overlap($event, $window) >= .5 * ($event->end_ms - $event->start_ms));
                if ($target === 'harsh_cornering') {
                    $duplicate = $duplicate || DriveMonitoringEvent::where('session_id', $session->id)
                        ->where('target', 'harsh_swerve')->where('emitted_ms', '<=', $end + 1200)
                        ->where('start_ms', '<', $end)->where('end_ms', '>', $window['start_ms'])->exists();
                }
                if (! $duplicate) {
                    $previous = DriveMonitoringEvent::where('session_id', $session->id)->where('target', $target)
                        ->where('status', '!=', 'suppressed')->latest('last_ms')->first();
                    if ($previous && $end - $previous->last_ms <= 600) {
                        $previous->update(['last_ms' => $end]);
                    } else {
                        $ambiguous = $target === 'harsh_braking' && $evidence['vertical_peak'] >= 2 && $evidence['pitch_rate_peak'] >= .8;
                        DriveMonitoringEvent::create(['session_id' => $session->id, 'target' => $target,
                            'status' => $target === 'harsh_cornering' ? 'pending' : ($ambiguous ? 'review_required' : 'confirmed'),
                            'start_ms' => $window['start_ms'], 'end_ms' => $end, 'last_ms' => $end,
                            'emitted_ms' => $end + ($target === 'harsh_cornering' ? 1200 : 0),
                            'peak_ms' => $target === 'harsh_braking' ? $evidence['peak_ms'] : null,
                            'vote' => $prediction['vote'], 'evidence' => ['method' => 'causal-window-grouping-v1',
                                'yaw_phase_count' => $window['features'][30],
                                'braking' => $target === 'harsh_braking' ? $evidence : null,
                                'reason' => $ambiguous ? 'vertical_and_pitch_motion' : null]]);
                    }
                }
                if ($target === 'harsh_swerve') {
                    DriveMonitoringEvent::where('session_id', $session->id)->where('target', 'harsh_cornering')
                        ->where('status', 'pending')->where('emitted_ms', '>=', $end)
                        ->where('start_ms', '<', $end)->where('end_ms', '>', $window['start_ms'])
                        ->update(['status' => 'suppressed']);
                }
            }
            // Release only after all windows at this sensor-time have been consumed.
        }
        $watermark = max(array_column($windows, 'end_ms'));
        DriveMonitoringEvent::where('session_id', $session->id)->where('status', 'pending')
            ->where('emitted_ms', '<=', $watermark)->update(['status' => 'confirmed']);
        $session->update(['last_window_end_ms' => $watermark]);
    }

    public function finish(DriveMonitoringSession $session): void
    {
        // Do not invent future sensor time to confirm an unfinished corner hold.
        DriveMonitoringEvent::where('session_id', $session->id)->where('status', 'pending')->update(['status' => 'review_required']);
    }
}
