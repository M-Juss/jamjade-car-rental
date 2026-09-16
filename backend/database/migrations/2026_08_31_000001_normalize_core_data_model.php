<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('additional_charge_paypal_checkout');
        Schema::dropIfExists('paypal_checkouts');
        Schema::dropIfExists('payments');

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('provider', 32);
            $table->string('purpose', 40)->nullable();
            $table->string('status', 32)->default('pending');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('PHP');
            $table->string('provider_order_id', 128)->nullable()->unique();
            $table->string('provider_transaction_id', 128)->nullable()->unique();
            $table->text('approval_url')->nullable();
            $table->json('provider_response')->nullable();
            $table->string('proof_path')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'status']);
            $table->index(['user_id', 'status']);
            $table->index(['provider', 'status']);
        });

        Schema::table('booking_additional_charges', function (Blueprint $table) {
            $table->index(
                ['responsible_user_id', 'responsibility'],
                'charge_responsible_index'
            );
            $table->dropIndex('charge_responsible_status_index');
            $table->dropIndex(['payment_status']);
        });

        Schema::table('booking_additional_charges', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'paid_at']);
        });

        Schema::create('payment_charge_allocations', function (Blueprint $table) {
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('booking_additional_charge_id')
                ->constrained('booking_additional_charges')
                ->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->timestamps();

            $table->primary(
                ['payment_id', 'booking_additional_charge_id'],
                'payment_charge_allocation_primary'
            );
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['driver_option']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn([
                'driver_option',
                'delivery_time',
                'outside_manila_fee',
                'toll_fee',
                'late_fee',
                'penalty_total',
                'down_payment_amount',
            ]);
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->renameColumn('is_most_booked', 'is_featured');
            $table->dropColumn(['last_service_at', 'next_service_at']);
        });

        Schema::table('emergency_contacts', function (Blueprint $table) {
            $table->unique('user_id');
        });

        Schema::create('customer_document_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_document_id')
                ->constrained('customer_documents')
                ->cascadeOnDelete();
            $table->string('role', 24);
            $table->string('file_path');
            $table->timestamps();

            $table->unique(['customer_document_id', 'role']);
        });

        Schema::table('customer_documents', function (Blueprint $table) {
            $table->dropColumn(['file_path', 'front_file_path', 'back_file_path']);
        });

        Schema::dropIfExists('geofence_logs');
        Schema::dropIfExists('telematics_events');
        Schema::dropIfExists('telematics_trips');

        Schema::create('telematics_trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('operator_user_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 24)->default('started')->index();
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
            $table->string('current_zone', 120)->nullable();
            $table->string('allowed_zone', 120)->default('NCR Metro Zone');
            $table->timestamp('last_location_at')->nullable();
            $table->timestamps();

            $table->unique('booking_id');
            $table->index(['operator_user_id', 'status']);
        });

        Schema::create('telematics_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('telematics_trips')->cascadeOnDelete();
            $table->string('event_type', 40)->index();
            $table->string('severity', 16)->default('low')->index();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('speed', 8, 2)->nullable();
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
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });

        Schema::table('vehicle_maintenance_plans', function (Blueprint $table) {
            $table->dropColumn(['last_completed_at', 'last_completed_odometer']);
        });

        Schema::table('vehicle_maintenance_records', function (Blueprint $table) {
            $table->dropColumn('total_cost');
        });
    }

    public function down(): void
    {
        throw new RuntimeException('This development-only normalization migration is intentionally irreversible.');
    }
};
