<?php

namespace App\Services;

use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleConfigurationOption;
use App\Support\VehicleInspectionDefinition;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VehicleConfigurationService
{
    public const SECTIONS = ['brand', 'feature', 'transmission', 'fuel_type', 'exterior', 'interior', 'equipment'];

    public static function lock(): void
    {
        DB::table('vehicle_configuration_state')->where('id', 1)->lockForUpdate()->first();
    }

    public function options(): array
    {
        $options = array_fill_keys(['brand', 'feature', 'transmission', 'fuel_type'], []);
        foreach (VehicleConfigurationOption::query()->whereIn('section', array_keys($options))->where('is_active', true)->orderBy('id')->get() as $option) {
            $options[$option->section][] = $option->name;
        }

        $checklist = VehicleInspectionDefinition::checklist();

        return ['options' => $options, 'checklist' => $checklist, 'checklist_version' => hash('sha256', json_encode($checklist, JSON_THROW_ON_ERROR))];
    }

    public function allOptions(): Collection
    {
        $options = VehicleConfigurationOption::query()->orderBy('id')->get();
        $used = [];
        foreach (['brand', 'transmission', 'fuel_type'] as $section) {
            $used[$section] = DB::table('vehicles')->distinct()->pluck($section)->map(Str::lower(...))->all();
        }
        $used['feature'] = DB::table('vehicle_features')->distinct()->pluck('feature_name')->map(Str::lower(...))->all();
        $checklistKeys = DB::table('vehicle_inspection_items')->select('category', 'item_key')->distinct()->get()
            ->groupBy('category')->map(fn ($items) => $items->pluck('item_key')->all());
        foreach ($options as $option) {
            $inUse = in_array($option->section, VehicleInspectionDefinition::categoryKeys(), true)
                ? in_array($option->key, $checklistKeys[$option->section] ?? [], true)
                : count(array_intersect(array_map(Str::lower(...), [$option->name, ...($option->previous_names ?? [])]), $used[$option->section])) > 0;
            $option->setAttribute('in_use', $inUse);
        }

        return $options;
    }

    public function usage(VehicleConfigurationOption $option): int
    {
        if (in_array($option->section, VehicleInspectionDefinition::categoryKeys(), true)) {
            return DB::table('vehicle_inspection_items')->where('category', $option->section)->where('item_key', $option->key)->count();
        }
        $names = array_map(Str::lower(...), [$option->name, ...($option->previous_names ?? [])]);
        if ($option->section === 'feature') {
            return DB::table('vehicle_features')->whereIn(DB::raw('LOWER(feature_name)'), $names)->count();
        }

        return DB::table('vehicles')->whereIn(DB::raw('LOWER('.$option->section.')'), $names)->count();
    }

    public function save(array $data, User $actor, ?VehicleConfigurationOption $option = null): VehicleConfigurationOption
    {
        return DB::transaction(function () use ($data, $actor, $option) {
            self::lock();
            $option = $option ? VehicleConfigurationOption::query()->lockForUpdate()->findOrFail($option->id) : null;
            $section = $option?->section ?? $data['section'];
            $name = $data['name'];
            $normalized = Str::lower($name);
            $conflict = VehicleConfigurationOption::query()->where('section', $section)->when($option, fn ($query) => $query->where('id', '!=', $option->id))->get()
                ->contains(fn ($existing) => in_array($normalized, array_map(Str::lower(...), [$existing->name, ...($existing->previous_names ?? [])]), true));
            if ($conflict) {
                throw ValidationException::withMessages(['name' => ['This name already exists in this section.']]);
            }
            $active = $data['is_active'];
            if ($option && ! $active && $option->is_active) {
                $this->ensureRemainingChoice($option);
            }
            $previousNames = $option?->previous_names ?? [];
            if ($option && $option->name !== $name && ! in_array($section, VehicleInspectionDefinition::categoryKeys(), true)) {
                $previousNames = array_values(array_unique([...$previousNames, $option->name]));
            }
            $option ??= new VehicleConfigurationOption(['section' => $section, 'key' => 'option_'.Str::uuid()]);
            $option->fill(['name' => $name, 'normalized_name' => $normalized, 'previous_names' => $previousNames, 'is_active' => $active])->save();
            activity()->causedBy($actor)->performedOn($option)->event('vehicle_configuration_saved')->log('Vehicle configuration saved.');

            return $option;
        });
    }

    public function remove(VehicleConfigurationOption $option, User $actor): void
    {
        DB::transaction(function () use ($option, $actor) {
            self::lock();
            $option = VehicleConfigurationOption::query()->lockForUpdate()->findOrFail($option->id);
            if ($option->is_active) {
                $this->ensureRemainingChoice($option);
            }
            $used = $this->usage($option) > 0;
            activity()->causedBy($actor)->performedOn($option)->event($used ? 'vehicle_configuration_deactivated' : 'vehicle_configuration_deleted')->log($used ? 'Vehicle option deactivated.' : 'Unused vehicle option deleted.');
            if ($used) {
                $option->update(['is_active' => false]);
            } else {
                $option->delete();
            }
        });
    }

    private function ensureRemainingChoice(VehicleConfigurationOption $option): void
    {
        if (! VehicleConfigurationOption::query()->where('section', $option->section)->where('is_active', true)->whereKeyNot($option->id)->exists()) {
            throw ValidationException::withMessages(['is_active' => ['Keep at least one active option in this section.']]);
        }
    }

    public static function assertChecklistCurrent(array $condition, string $prefix = 'condition'): void
    {
        if (($condition['checklist_version'] ?? null) !== VehicleInspectionDefinition::version()) {
            throw ValidationException::withMessages(["{$prefix}.checklist" => ['The checklist changed. Reload it and review the items before signing again.']]);
        }
        $expected = VehicleInspectionDefinition::checklist();
        foreach ($expected as $category => $items) {
            $answers = $condition['checklist'][$category] ?? [];
            if (array_diff_key($answers, $items) || array_diff_key($items, $answers) || count(array_filter($answers, fn ($value) => ! in_array($value, [true, false, 0, 1, '0', '1'], true)))) {
                throw ValidationException::withMessages(["{$prefix}.checklist" => ['Review every checklist item.']]);
            }
        }
    }

    public static function validateVehicleOptions(array $data, ?Vehicle $vehicle = null): void
    {
        $options = app(self::class)->options()['options'];
        $errors = [];
        foreach (['brand', 'transmission', 'fuel_type'] as $field) {
            if (array_key_exists($field, $data) && ! in_array($data[$field], $options[$field], true) && (! $vehicle || $data[$field] !== $vehicle->{$field})) {
                $errors[$field] = ['Select an active option.'];
            }
        }
        $existing = $vehicle?->features()->pluck('feature_name')->all() ?? [];
        foreach ($data['features'] ?? [] as $index => $name) {
            if (! in_array($name, $options['feature'], true) && ! in_array($name, $existing, true)) {
                $errors["features.{$index}"] = ['Select an active feature.'];
            }
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }
}
