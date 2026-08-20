<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('assigned_driver_id')
                ->nullable()
                ->after('owner_driver_coverage')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('driver_assigned_at')
                ->nullable()
                ->after('assigned_driver_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_driver_id');
            $table->dropColumn('driver_assigned_at');
        });
    }
};
