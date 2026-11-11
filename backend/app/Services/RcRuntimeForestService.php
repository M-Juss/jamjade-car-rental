<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/** Exact exported scikit-learn forest; float32 input, leaf probabilities, ordered mean. */
class RcRuntimeForestService
{
    public const SHA256 = 'cb4dbcbde174c7401b306c8edd7bd9445eedd6cae7db925c98f12c011d0fdbf1';

    private ?array $forest = null;

    private function forest(): array
    {
        if ($this->forest !== null) {
            return $this->forest;
        }
        $path = Storage::disk('local')->path('rc-research-v2/datasets/models/pilot-split-v3-yaw-forest-v1/runtime-forest-v1.json.encrypted');
        if (! is_file($path)) {
            throw new RuntimeException('Private runtime unavailable.');
        }
        $cipher = file_get_contents($path, false, null, 0, 4194305);
        if ($cipher === false || strlen($cipher) > 4194304) {
            throw new RuntimeException('Runtime exceeds limit.');
        }
        $json = Crypt::decryptString($cipher);
        if (! hash_equals(self::SHA256, hash('sha256', $json))) {
            throw new RuntimeException('Runtime checksum changed.');
        }
        $forest = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        $classes = RcPilotTrainingService::CLASSES_V2;
        sort($classes);
        if ($forest['version'] !== 'rc-runtime-forest-v1' || $forest['feature_count'] !== 35
            || $forest['model_sha256'] !== RcDemoInferenceService::MODEL_SHA256
            || $forest['classes'] !== $classes || count($forest['trees']) !== 300) {
            throw new RuntimeException('Runtime identity differs.');
        }

        return $this->forest = $forest;
    }

    public function probabilities(array $rows): array
    {
        if (! array_is_list($rows) || count($rows) < 1 || count($rows) > 100) {
            throw new RuntimeException('Unsupported runtime batch.');
        }
        $forest = $this->forest();
        $result = [];
        foreach ($rows as $row) {
            if (! array_is_list($row) || count($row) !== 35) {
                throw new RuntimeException('Feature count differs.');
            }
            $values = [];
            foreach ($row as $value) {
                if ((! is_int($value) && ! is_float($value)) || ! is_finite($value)) {
                    throw new RuntimeException('Invalid feature.');
                }
                $single = unpack('f', pack('f', $value))[1];
                if (! is_finite($single)) {
                    throw new RuntimeException('Feature exceeds float32 range.');
                }
                $values[] = $single;
            }
            $votes = array_fill(0, count($forest['classes']), 0.0);
            foreach ($forest['trees'] as $tree) {
                $node = 0;
                while ($tree['left'][$node] !== -1) {
                    $node = $values[$tree['feature'][$node]] <= $tree['threshold'][$node] ? $tree['left'][$node] : $tree['right'][$node];
                }
                $leaf = $tree['value'][$node];
                $total = array_sum($leaf);
                foreach ($leaf as $class => $vote) {
                    $votes[$class] += $vote / $total;
                }
            }
            $result[] = array_map(fn ($vote) => $vote / count($forest['trees']), $votes);
        }

        return $result;
    }

    /** Read-only explanation using the same float32 traversal and leaf averaging. */
    public function explain(array $row): array
    {
        $scores = $this->probabilities([$row])[0];
        $forest = $this->forest();
        $values = array_map(fn ($value) => unpack('f', pack('f', $value))[1], $row);
        $trees = [];
        foreach ($forest['trees'] as $index => $tree) {
            $node = 0;
            $path = [];
            while ($tree['left'][$node] !== -1) {
                $feature = $tree['feature'][$node];
                $left = $values[$feature] <= $tree['threshold'][$node];
                $path[] = ['feature' => $feature, 'value' => $values[$feature],
                    'threshold' => $tree['threshold'][$node], 'operator' => $left ? '<=' : '>'];
                $node = $left ? $tree['left'][$node] : $tree['right'][$node];
            }
            $leaf = $tree['value'][$node];
            $total = array_sum($leaf);
            $trees[] = ['number' => $index + 1, 'path' => $path,
                'scores' => array_combine($forest['classes'], array_map(fn ($v) => $v / $total, $leaf))];
        }

        return ['prediction' => $forest['classes'][array_search(max($scores), $scores, true)],
            'scores' => array_combine($forest['classes'], $scores), 'trees' => $trees,
            'model_sha256' => RcDemoInferenceService::MODEL_SHA256];
    }

    public function predict(array $input): array
    {
        if (($input['version'] ?? null) !== 'rc-demo-inference-v1') {
            throw new RuntimeException('Runtime version differs.');
        }
        $windows = $input['windows'];
        $seen = [];
        foreach ($windows as $window) {
            $id = $window['id'];
            if (! is_string($id) || $id === '' || mb_strlen($id) > 100 || isset($seen[$id])) {
                throw new RuntimeException('Window identity differs.');
            }
            $seen[$id] = true;
        }
        $votes = $this->probabilities(array_column($windows, 'features'));
        $classes = $this->forest()['classes'];
        $predictions = [];
        foreach ($votes as $index => $scores) {
            $winner = array_search(max($scores), $scores, true);
            $predictions[] = ['id' => $windows[$index]['id'], 'class' => $classes[$winner], 'vote' => $scores[$winner]];
        }

        return ['version' => 'rc-demo-inference-v1', 'model_sha256' => RcDemoInferenceService::MODEL_SHA256, 'predictions' => $predictions];
    }
}
