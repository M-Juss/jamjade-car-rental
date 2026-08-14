<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_inspections', function (Blueprint $table) {
            $table->string('condition_update_reason')->nullable()->after('comments');
            $table->text('condition_update_notes')->nullable()->after('condition_update_reason');
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_inspections', function (Blueprint $table) {
            $table->dropColumn(['condition_update_reason', 'condition_update_notes']);
        });
    }
};
