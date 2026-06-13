<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerProfile extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'birthdate',
        'address',
        'profile_picture',
        'profile_completed_at',
        'emergency_contact_skipped_at',
        'can_self_drive',
        'verification_status',
        'passport_required',
        'driving_intent',
    ];

    protected function casts(): array
    {
        return [
            'birthdate' => 'date',
            'profile_completed_at' => 'datetime',
            'emergency_contact_skipped_at' => 'datetime',
            'can_self_drive' => 'boolean',
            'passport_required' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
