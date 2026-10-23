<?php

namespace App\Support;

use App\Enums\VehicleInspectionItemCategory;
use App\Models\VehicleConfigurationOption;

final class VehicleInspectionDefinition
{
    /** @return array<string, array<string, string>> */
    public static function defaults(): array
    {
        return [
            VehicleInspectionItemCategory::Exterior->value => [
                'carwash' => 'Carwash',
                'tire' => 'Tire',
                'gas_cover' => 'Gas Cover',
                'body_check' => 'Body Check',
                'side_mirror' => 'Side Mirror',
                'wiper' => 'Wiper',
                'head_light' => 'Head Light',
                'tail_light' => 'Tail Light',
                'signal_light' => 'Signal Light',
            ],
            VehicleInspectionItemCategory::Interior->value => [
                'door_pocket' => 'Door Pocket',
                'window_button' => 'Window Button',
                'door_lock' => 'Door Lock',
                'bottle_holder' => 'Bottle Holder',
                'matting_carpet' => 'Matting / Carpet',
                'ceiling' => 'Ceiling',
                'dashboard' => 'Dashboard',
                'seat_position' => 'Seat Position',
                'lights' => 'Lights',
                'radio' => 'Radio',
            ],
            VehicleInspectionItemCategory::Equipment->value => [
                'umbrella' => 'Umbrella',
                'cellphone' => 'Cellphone',
                'tablet' => 'Tablet',
                'toothbrush' => 'Toothbrush',
                'spare_tire' => 'Spare Tire',
                'early_warning_device' => 'Early Warning Device',
                'four_tools' => '4-Tools',
                'glove_box' => 'Glove / Glove Box',
            ],
        ];
    }

    /** @return array<string, array<string, string>> */
    public static function checklist(): array
    {
        $checklist = array_fill_keys(self::categoryKeys(), []);
        foreach (VehicleConfigurationOption::query()->whereIn('section', self::categoryKeys())->where('is_active', true)->orderBy('id')->get() as $option) {
            $checklist[$option->section][$option->key] = $option->name;
        }

        return $checklist;
    }

    public static function version(): string
    {
        return hash('sha256', json_encode(self::checklist(), JSON_THROW_ON_ERROR));
    }

    /** @return array<string, string> */
    public static function itemsFor(string $category): array
    {
        return self::checklist()[$category] ?? [];
    }

    /** @return list<string> */
    public static function categoryKeys(): array
    {
        return ['exterior', 'interior', 'equipment'];
    }
}
