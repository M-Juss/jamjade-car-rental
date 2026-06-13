<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('vehicles')
            ->where('status', 'inactive')
            ->update(['status' => 'unavailable']);
    }

    public function down(): void
    {
        DB::table('vehicles')
            ->where('status', 'unavailable')
            ->update(['status' => 'inactive']);
    }
};
