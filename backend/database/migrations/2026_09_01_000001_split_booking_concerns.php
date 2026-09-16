<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('booking_status_logs');

        Schema::create('booking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('event_type', 40)->default('status_changed')->index();
            $table->string('old_status')->nullable();
            $table->string('new_status')->nullable();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'event_type', 'created_at'], 'booking_events_lookup_index');
        });

        Schema::create('booking_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->string('calibration_status', 24)->default('locked');
            $table->foreignId('calibrated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('calibrated_at')->nullable();
            $table->timestamps();

            $table->unique('booking_id');
            $table->index(['driver_id', 'assigned_at'], 'booking_assignments_driver_index');
        });

        Schema::create('booking_terms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->text('customer_signature')->nullable();
            $table->string('terms_version', 40)->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->unique('booking_id');
        });

        Schema::create('booking_confirmation_emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->string('status', 24)->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->unique('booking_id');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_driver_id');
            $table->dropConstrainedForeignId('calibrated_by');
            $table->dropConstrainedForeignId('completed_by');
            $table->dropConstrainedForeignId('return_charges_finalized_by');
        });

        Schema::table('bookings', function (Blueprint $table) {
            // SQLite requires indexes to be removed before their columns.
            $table->dropIndex(['calibration_status']);
            $table->dropIndex(['confirmation_email_sent_at']);
            $table->dropIndex(['confirmation_email_status']);
            $table->dropColumn([
                'driver_assigned_at',
                'calibration_status',
                'calibrated_at',
                'confirmed_at',
                'rejected_at',
                'started_at',
                'completed_at',
                'return_charges_finalized_at',
                'returned_at',
                'cancelled_at',
                'customer_signature',
                'terms_version',
                'terms_accepted_at',
                'confirmation_email_sent_at',
                'confirmation_email_status',
                'confirmation_email_error',
            ]);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('This development-only booking split migration is intentionally irreversible.');
    }
};
