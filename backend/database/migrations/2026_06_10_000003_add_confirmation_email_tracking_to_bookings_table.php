<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('confirmation_email_sent_at')
                ->nullable()
                ->after('balance_reminder_sent_at')
                ->index();
            $table->string('confirmation_email_status')
                ->nullable()
                ->after('confirmation_email_sent_at')
                ->index();
            $table->text('confirmation_email_error')
                ->nullable()
                ->after('confirmation_email_status');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['confirmation_email_sent_at']);
            $table->dropIndex(['confirmation_email_status']);
            $table->dropColumn([
                'confirmation_email_sent_at',
                'confirmation_email_status',
                'confirmation_email_error',
            ]);
        });
    }
};
