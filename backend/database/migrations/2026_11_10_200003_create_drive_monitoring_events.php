<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drive_monitoring_sessions', fn (Blueprint $t) => $t->unsignedInteger('last_window_end_ms')->default(0));
        Schema::create('drive_monitoring_events', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('session_id')->constrained('drive_monitoring_sessions')->restrictOnDelete();
            $t->string('target', 32);
            $t->string('status', 24);
            $t->unsignedInteger('start_ms');
            $t->unsignedInteger('end_ms');
            $t->unsignedInteger('last_ms');
            $t->unsignedInteger('emitted_ms');
            $t->unsignedInteger('peak_ms')->nullable();
            $t->double('vote');
            $t->text('evidence')->nullable();
            $t->timestamps();
            $t->index(['session_id', 'target', 'last_ms']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drive_monitoring_events');
        Schema::table('drive_monitoring_sessions', fn (Blueprint $t) => $t->dropColumn('last_window_end_ms'));
    }
};
