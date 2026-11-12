<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drive_monitoring_sessions', function (Blueprint $table) {
            $table->boolean('sync_interrupted')->default(false);
        });
        Schema::create('rental_driving_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('score')->nullable();
            $table->unsignedInteger('confirmed_events');
            $table->json('snapshot');
            $table->timestamp('finalized_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rental_driving_reports');
        Schema::table('drive_monitoring_sessions', function (Blueprint $table) {
            $table->dropColumn('sync_interrupted');
        });
    }
};
