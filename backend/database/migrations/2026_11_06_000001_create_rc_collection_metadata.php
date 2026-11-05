<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rc_collection_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('device_profile_id');
            $table->unsignedInteger('session_number');
            $table->text('payload');
            $table->char('content_sha256', 64);
            $table->timestamps();
            $table->unique(['user_id', 'device_profile_id', 'session_number'], 'rc_collection_session_number');
        });
        Schema::create('rc_mount_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('session_id')->constrained('rc_collection_sessions')->cascadeOnDelete();
            $table->unsignedInteger('mount_number');
            $table->text('payload');
            $table->char('content_sha256', 64);
            $table->timestamps();
            $table->unique(['session_id', 'mount_number']);
        });
        Schema::create('rc_collection_contexts', function (Blueprint $table) {
            $table->foreignUuid('recording_id')->primary()->constrained('rc_native_recordings')->cascadeOnDelete();
            $table->foreignUuid('mount_id')->constrained('rc_mount_versions')->cascadeOnDelete();
            $table->uuid('preflight_id')->unique();
            $table->unsignedInteger('capture_number');
            $table->string('display_code', 80);
            $table->text('payload');
            $table->char('content_sha256', 64);
            $table->timestamps();
        });
        Schema::create('rc_observation_revisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('recording_id')->constrained('rc_native_recordings')->cascadeOnDelete();
            $table->unsignedInteger('revision');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('payload');
            $table->char('content_sha256', 64);
            $table->timestamp('created_at');
            $table->unique(['recording_id', 'revision']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rc_observation_revisions');
        Schema::dropIfExists('rc_collection_contexts');
        Schema::dropIfExists('rc_mount_versions');
        Schema::dropIfExists('rc_collection_sessions');
    }
};
