<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('geofences', 'notify_on_enter')) {
            Schema::table('geofences', function (Blueprint $table) {
                $table->boolean('notify_on_enter')->default(true);
                $table->boolean('notify_on_exit')->default(true);
            });
        }
        if (Schema::hasColumn('telematics_setup_sessions', 'booking_geofence_id')) {
            Schema::table('telematics_setup_sessions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('booking_geofence_id');
            });
        }
        if (! Schema::hasColumn('booking_geofences', 'scope')) {
            Schema::table('booking_geofences', function (Blueprint $table) {
                $table->index('booking_id', 'booking_geofences_booking_index');
                $table->dropUnique(['booking_id']);
                $table->string('scope', 16)->default('custom');
                $table->boolean('notify_on_enter')->default(true);
                $table->boolean('notify_on_exit')->default(true);
                $table->timestamp('frozen_at')->nullable();
                $table->unique(['booking_id', 'source_geofence_id']);
            });
        }
        // Preserve existing local rental history; pre-release rows become custom zones.
        DB::table('telematics_setup_sessions')->whereNotNull('released_at')->select('booking_id', 'released_at')->orderBy('id')
            ->each(fn ($booking) => DB::table('booking_geofences')->where('booking_id', $booking->booking_id)
                ->update(['frozen_at' => $booking->released_at]));
        // Prior pre-release assignments are custom additions, not default overrides.
        DB::table('booking_geofences')->whereNull('frozen_at')->update(['source_geofence_id' => null]);
        // Retire the obsolete readiness gate; its enum is no longer part of setup.
        DB::table('telematics_setup_steps')->where('step_type', 'geofence_check')->delete();
        if (! Schema::hasTable('telematics_geofence_states')) {
            Schema::create('telematics_geofence_states', function (Blueprint $table) {
                $table->id();
                $table->foreignId('telematics_trip_id')->constrained()->cascadeOnDelete();
                $table->foreignId('booking_geofence_id')->constrained()->cascadeOnDelete();
                $table->boolean('inside')->nullable();
                $table->boolean('uncertain')->default(true);
                $table->boolean('candidate_inside')->nullable();
                $table->unsignedSmallInteger('candidate_count')->default(0);
                $table->timestamp('candidate_started_at')->nullable();
                $table->timestamp('last_captured_at')->nullable();
                $table->timestamps();
                $table->unique(['telematics_trip_id', 'booking_geofence_id'], 'telematics_geofence_state_unique');
            });
        }
    }

    public function down(): void
    {
        // A one-zone schema cannot represent multiple zones without losing data.
        if (DB::table('booking_geofences')->select('booking_id')->groupBy('booking_id')->havingRaw('COUNT(*) > 1')->exists()) {
            throw new RuntimeException('Remove additional local test zones before rolling back this migration.');
        }
        Schema::dropIfExists('telematics_geofence_states');
        Schema::table('booking_geofences', function (Blueprint $table) {
            $table->dropUnique(['booking_id', 'source_geofence_id']);
            $table->unique('booking_id');
            $table->dropIndex('booking_geofences_booking_index');
            $table->dropColumn(['scope', 'notify_on_enter', 'notify_on_exit', 'frozen_at']);
        });
        Schema::table('telematics_setup_sessions', function (Blueprint $table) {
            $table->foreignId('booking_geofence_id')->nullable()->constrained()->nullOnDelete();
        });
        Schema::table('geofences', fn (Blueprint $table) => $table->dropColumn(['notify_on_enter', 'notify_on_exit']));
    }
};
