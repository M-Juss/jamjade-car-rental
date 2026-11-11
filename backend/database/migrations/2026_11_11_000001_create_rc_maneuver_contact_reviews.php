<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rc_maneuver_contact_reviews', function (Blueprint $table) {
            $table->foreignUuid('recording_id')->primary()->constrained('rc_native_recordings')->cascadeOnDelete();
            $table->foreignUuid('observation_revision_id')->nullable()->constrained('rc_observation_revisions')->cascadeOnDelete();
            $table->unsignedInteger('first_contact_ms');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rc_maneuver_contact_reviews');
    }
};
