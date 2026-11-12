<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MobilePasswordReset extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $hidden = ['email_hash', 'code_hash', 'token_hash', 'password_fingerprint'];

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime', 'resend_available_at' => 'immutable_datetime', 'failed_attempts' => 'integer'];
    }
}
