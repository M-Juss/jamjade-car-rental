<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_privacy_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_id')->constrained('customer_documents')->cascadeOnDelete();
            $table->string('notice_version', 64);
            $table->timestamp('accepted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_privacy_acceptances');
    }
};
