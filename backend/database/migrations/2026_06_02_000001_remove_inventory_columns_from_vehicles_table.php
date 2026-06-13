<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $columns = collect(['year', 'plate_number', 'mileage', 'type', 'location'])
            ->filter(fn (string $column) => Schema::hasColumn('vehicles', $column))
            ->all();

        if ($columns === []) {
            return;
        }

        Schema::table('vehicles', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (! Schema::hasColumn('vehicles', 'year')) {
                $table->unsignedSmallInteger('year')->nullable()->index()->after('model');
            }

            if (! Schema::hasColumn('vehicles', 'mileage')) {
                $table->unsignedInteger('mileage')->default(0)->after('fuel_type');
            }

            if (! Schema::hasColumn('vehicles', 'type')) {
                $table->string('type')->nullable()->index()->after('color');
            }

            if (! Schema::hasColumn('vehicles', 'location')) {
                $table->string('location')->nullable()->after('color');
            }
        });
    }
};
