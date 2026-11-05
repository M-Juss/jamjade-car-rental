<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rc_annotation_revisions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('recording_id')->constrained('rc_native_recordings')->restrictOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('revision');
            $table->string('state', 20);
            $table->char('manifest_sha256', 64);
            $table->char('fingerprint', 64);
            $table->mediumText('intervals');
            $table->timestamp('created_at', 3);
            $table->unique(['recording_id', 'revision']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rc_annotation_revisions');
    }
};
