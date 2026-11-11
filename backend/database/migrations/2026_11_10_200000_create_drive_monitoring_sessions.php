<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drive_monitoring_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->uuid('reference_run_id');
            $table->foreign('reference_run_id')->references('id')->on('rc_processing_runs')->restrictOnDelete();
            $table->uuid('client_session_id');
            $table->string('status', 16)->default('active');
            $table->string('model_sha256', 64);
            $table->timestamp('consented_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'client_session_id']);
            $table->index(['user_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drive_monitoring_sessions');
    }
};
