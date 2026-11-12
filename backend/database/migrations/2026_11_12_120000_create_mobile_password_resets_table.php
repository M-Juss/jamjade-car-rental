<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobile_password_resets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('email_hash', 64)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code_hash');
            $table->string('token_hash', 64)->nullable();
            $table->string('password_fingerprint', 64)->nullable();
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->timestamp('expires_at')->index();
            $table->timestamp('resend_available_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_password_resets');
    }
};
