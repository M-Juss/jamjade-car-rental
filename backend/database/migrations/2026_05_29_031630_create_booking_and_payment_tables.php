<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('booking_code')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->string('rental_type')->index();
            $table->timestamp('rental_start_at')->index();
            $table->timestamp('rental_end_at')->index();
            $table->string('pickup_location_type')->default('shop')->index();
            $table->string('pickup_location');
            $table->string('return_location');
            $table->string('driver_option')->index();
            $table->string('owner_driver_coverage')->nullable();
            $table->string('status')->default('pending')->index();
            $table->string('payment_status')->default('unpaid')->index();
            $table->decimal('price_per_day', 12, 2);
            $table->unsignedInteger('duration_days');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('delivery_fee', 12, 2)->default(0);
            $table->decimal('outside_manila_fee', 12, 2)->default(0);
            $table->decimal('owner_driver_fee', 12, 2)->default(0);
            $table->decimal('toll_fee', 12, 2)->default(0);
            $table->decimal('late_fee', 12, 2)->default(0);
            $table->decimal('add_ons_total', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('penalty_total', 12, 2)->default(0);
            $table->decimal('down_payment_amount', 12, 2)->default(0);
            $table->decimal('remaining_balance', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index(['vehicle_id', 'status']);
        });

        Schema::create('booking_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('old_status')->nullable();
            $table->string('new_status')->index();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('payment_method')->index();
            $table->string('payment_status')->default('pending')->index();
            $table->decimal('amount', 12, 2);
            $table->string('transaction_id')->nullable()->index();
            $table->timestamp('paid_at')->nullable();
            $table->string('proof_of_payment')->nullable();
            $table->timestamps();

            $table->index(['booking_id', 'payment_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('booking_status_logs');
        Schema::dropIfExists('bookings');
    }
};
