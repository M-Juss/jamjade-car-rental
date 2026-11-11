<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drive_monitoring_sessions', function (Blueprint $table) {
            $table->unsignedTinyInteger('coverage_version')->nullable();
        });
        Schema::create('rental_motion_intervals', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('session_id')->constrained('drive_monitoring_sessions')->cascadeOnDelete();
            $table->unsignedInteger('start_ms');
            $table->unsignedInteger('end_ms');
            $table->index(['session_id', 'start_ms']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_motion_intervals');
        Schema::table('drive_monitoring_sessions', fn (Blueprint $table) => $table->dropColumn('coverage_version'));
    }
};
