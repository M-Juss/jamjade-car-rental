<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('activity_log_settings')->where('id', 1)->update([
            'activity_after_id' => 0,
            'failure_after_id' => 0,
        ]);
    }

    public function down(): void
    {
        // Restoring visibility does not delete history or re-hide it on rollback.
    }
};
