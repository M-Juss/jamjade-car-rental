<?php

namespace App\Support;

use App\Enums\VehicleInspectionItemCategory;

final class VehicleInspectionDefinition
{
    /** @return array<string, array<string, string>> */
    public static function checklist(): array
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

    /** @return array<string, string> */
    public static function itemsFor(string $category): array
    {
        return self::checklist()[$category] ?? [];
    }

    /** @return list<string> */
    public static function categoryKeys(): array
    {
        return array_keys(self::checklist());
    }
}
