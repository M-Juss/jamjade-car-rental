<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('geofences', function (Blueprint $table) {
            $table->string('geometry_type', 16)->default('circle')->after('name');
            $table->json('polygon_coordinates')->nullable()->after('radius_meters');
            $table->softDeletes();
        });
        Schema::table('booking_geofences', function (Blueprint $table) {
            $table->string('geometry_type', 16)->default('circle')->after('name_snapshot');
            $table->json('polygon_coordinates')->nullable()->after('radius_meters');
            $table->decimal('center_latitude', 10, 7)->nullable()->change();
            $table->decimal('center_longitude', 10, 7)->nullable()->change();
            $table->decimal('radius_meters', 10, 2)->nullable()->change();
        });
        Schema::table('geofences', function (Blueprint $table) {
            $table->decimal('center_latitude', 10, 7)->nullable()->change();
            $table->decimal('center_longitude', 10, 7)->nullable()->change();
            $table->decimal('radius_meters', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        if (DB::table('geofences')->where('geometry_type', 'polygon')->exists()
            || DB::table('booking_geofences')->where('geometry_type', 'polygon')->exists()) {
            throw new RuntimeException('Polygon geofences exist; export or migrate them before rolling back the shape migration.');
        }

        Schema::table('booking_geofences', function (Blueprint $table) {
            $table->dropColumn(['geometry_type', 'polygon_coordinates']);
            $table->decimal('center_latitude', 10, 7)->nullable(false)->change();
            $table->decimal('center_longitude', 10, 7)->nullable(false)->change();
            $table->decimal('radius_meters', 10, 2)->nullable(false)->change();
        });
        Schema::table('geofences', function (Blueprint $table) {
            $table->dropSoftDeletes();
            $table->dropColumn(['geometry_type', 'polygon_coordinates']);
            $table->decimal('center_latitude', 10, 7)->nullable(false)->change();
            $table->decimal('center_longitude', 10, 7)->nullable(false)->change();
            $table->decimal('radius_meters', 10, 2)->nullable(false)->change();
        });
    }
};
