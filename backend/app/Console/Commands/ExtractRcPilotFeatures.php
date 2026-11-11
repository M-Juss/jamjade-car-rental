<?php

namespace App\Console\Commands;

use App\Services\RcPilotFeatureService;
use Illuminate\Console\Command;
use Symfony\Component\Console\Output\OutputInterface;

class ExtractRcPilotFeatures extends Command
{
    protected $signature = 'rc-research:extract-features {snapshot=pilot-split-v2} {--verify : Recompute and verify the existing private features} {--stream : Read verified development examples as JSONL}';

    protected $description = 'Extract versioned interval statistics from the development partition only';

    public function handle(RcPilotFeatureService $features): int
    {
        if (! app()->isLocal()) {
            $this->error('Pilot feature commands require the local development environment.');

            return self::FAILURE;
        }
        $snapshot = (string) $this->argument('snapshot');
        if ($this->option('stream')) {
            foreach ($features->stream($snapshot) as $row) {
                $this->output->writeln(json_encode($row, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION), OutputInterface::OUTPUT_RAW);
            }

            return self::SUCCESS;
        }
        $document = $this->option('verify') ? $features->verify($snapshot) : $features->create($snapshot);
        $summary = $document['summary'];
        $this->info("Development features verified: {$summary['examples']} examples, {$summary['features']} features, {$summary['stationary_context']} separate stationary intervals.");
        foreach ($summary['classes'] as $target => $count) {
            $this->line("$target: $count");
        }

        return self::SUCCESS;
    }
}
