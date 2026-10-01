<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->string('country_code', 2)->nullable()->after('address');
            $table->string('region_code', 20)->nullable()->after('country_code');
            $table->string('province_code', 20)->nullable()->after('region_code');
            $table->string('city_municipality_code', 20)->nullable()->after('province_code');
            $table->string('barangay_code', 20)->nullable()->after('city_municipality_code');
            $table->string('address_line', 255)->nullable()->after('barangay_code');
            $table->string('postal_code', 20)->nullable()->after('address_line');
        });
    }

    public function down(): void
    {
        Schema::table('customer_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'country_code',
                'region_code',
                'province_code',
                'city_municipality_code',
                'barangay_code',
                'address_line',
                'postal_code',
            ]);
        });
    }
};
