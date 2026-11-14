<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operational_errors', function (Blueprint $table) {
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name')->nullable();
            $table->string('action', 16)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('operational_errors', function (Blueprint $table) {
            $table->dropConstrainedForeignId('actor_user_id');
            $table->dropColumn(['actor_name', 'action']);
        });
    }
};
