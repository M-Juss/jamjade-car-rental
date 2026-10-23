<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('telematics_trips', function (Blueprint $table) {
            $table->text('latest_location')->nullable();
            $table->timestamp('location_consent_at')->nullable();
            $table->unsignedSmallInteger('location_consent_version')->nullable();
            $table->char('location_session_hash', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('telematics_trips', fn (Blueprint $table) => $table->dropColumn([
            'latest_location', 'location_consent_at', 'location_consent_version', 'location_session_hash',
        ]));
    }
};
