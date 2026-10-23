<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_payment_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->restrictOnDelete();
            $table->foreignId('payment_id')->unique()->constrained()->restrictOnDelete();
            $table->timestamp('issued_at');
            $table->longText('context');
            $table->string('invoice_path');
            $table->string('receipt_path');
            $table->string('invoice_filename');
            $table->string('receipt_filename');
            $table->string('delivery_status')->default('pending')->index();
            $table->uuid('delivery_token')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_payment_documents');
    }
};
