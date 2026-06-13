<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->index();
            $table->string('brand')->index();
            $table->string('model')->index();
            $table->decimal('price_per_day', 12, 2);
            $table->unsignedTinyInteger('seats');
            $table->string('transmission')->index();
            $table->string('fuel_type')->index();
            $table->string('color')->nullable();
            $table->string('status')->default('available')->index();
            $table->boolean('is_most_booked')->default(false)->index();
            $table->text('description')->nullable();
            $table->timestamp('last_service_at')->nullable();
            $table->timestamp('next_service_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('vehicle_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('image_path');
            $table->boolean('is_primary')->default(false)->index();
            $table->unsignedInteger('sort_order')->default(0)->index();
            $table->timestamps();
        });

        Schema::create('vehicle_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->string('feature_name');
            $table->timestamps();

            $table->unique(['vehicle_id', 'feature_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_features');
        Schema::dropIfExists('vehicle_images');
        Schema::dropIfExists('vehicles');
    }
};
