<?php

namespace App\Services;

use App\Support\RcNativeProtocol;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class RcPilotTrainingService
{
    public const VERSION = 'rc-pilot-development-models-v1';

    public const VERSION_V2 = 'rc-pilot-development-models-v2';

    public const CLASSES_V2 = ['normal_motion', 'harsh_acceleration', 'harsh_braking', 'harsh_cornering',
        'lane_change', 'normal_swerve', 'harsh_swerve'];

    private const MODELS = ['majority_baseline', 'balanced_logistic', 'balanced_random_forest'];

    public function __construct(
        private readonly RcPilotFeatureService $features,
        private readonly RcPilotDatasetExportService $export,
    ) {}

    public function train(string $snapshot): array
    {
        [$input, $identity, $path, $script, $version] = $this->source($snapshot);
        $this->ensure(! file_exists($path), 'This training package already exists. Use --verify.');
        $python = base_path('ml/.venv/bin/python');
        $this->ensure(is_executable($python), 'Create the local Python environment using the central guide first.');
        $process = new Process([$python, base_path('ml/'.$script)], base_path(), [
            'OPENBLAS_NUM_THREADS' => '1', 'OMP_NUM_THREADS' => '1', 'MKL_NUM_THREADS' => '1',
            'VECLIB_MAXIMUM_THREADS' => '1', 'PYTHONHASHSEED' => '42', 'PYTHONDONTWRITEBYTECODE' => '1',
        ]);
        $process->setInput($input)->setTimeout(180)->run();
        $this->ensure($process->isSuccessful(), 'Local model training failed. Check the pinned environment and training contracts; no package was saved.');
        $output = $process->getOutput();
        $this->ensure(strlen($output) <= 20 * 1024 * 1024, 'The training output exceeded its private storage limit.');
        $result = json_decode($output, true, 64, JSON_THROW_ON_ERROR);
        $this->validate($result, json_decode($input, true, 64, JSON_THROW_ON_ERROR));
        $document = ['schema' => $version, 'created_at' => now()->toISOString(), 'identity' => $identity, 'result' => $result];
        $directory = dirname($path);
        $this->ensure(is_dir($directory) || mkdir($directory, 0700, true), 'Private model storage is unavailable.');
        $stage = $directory.'/.pending-'.Str::uuid();
        $this->ensure(mkdir($stage, 0700), 'Private model staging is unavailable.');
        try {
            $ciphertext = Crypt::encryptString(json_encode($document, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
            $file = $stage.'/comparison.json.encrypted';
            $this->ensure(file_put_contents($file, $ciphertext, LOCK_EX) === strlen($ciphertext) && chmod($file, 0600), 'Private model write failed.');
            $this->ensure(link($file, $path), 'Unable to publish the private model package.');
        } finally {
            File::deleteDirectory($stage);
        }

        return $this->verify($snapshot);
    }

    public function verify(string $snapshot): array
    {
        [$input, $identity, $path, , $version] = $this->source($snapshot);
        $this->ensure(is_file($path) && is_readable($path), 'The private training package is unavailable.');
        $document = json_decode(Crypt::decryptString(file_get_contents($path)), true, 64, JSON_THROW_ON_ERROR);
        $this->ensure($document['schema'] === $version
            && RcNativeProtocol::canonical($document['identity']) === RcNativeProtocol::canonical($identity), 'Training source or code changed.');
        $this->validate($document['result'], json_decode($input, true, 64, JSON_THROW_ON_ERROR));

        return $document;
    }

    private function source(string $snapshot): array
    {
        $features = $this->features->verify($snapshot);
        unset($features['stationary_context']);
        $manifest = $this->export->verify($snapshot);
        $new = ($manifest['selection']['schema'] ?? 'jamjade-rc-pilot-split-v1') === 'jamjade-rc-pilot-split-v2';
        $version = $new ? self::VERSION_V2 : self::VERSION;
        $script = $new ? 'train_pilot_v2.py' : 'train_pilot.py';
        $records = [];
        foreach ($manifest['recordings'] as $record) {
            if ($record['partition'] === 'development') {
                $records[] = array_intersect_key($record, array_flip(['recording_id', 'session_id', 'session_number', 'code', 'surface', 'partition']));
            }
        }
        $payload = ['schema' => $version, 'features' => $features, 'recordings' => $records];
        $input = json_encode($payload, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
        $identity = ['input_sha256' => hash('sha256', $input), 'trainer_sha256' => hash_file('sha256', base_path('ml/'.$script)),
            'requirements_sha256' => hash_file('sha256', base_path('ml/requirements.txt'))];
        $fingerprint = hash('sha256', RcNativeProtocol::canonical($identity));

        return [$input, $identity, Storage::disk('local')->path('rc-research-v2/datasets/models/'.$fingerprint.'/comparison.json.encrypted'), $script, $version];
    }

    private function validate(array $result, array $input): void
    {
        $version = $input['schema'];
        $classes = $version === self::VERSION_V2 ? self::CLASSES_V2 : ['normal_motion', 'harsh_acceleration',
            'harsh_braking', 'harsh_cornering', 'swerving'];
        $metric = $version === self::VERSION_V2 ? 'macro_f1_fixed_seven_classes' : 'macro_f1_fixed_five_classes';
        $this->ensure(in_array($version, [self::VERSION, self::VERSION_V2], true)
            && $result['schema'] === $version
            && $result['class_order'] === $classes
            && $result['protocol']['final_evaluation_used'] === false
            && $result['protocol']['validation'] === 'leave-one-research-session-out'
            && $result['feature_columns'] === $input['features']['definition']['feature_columns']
            && $result['summary']['examples'] === count($input['features']['examples'])
            && array_keys($result['models']) === self::MODELS
            && array_keys($result['comparisons']) === self::MODELS
            && in_array($result['best_development_model'], self::MODELS, true), 'The training result contract differs.');
        foreach ($result['models'] as $name => $model) {
            $bytes = base64_decode($model['bytes_base64'], true);
            $this->ensure($bytes !== false && hash('sha256', $bytes) === $model['sha256'], 'A saved candidate checksum differs.');
            $comparison = $result['comparisons'][$name];
            $score = $comparison['pooled_out_of_session'][$metric];
            $this->ensure(is_numeric($score) && is_finite($score) && $score >= 0 && $score <= 1
                && count($comparison['out_of_session_predictions']) === count($input['features']['examples']), 'Validation results are incomplete.');
        }
    }

    private function ensure(bool $condition, string $message): void
    {
        if (! $condition) {
            throw new RuntimeException($message);
        }
    }
}
