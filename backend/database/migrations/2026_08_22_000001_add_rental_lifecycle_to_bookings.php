<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('calibration_status')->default('locked')->index()->after('payment_status');
            $table->foreignId('calibrated_by')->nullable()->after('calibration_status')->constrained('users')->nullOnDelete();
            $table->timestamp('calibrated_at')->nullable()->after('calibrated_by');
            $table->timestamp('return_charges_finalized_at')->nullable()->after('completed_at');
            $table->foreignId('return_charges_finalized_by')->nullable()->after('return_charges_finalized_at')->constrained('users')->nullOnDelete();
            $table->timestamp('returned_at')->nullable()->after('return_charges_finalized_by');
            $table->foreignId('completed_by')->nullable()->after('completed_at')->constrained('users')->nullOnDelete();
        });

        Schema::create('booking_additional_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('type')->index();
            $table->string('description', 1000);
            $table->decimal('amount', 12, 2);
            $table->string('responsibility')->index();
            $table->foreignId('responsible_user_id')->constrained('users')->restrictOnDelete();
            $table->string('payment_status')->default('unpaid')->index();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['responsible_user_id', 'responsibility', 'payment_status'], 'charge_responsible_status_index');
        });

        Schema::create('additional_charge_paypal_checkout', function (Blueprint $table) {
            $table->foreignId('booking_additional_charge_id');
            $table->foreign('booking_additional_charge_id', 'charge_checkout_charge_fk')
                ->references('id')
                ->on('booking_additional_charges')
                ->cascadeOnDelete();
            $table->foreignId('paypal_checkout_id');
            $table->foreign('paypal_checkout_id', 'charge_checkout_paypal_fk')
                ->references('id')
                ->on('paypal_checkouts')
                ->cascadeOnDelete();
            $table->primary(['booking_additional_charge_id', 'paypal_checkout_id'], 'charge_checkout_primary');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('additional_charge_paypal_checkout');
        Schema::dropIfExists('booking_additional_charges');

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('completed_by');
            $table->dropColumn('returned_at');
            $table->dropConstrainedForeignId('return_charges_finalized_by');
            $table->dropColumn('return_charges_finalized_at');
            $table->dropConstrainedForeignId('calibrated_by');
            $table->dropColumn(['calibration_status', 'calibrated_at']);
        });
    }
};
