<?php

namespace App\Models;

use App\Enums\VehicleInspectionSignerType;
use App\Models\Concerns\ProtectsFinalizedInspection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleInspectionSignature extends Model
{
    use ProtectsFinalizedInspection;

    protected $fillable = [
        'signer_type',
        'user_id',
        'signer_name',
        'signature_path',
        'signed_at',
    ];

    protected $hidden = ['signature_path'];

    protected function casts(): array
    {
        return [
            'signer_type' => VehicleInspectionSignerType::class,
            'signed_at' => 'datetime',
        ];
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(VehicleInspection::class, 'inspection_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
