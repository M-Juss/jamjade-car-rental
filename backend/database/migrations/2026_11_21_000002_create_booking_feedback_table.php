<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('users')->restrictOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamp('publication_consented_at')->nullable();
            $table->string('publication_consent_version', 40)->nullable();
            $table->boolean('is_featured')->default(false);
            $table->foreignId('featured_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('featured_at')->nullable();
            $table->timestamps();
            $table->index(['customer_id', 'created_at']);
            $table->index(['is_featured', 'featured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_feedback');
    }
};
