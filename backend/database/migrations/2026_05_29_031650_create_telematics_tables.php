<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telematics_trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('started')->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('resumed_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->decimal('start_latitude', 10, 7)->nullable();
            $table->decimal('start_longitude', 10, 7)->nullable();
            $table->decimal('end_latitude', 10, 7)->nullable();
            $table->decimal('end_longitude', 10, 7)->nullable();
            $table->decimal('current_latitude', 10, 7)->nullable();
            $table->decimal('current_longitude', 10, 7)->nullable();
            $table->decimal('current_speed', 8, 2)->nullable();
            $table->unsignedTinyInteger('battery_percent')->nullable();
            $table->unsignedTinyInteger('gps_signal_percent')->nullable();
            $table->string('current_zone')->nullable();
            $table->string('allowed_zone')->default('NCR Metro Zone');
            $table->timestamp('last_location_at')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('telematics_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('telematics_trips')->cascadeOnDelete();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('event_type')->index();
            $table->string('severity')->default('low')->index();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('speed', 8, 2)->nullable();
            $table->decimal('accelerometer_x', 12, 6)->nullable();
            $table->decimal('accelerometer_y', 12, 6)->nullable();
            $table->decimal('accelerometer_z', 12, 6)->nullable();
            $table->decimal('gyroscope_x', 12, 6)->nullable();
            $table->decimal('gyroscope_y', 12, 6)->nullable();
            $table->decimal('gyroscope_z', 12, 6)->nullable();
            $table->text('description')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });

        Schema::create('geofence_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('telematics_trips')->cascadeOnDelete();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('status')->index();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('distance_from_allowed_area', 8, 2)->nullable();
            $table->string('current_area')->nullable();
            $table->string('allowed_area')->default('NCR Metro Zone');
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('geofence_logs');
        Schema::dropIfExists('telematics_events');
        Schema::dropIfExists('telematics_trips');
    }
};
