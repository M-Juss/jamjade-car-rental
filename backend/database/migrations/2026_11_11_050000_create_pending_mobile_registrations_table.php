<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_mobile_registrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email')->unique();
            $table->string('email_hash', 64)->unique();
            $table->string('phone_number', 30)->nullable();
            $table->string('password');
            $table->string('code_hash');
            $table->string('device_name', 120)->nullable();
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('absolute_expires_at');
            $table->timestamp('resend_available_at');
            $table->timestamp('created_at')->useCurrent();
            $table->index('absolute_expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_mobile_registrations');
    }
};
