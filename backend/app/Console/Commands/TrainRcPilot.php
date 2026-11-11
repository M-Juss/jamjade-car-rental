<?php

namespace App\Console\Commands;

use App\Services\RcPilotTrainingService;
use Illuminate\Console\Command;

class TrainRcPilot extends Command
{
    protected $signature = 'rc-research:train-pilot {snapshot=pilot-split-v2} {--verify : Verify the existing private model package}';

    protected $description = 'Compare local development-session classifiers while keeping final evaluation reserved';

    public function handle(RcPilotTrainingService $training): int
    {
        if (! app()->isLocal()) {
            $this->error('Pilot training requires the local development environment.');

            return self::FAILURE;
        }
        $snapshot = (string) $this->argument('snapshot');
        $document = $this->option('verify') ? $training->verify($snapshot) : $training->train($snapshot);
        $result = $document['result'];
        $metric = $result['schema'] === RcPilotTrainingService::VERSION_V2
            ? 'macro_f1_fixed_seven_classes' : 'macro_f1_fixed_five_classes';
        $this->info('Development-session comparison verified; final evaluation remains reserved.');
        foreach ($result['comparisons'] as $name => $comparison) {
            $scores = $comparison['pooled_out_of_session'];
            $this->line(sprintf('%s: accuracy %.4f; macro F1 %.4f', $name, $scores['accuracy'], $scores[$metric]));
        }
        $this->line('Best development comparison: '.$result['best_development_model']);

        return self::SUCCESS;
    }
}
