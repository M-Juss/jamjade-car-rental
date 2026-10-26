<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rc_native_recordings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->uuid('client_recording_id');
            $table->string('name', 200);
            $table->string('surface', 100);
            $table->string('state', 20)->default('incomplete');
            $table->string('capture_state', 20);
            $table->string('manifest_path');
            $table->char('manifest_sha256', 64);
            $table->unsignedInteger('expected_chunks');
            $table->unsignedBigInteger('expected_bytes');
            $table->double('duration_ms');
            $table->json('summary')->nullable();
            $table->timestamp('started_at', 3);
            $table->timestamp('verified_at', 3)->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'client_recording_id']);
            $table->index(['user_id', 'started_at']);
        });
        Schema::create('rc_native_recording_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('recording_id')->constrained('rc_native_recordings')->cascadeOnDelete();
            $table->string('channel', 32);
            $table->unsignedInteger('chunk_index');
            $table->string('payload_path');
            $table->char('sha256', 64);
            $table->unsignedInteger('logical_bytes');
            $table->unsignedInteger('event_count');
            $table->json('summary');
            $table->timestamps();
            $table->unique(['recording_id', 'channel', 'chunk_index'], 'rc_native_chunk_identity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rc_native_recording_chunks');
        Schema::dropIfExists('rc_native_recordings');
    }
};
