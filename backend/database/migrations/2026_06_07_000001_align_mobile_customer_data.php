<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->timestamp('emergency_contact_skipped_at')
                ->nullable()
                ->after('profile_completed_at');
            $table->boolean('passport_required')
                ->default(false)
                ->after('verification_status');
        });

        Schema::table('customer_documents', function (Blueprint $table) {
            $table->string('document_number')->nullable()->after('document_type');
            $table->date('expires_at')->nullable()->after('document_number');
            $table->string('front_file_path')->nullable()->after('file_path');
            $table->string('back_file_path')->nullable()->after('front_file_path');
            $table->timestamp('submitted_at')->nullable()->after('status');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->text('customer_signature')->nullable()->after('notes');
            $table->string('terms_version')->nullable()->after('customer_signature');
            $table->timestamp('terms_accepted_at')->nullable()->after('terms_version');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn([
                'customer_signature',
                'terms_version',
                'terms_accepted_at',
            ]);
        });

        Schema::table('customer_documents', function (Blueprint $table) {
            $table->dropColumn([
                'document_number',
                'expires_at',
                'front_file_path',
                'back_file_path',
                'submitted_at',
            ]);
        });

        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'emergency_contact_skipped_at',
                'passport_required',
            ]);
        });
    }
};
