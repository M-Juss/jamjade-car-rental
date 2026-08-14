<?php

namespace App\Models\Concerns;

use App\Enums\VehicleInspectionStatus;
use LogicException;

trait ProtectsFinalizedInspection
{
    protected static function bootProtectsFinalizedInspection(): void
    {
        static::saving(function ($record): void {
            if ($record->inspection()->first()?->status === VehicleInspectionStatus::Finalized) {
                throw new LogicException('Finalized vehicle inspection records cannot be changed.');
            }
        });

        static::deleting(function ($record): void {
            if ($record->inspection()->first()?->status === VehicleInspectionStatus::Finalized) {
                throw new LogicException('Finalized vehicle inspection records cannot be deleted.');
            }
        });
    }
}
