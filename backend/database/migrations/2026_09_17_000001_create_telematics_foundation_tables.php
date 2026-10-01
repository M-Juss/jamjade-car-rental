<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geofences', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('center_latitude', 10, 7);
            $table->decimal('center_longitude', 10, 7);
            $table->decimal('radius_meters', 10, 2);
            $table->boolean('is_active')->default(true)->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('booking_geofences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('source_geofence_id')->nullable()->constrained('geofences')->nullOnDelete();
            $table->string('name_snapshot');
            $table->decimal('center_latitude', 10, 7);
            $table->decimal('center_longitude', 10, 7);
            $table->decimal('radius_meters', 10, 2);
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at');
            $table->timestamps();
        });

        Schema::create('telematics_setup_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('booking_geofence_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 24)->default('locked')->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
        });

        Schema::create('telematics_setup_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('telematics_setup_session_id')->constrained()->cascadeOnDelete();
            $table->string('step_type', 40)->index();
            $table->unsignedSmallInteger('attempt_number');
            $table->string('status', 24)->default('pending')->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->json('evidence')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['telematics_setup_session_id', 'step_type', 'attempt_number'], 'telematics_setup_step_attempt_unique');
        });

        Schema::create('telematics_location_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('telematics_trip_id')->constrained()->cascadeOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy', 8, 2)->nullable();
            $table->decimal('speed', 8, 2)->nullable();
            $table->decimal('heading', 6, 2)->nullable();
            $table->timestamp('captured_at');
            $table->timestamp('received_at');
            $table->timestamps();

            $table->index(['telematics_trip_id', 'captured_at'], 'telematics_location_trip_captured_index');
        });

        Schema::table('booking_assignments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('calibrated_by');
            $table->dropColumn(['calibration_status', 'calibrated_at']);
        });

        Schema::table('telematics_trips', function (Blueprint $table) {
            $table->dropColumn('allowed_zone');
            $table->index(['status', 'last_location_at'], 'telematics_trips_status_location_index');
        });

        Schema::table('telematics_events', function (Blueprint $table) {
            $table->json('metadata')->nullable()->after('longitude');
            $table->dropIndex(['geofence_status']);
            $table->dropColumn([
                'speed',
                'accelerometer_x', 'accelerometer_y', 'accelerometer_z',
                'gyroscope_x', 'gyroscope_y', 'gyroscope_z',
                'geofence_status', 'distance_from_allowed_area', 'current_area', 'description',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('telematics_events', function (Blueprint $table) {
            $table->decimal('speed', 8, 2)->nullable()->after('longitude');
            $table->decimal('accelerometer_x', 12, 6)->nullable();
            $table->decimal('accelerometer_y', 12, 6)->nullable();
            $table->decimal('accelerometer_z', 12, 6)->nullable();
            $table->decimal('gyroscope_x', 12, 6)->nullable();
            $table->decimal('gyroscope_y', 12, 6)->nullable();
            $table->decimal('gyroscope_z', 12, 6)->nullable();
            $table->string('geofence_status', 24)->nullable()->index();
            $table->decimal('distance_from_allowed_area', 8, 2)->nullable();
            $table->string('current_area', 120)->nullable();
            $table->text('description')->nullable();
            $table->dropColumn('metadata');
        });

        Schema::table('telematics_trips', function (Blueprint $table) {
            $table->dropIndex('telematics_trips_status_location_index');
            $table->string('allowed_zone', 120)->default('NCR Metro Zone');
        });

        Schema::table('booking_assignments', function (Blueprint $table) {
            $table->string('calibration_status', 24)->default('locked');
            $table->foreignId('calibrated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('calibrated_at')->nullable();
        });

        Schema::dropIfExists('telematics_location_points');
        Schema::dropIfExists('telematics_setup_steps');
        Schema::dropIfExists('telematics_setup_sessions');
        Schema::dropIfExists('booking_geofences');
        Schema::dropIfExists('geofences');
    }
};
