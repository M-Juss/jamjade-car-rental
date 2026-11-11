<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drive_monitoring_sessions', function (Blueprint $table) {
            $table->uuid('research_session_id')->nullable();
            $table->uuid('mount_version_id')->nullable();
            $table->text('runtime_reference')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('drive_monitoring_sessions', fn (Blueprint $table) => $table->dropColumn(['research_session_id', 'mount_version_id', 'runtime_reference']));
    }
};
