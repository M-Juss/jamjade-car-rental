<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rename metadata only. Existing private files and encrypted snapshots stay intact.
        Schema::table('booking_payment_documents', function (Blueprint $table) {
            $table->renameColumn('invoice_path', 'rental_information_path');
            $table->renameColumn('invoice_filename', 'rental_information_filename');
        });
        Schema::table('booking_terms', fn (Blueprint $table) => $table->renameColumn('invoice_context', 'rental_context'));
    }

    public function down(): void
    {
        Schema::table('booking_terms', fn (Blueprint $table) => $table->renameColumn('rental_context', 'invoice_context'));
        Schema::table('booking_payment_documents', function (Blueprint $table) {
            $table->renameColumn('rental_information_path', 'invoice_path');
            $table->renameColumn('rental_information_filename', 'invoice_filename');
        });
    }
};
