<?php

namespace App\Support;

use App\Enums\VehicleInspectionIssueType;
use App\Enums\VehicleInspectionPanel;
use Illuminate\Validation\Rule;

final class VehicleConditionRules
{
    /** @return array<string, array<int, mixed>> */
    public static function rules(string $prefix = 'initial_condition'): array
    {
        $rules = [
            "{$prefix}.checklist_version" => ['required', 'string', function ($attribute, $value, $fail) {
                if ($value !== VehicleInspectionDefinition::version()) {
                    $fail('The checklist changed. Reload it and review the items before signing again.');
                }
            }],
            $prefix => ['required', 'array'],
            "{$prefix}.odometer" => ['required', 'integer', 'min:0'],
            "{$prefix}.fuel_level" => ['required', 'integer', 'between:0,8'],
            "{$prefix}.comments" => ['nullable', 'string', 'max:3000'],
            "{$prefix}.checklist" => ['required', 'array:'.implode(',', VehicleInspectionDefinition::categoryKeys())],
            "{$prefix}.markers" => ['present', 'array'],
            "{$prefix}.markers.*" => ['required', 'array:sequence_number,panel,x_position,y_position,issue_type,description'],
            "{$prefix}.markers.*.sequence_number" => ['required', 'integer', 'min:1', 'distinct'],
            "{$prefix}.markers.*.panel" => ['required', Rule::enum(VehicleInspectionPanel::class)],
            "{$prefix}.markers.*.x_position" => ['required', 'numeric', 'between:0,100'],
            "{$prefix}.markers.*.y_position" => ['required', 'numeric', 'between:0,100'],
            "{$prefix}.markers.*.issue_type" => ['required', Rule::enum(VehicleInspectionIssueType::class)],
            "{$prefix}.markers.*.description" => ['required', 'string', 'max:1000'],
            "{$prefix}.signature_data" => [
                'required',
                'string',
                'max:1400000',
                'regex:/^data:image\/png;base64,[A-Za-z0-9+\/=\r\n]+$/',
            ],
        ];

        foreach (VehicleInspectionDefinition::checklist() as $category => $items) {
            $keys = array_keys($items);
            $rules["{$prefix}.checklist.{$category}"] = [
                'required',
                'array:'.implode(',', $keys),
                'size:'.count($keys),
            ];

            foreach ($keys as $key) {
                $rules["{$prefix}.checklist.{$category}.{$key}"] = ['required', 'boolean'];
            }
        }

        return $rules;
    }

    /** @return list<string> */
    public static function markerSequenceErrors(array $markers): array
    {
        $sequence = collect($markers)
            ->pluck('sequence_number')
            ->filter(fn (mixed $value) => is_int($value) || ctype_digit((string) $value))
            ->map(fn (mixed $value) => (int) $value)
            ->sort()
            ->values()
            ->all();

        return $sequence === range(1, count($sequence)) || $sequence === []
            ? []
            : ['Marker numbers must be sequential, beginning with 1.'];
    }
}
