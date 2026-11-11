<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OwnerVerification extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $hidden = ['code_hash', 'payload_hash', 'state_hash', 'owner_email_hash'];

    protected function casts(): array
    {
        return [
            'failed_attempts' => 'integer',
            'expires_at' => 'immutable_datetime',
            'resend_available_at' => 'immutable_datetime',
            'consumed_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
        ];
    }
}
