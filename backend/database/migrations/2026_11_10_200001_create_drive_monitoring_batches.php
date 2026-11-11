<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drive_monitoring_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('session_id')->constrained('drive_monitoring_sessions')->restrictOnDelete();
            $table->uuid('client_batch_id');
            $table->char('content_sha256', 64);
            $table->text('predictions');
            $table->timestamps();
            $table->unique(['session_id', 'client_batch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drive_monitoring_batches');
    }
};
