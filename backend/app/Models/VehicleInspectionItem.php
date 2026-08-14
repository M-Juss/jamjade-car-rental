<?php

namespace App\Models;

use App\Enums\VehicleInspectionItemCategory;
use App\Models\Concerns\ProtectsFinalizedInspection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleInspectionItem extends Model
{
    use ProtectsFinalizedInspection;

    protected $fillable = ['category', 'item_key', 'item_label', 'value', 'notes'];

    protected function casts(): array
    {
        return [
            'category' => VehicleInspectionItemCategory::class,
            'value' => 'boolean',
        ];
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(VehicleInspection::class, 'inspection_id');
    }
}
