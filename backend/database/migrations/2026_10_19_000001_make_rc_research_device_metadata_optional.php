<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rc_research_sessions', function (Blueprint $table) {
            foreach (['phone_model', 'rc_model', 'mount_method'] as $column) {
                $table->string($column, 100)->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        DB::table('rc_research_sessions')->whereNull('phone_model')->update(['phone_model' => 'Not recorded']);
        DB::table('rc_research_sessions')->whereNull('rc_model')->update(['rc_model' => 'Not recorded']);
        DB::table('rc_research_sessions')->whereNull('mount_method')->update(['mount_method' => 'Not recorded']);

        Schema::table('rc_research_sessions', function (Blueprint $table) {
            foreach (['phone_model', 'rc_model', 'mount_method'] as $column) {
                $table->string($column, 100)->nullable(false)->change();
            }
        });
    }
};
