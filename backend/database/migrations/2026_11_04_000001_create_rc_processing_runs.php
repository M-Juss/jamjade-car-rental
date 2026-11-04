<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rc_processing_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('recording_id')->constrained('rc_native_recordings')->restrictOnDelete();
            $table->string('version', 80);
            $table->unsignedTinyInteger('cutoff_hz');
            $table->char('fingerprint', 64);
            $table->string('payload_path');
            $table->char('payload_sha256', 64);
            $table->timestamp('created_at', 3);
            $table->unique(['recording_id', 'fingerprint']);
            $table->index(['recording_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rc_processing_runs');
    }
};
