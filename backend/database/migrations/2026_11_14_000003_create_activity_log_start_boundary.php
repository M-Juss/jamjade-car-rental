<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_log_settings', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->unsignedBigInteger('activity_after_id');
            $table->unsignedBigInteger('failure_after_id');
            $table->timestamp('started_at');
        });
        DB::table('activity_log_settings')->insert([
            'id' => 1,
            'activity_after_id' => DB::table(config('activitylog.table_name', 'activity_log'))->max('id') ?? 0,
            'failure_after_id' => DB::table('operational_errors')->max('id') ?? 0,
            'started_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_log_settings');
    }
};
