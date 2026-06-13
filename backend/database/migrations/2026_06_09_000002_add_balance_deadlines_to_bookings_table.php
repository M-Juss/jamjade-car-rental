<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('balance_due_at')->nullable()->after('remaining_balance')->index();
            $table->timestamp('balance_reminder_sent_at')->nullable()->after('balance_due_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['balance_due_at', 'balance_reminder_sent_at']);
        });
    }
};
