<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->uuid('capture_attempt_token')->nullable();
            $table->timestamp('capture_started_at')->nullable();
            $table->timestamp('capture_first_started_at')->nullable();
        });
        Schema::create('booking_terms_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('delivery_quote_id')->nullable()->constrained('delivery_quotes')->nullOnDelete();
            $table->text('customer_signature')->nullable();
            $table->string('terms_version', 40)->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->json('late_return_policy')->nullable();
            $table->longText('rental_context')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (DB::table('booking_terms_revisions')->exists()) {
            throw new RuntimeException('Export and preserve booking agreement revisions before rolling back.');
        }
        if (DB::table('payments')->where('provider', 'paypal')->whereIn('status', ['approved', 'capturing'])->exists()) {
            throw new RuntimeException('Reconcile unresolved PayPal payments before rolling back.');
        }
        Schema::dropIfExists('booking_terms_revisions');
        Schema::table('payments', fn (Blueprint $table) => $table->dropColumn(['capture_attempt_token', 'capture_started_at', 'capture_first_started_at']));
    }
};
