<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function () {
            // Permission pivots cascade on deletion; retain roles and accounts.
            DB::table(config('permission.table_names.permissions'))
                ->where('name', 'view video auditing')
                ->delete();

            DB::table('vehicle_features')
                ->whereRaw('LOWER(TRIM(feature_name)) = ?', ['dashcam'])
                ->delete();
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        throw new LogicException('Retired feature assignments cannot be reconstructed. Restore a database backup to recover them.');
    }
};
