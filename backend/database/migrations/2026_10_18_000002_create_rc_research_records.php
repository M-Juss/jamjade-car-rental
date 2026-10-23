<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rc_research_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            foreach (['name', 'phone_model', 'rc_model', 'surface', 'slope', 'mount_orientation', 'mount_method', 'battery_condition', 'platform', 'app_version'] as $column) {
                $table->string($column, 100);
            }
            $table->string('rc_configuration', 500)->nullable();
            $table->unsignedInteger('added_load_g')->default(0);
            $table->json('protocol');
            $table->timestamp('consented_at');
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
        Schema::create('rc_research_trials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('session_id')->constrained('rc_research_sessions')->restrictOnDelete();
            $table->string('client_trial_id', 64);
            foreach (['intended_movement', 'intended_intensity', 'observed_movement', 'observed_intensity', 'label_status', 'quality'] as $column) {
                $table->string($column, 32);
            }
            $table->unsignedInteger('event_start_ms');
            $table->unsignedInteger('event_end_ms');
            $table->string('notes', 500)->nullable();
            $table->timestamp('started_at', 3);
            $table->timestamp('ended_at', 3);
            $table->string('samples_path')->nullable();
            $table->char('content_hash', 64);
            $table->json('summary');
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['session_id', 'client_trial_id']);
            $table->index(['session_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rc_research_trials');
        Schema::dropIfExists('rc_research_sessions');
    }
};
