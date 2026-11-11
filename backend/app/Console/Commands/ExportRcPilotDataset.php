<?php

namespace App\Console\Commands;

use App\Services\RcPilotDatasetExportService;
use Illuminate\Console\Command;
use Symfony\Component\Console\Output\OutputInterface;

class ExportRcPilotDataset extends Command
{
    protected $signature = 'rc-research:export-pilot {snapshot=pilot-split-v2} {--verify : Verify the existing encrypted export} {--stream= : Read development or final_evaluation intervals as JSONL}';

    protected $description = 'Export an approved local pilot snapshot as private encrypted sensor intervals';

    public function handle(RcPilotDatasetExportService $export): int
    {
        if (! app()->isLocal()) {
            $this->error('Pilot dataset commands require the local development environment.');

            return self::FAILURE;
        }
        $snapshot = (string) $this->argument('snapshot');
        if ($partition = $this->option('stream')) {
            foreach ($export->stream($snapshot, $partition) as $interval) {
                $this->output->writeln(json_encode($interval, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES), OutputInterface::OUTPUT_RAW);
            }

            return self::SUCCESS;
        }
        $result = $this->option('verify') ? $export->verify($snapshot) : $export->export($snapshot);
        $this->info('Private dataset export verified.');
        foreach ($result['summary'] as $partition => $summary) {
            $this->line("$partition: {$summary['recordings']} recordings, {$summary['intervals']} intervals, {$summary['samples']} readings.");
        }

        return self::SUCCESS;
    }
}
