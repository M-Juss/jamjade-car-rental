<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('late_return_pricing_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('small_vehicle_hourly_rate', 10, 2)->default(200);
            $table->decimal('large_vehicle_hourly_rate', 10, 2)->default(300);
            $table->timestamps();
        });
        Schema::table('booking_terms', function (Blueprint $table) {
            $table->json('late_return_policy')->nullable();
        });
        Schema::create('booking_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->timestamp('vehicle_received_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('expected_return_at')->nullable();
            $table->timestamp('late_charge_reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->decimal('approved_late_charge', 12, 2)->nullable();
            $table->string('adjustment_reason', 1000)->nullable();
            $table->foreignId('late_charge_id')->nullable()->constrained('booking_additional_charges')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_returns');
        Schema::table('booking_terms', fn (Blueprint $table) => $table->dropColumn('late_return_policy'));
        Schema::dropIfExists('late_return_pricing_settings');
    }
};
