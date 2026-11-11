<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_verifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('actor_id')->constrained('users');
            $table->foreignId('owner_id')->constrained('users');
            $table->string('owner_email_hash', 64);
            $table->string('action');
            $table->string('target');
            $table->string('payload_hash', 64);
            $table->string('state_hash', 64);
            $table->string('code_hash');
            $table->unsignedTinyInteger('failed_attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('resend_available_at');
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('created_at');
            $table->index(['actor_id', 'action', 'target']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_verifications');
    }
};
