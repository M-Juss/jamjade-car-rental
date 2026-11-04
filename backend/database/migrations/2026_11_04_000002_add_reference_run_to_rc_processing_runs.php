<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rc_processing_runs', function (Blueprint $table) {
            $table->foreignUuid('reference_run_id')->nullable()->constrained('rc_processing_runs')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('rc_processing_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reference_run_id');
        });
    }
};
