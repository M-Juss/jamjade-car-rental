<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PendingMobileRegistration extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'email', 'email_hash', 'phone_number', 'password', 'code_hash', 'device_name',
        'failed_attempts', 'expires_at', 'absolute_expires_at', 'resend_available_at', 'created_at',
    ];

    protected $hidden = ['email_hash', 'password', 'code_hash', 'phone_number', 'email'];

    protected function casts(): array
    {
        return [
            'failed_attempts' => 'integer',
            'expires_at' => 'immutable_datetime',
            'absolute_expires_at' => 'immutable_datetime',
            'resend_available_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
        ];
    }
}
