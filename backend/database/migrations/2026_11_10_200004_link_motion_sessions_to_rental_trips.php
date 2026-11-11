<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drive_monitoring_sessions', function (Blueprint $table) {
            $table->uuid('reference_run_id')->nullable()->change();
            $table->foreignId('telematics_trip_id')->nullable()->constrained('telematics_trips')->restrictOnDelete();
            $table->string('sensor_platform', 32)->default('rc');
            $table->string('consent_version', 40)->default('drive-monitoring-v1');
            $table->unsignedBigInteger('capture_started_ms')->nullable();
            $table->unsignedBigInteger('capture_closed_ms')->nullable();
            $table->index(['telematics_trip_id', 'status']);
        });
    }

    public function down(): void
    {
        if (DB::table('drive_monitoring_sessions')->whereNotNull('telematics_trip_id')->exists()) {
            throw new RuntimeException('Rental motion history must be preserved before reverting this migration.');
        }
        // Existing research records retain their original reference requirement in application validation.
        Schema::table('drive_monitoring_sessions', function (Blueprint $table) {
            $table->dropForeign(['telematics_trip_id']);
            $table->dropIndex(['telematics_trip_id', 'status']);
            $table->dropColumn(['telematics_trip_id', 'sensor_platform', 'capture_started_ms', 'capture_closed_ms', 'consent_version']);
        });
    }
};
