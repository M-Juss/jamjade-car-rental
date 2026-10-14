<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_pricing_settings', function (Blueprint $t) {
            $t->id();
            $t->decimal('minimum_fee', 12, 2)->default(150);
            $t->decimal('included_km', 10, 3)->default(1);
            $t->decimal('per_km_rate', 12, 2)->default(25);
            $t->string('garage_address')->default('Jamjade Garage');
            $t->decimal('garage_latitude', 10, 7)->nullable();
            $t->decimal('garage_longitude', 10, 7)->nullable();
            $t->timestamps();
        });
        Schema::create('delivery_quotes', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('vehicle_id')->constrained();
            $t->dateTime('rental_start_at');
            $t->dateTime('rental_end_at');
            $t->string('owner_driver_coverage');
            $t->string('destination_address');
            $t->string('destination_place_id')->nullable();
            $t->text('destination_point')->nullable();
            $t->dateTime('point_expires_at');
            $t->json('pricing_snapshot');
            $t->decimal('price_per_day', 12, 2);
            $t->unsignedInteger('duration_days');
            $t->decimal('subtotal', 12, 2);
            $t->decimal('owner_driver_fee', 12, 2);
            $t->decimal('delivery_fee', 12, 2);
            $t->decimal('delivery_toll_fee', 12, 2)->nullable();
            $t->string('route_fingerprint', 64);
            $t->string('route_label');
            $t->string('toll_status');
            $t->string('status')->index();
            $t->dateTime('expires_at')->nullable();
            $t->dateTime('review_deadline')->nullable();
            $t->foreignId('reviewed_by')->nullable()->constrained('users');
            $t->dateTime('reviewed_at')->nullable();
            $t->string('review_note', 1000)->nullable();
            $t->foreignId('booking_id')->nullable()->unique()->constrained();
            $t->timestamps();
            $t->index(['user_id', 'status']);
        });
        Schema::table('bookings', function (Blueprint $t) {
            $t->decimal('delivery_toll_fee', 12, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('bookings', fn (Blueprint $t) => $t->dropColumn('delivery_toll_fee'));
        Schema::dropIfExists('delivery_quotes');
        Schema::dropIfExists('delivery_pricing_settings');
    }
};
