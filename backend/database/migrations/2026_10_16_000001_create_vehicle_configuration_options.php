<?php

use App\Support\VehicleInspectionDefinition;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_configuration_state', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
        });
        DB::table('vehicle_configuration_state')->insert(['id' => 1]);
        Schema::create('vehicle_configuration_options', function (Blueprint $table) {
            $table->id();
            $table->string('section', 20)->index();
            $table->string('key', 80);
            $table->string('name', 120);
            $table->string('normalized_name', 120);
            $table->json('previous_names')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['section', 'key']);
            $table->unique(['section', 'normalized_name']);
        });

        $catalogs = [
            'brand' => ['Toyota', 'Honda', 'Mitsubishi', 'Ford', 'Hyundai', 'Nissan', 'Kia', 'Mazda', 'Suzuki', 'Isuzu'],
            'transmission' => ['Automatic', 'Manual'],
            'fuel_type' => ['Gasoline', 'Diesel', 'Hybrid', 'Electric'],
            'feature' => ['Air Conditioning', 'Bluetooth', 'Apple CarPlay', 'Android Auto', 'GPS Navigation', 'Reverse Camera', 'Parking Sensors', 'USB Charging', 'Wireless Charging', 'Leather Seats', 'Cruise Control', 'ABS Brakes', 'Airbags', 'Push Start', 'Keyless Entry', 'Child Seat', 'Fuel Efficient', 'Pet Friendly', '4WD / AWD'],
        ];
        // Keep existing fleet values selectable without rewriting vehicle records.
        foreach (['brand', 'transmission', 'fuel_type'] as $section) {
            $catalogs[$section] = [...$catalogs[$section], ...DB::table('vehicles')->distinct()->pluck($section)->filter()->all()];
        }
        $catalogs['feature'] = [...$catalogs['feature'], ...DB::table('vehicle_features')->distinct()->pluck('feature_name')->filter()->all()];
        foreach ($catalogs as $section => $names) {
            $seen = [];
            foreach ($names as $name) {
                $name = trim($name);
                $normalized = Str::lower($name);
                if ($normalized === '' || isset($seen[$normalized]) || ($section === 'feature' && $normalized === 'dashcam')) {
                    continue;
                }
                $seen[$normalized] = true;
                $this->insert($section, 'option_'.Str::uuid(), $name);
            }
        }
        foreach (VehicleInspectionDefinition::defaults() as $category => $items) {
            foreach ($items as $key => $label) {
                $this->insert($category, $key, $label);
            }
        }
    }

    private function insert(string $section, string $key, string $name): void
    {
        DB::table('vehicle_configuration_options')->insert([
            'section' => $section, 'key' => $key, 'name' => $name,
            'normalized_name' => Str::lower($name), 'is_active' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_configuration_options');
        Schema::dropIfExists('vehicle_configuration_state');
    }
};
