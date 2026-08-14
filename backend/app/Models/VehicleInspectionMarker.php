<?php

namespace App\Models;

use App\Enums\VehicleInspectionIssueType;
use App\Enums\VehicleInspectionPanel;
use App\Models\Concerns\ProtectsFinalizedInspection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleInspectionMarker extends Model
{
    use ProtectsFinalizedInspection;

    protected $fillable = [
        'sequence_number',
        'panel',
        'x_position',
        'y_position',
        'issue_type',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'sequence_number' => 'integer',
            'panel' => VehicleInspectionPanel::class,
            'x_position' => 'decimal:3',
            'y_position' => 'decimal:3',
            'issue_type' => VehicleInspectionIssueType::class,
        ];
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(VehicleInspection::class, 'inspection_id');
    }
}
