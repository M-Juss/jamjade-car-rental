<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_assignments', function (Blueprint $table) {
            $table->timestamp('on_way_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
        });
        Schema::create('booking_driver_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('users')->restrictOnDelete();
            $table->string('kind', 30);
            $table->text('context');
            $table->string('delivery_status', 20)->default('pending');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('retry_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->index(['delivery_status', 'retry_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_driver_updates');
        Schema::table('booking_assignments', fn (Blueprint $table) => $table->dropColumn(['on_way_at', 'arrived_at']));
    }
};
