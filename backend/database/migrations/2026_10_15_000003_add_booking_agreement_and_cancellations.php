<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_terms', function (Blueprint $table) {
            $table->longText('invoice_context')->nullable();
        });
        Schema::create('booking_cancellations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained()->restrictOnDelete();
            $table->string('kind');
            $table->text('reason');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->decimal('refund_amount', 12, 2)->nullable();
            $table->text('refund_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('refunded_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_cancellations');
        Schema::table('booking_terms', fn (Blueprint $table) => $table->dropColumn('invoice_context'));
    }
};
