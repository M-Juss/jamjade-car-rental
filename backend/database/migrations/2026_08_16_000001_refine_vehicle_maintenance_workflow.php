<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_maintenance_plans', function (Blueprint $table) {
            $table->unsignedBigInteger('baseline_odometer')->nullable()->after('interval_days');
            $table->date('baseline_date')->nullable()->after('baseline_odometer');
        });

        DB::table('vehicle_maintenance_plans')->orderBy('id')->each(function (object $plan): void {
            DB::table('vehicle_maintenance_plans')->where('id', $plan->id)->update([
                'baseline_odometer' => $plan->next_due_odometer !== null && $plan->interval_km !== null
                    ? max((int) $plan->next_due_odometer - (int) $plan->interval_km, 0)
                    : null,
                'baseline_date' => $plan->next_due_date !== null && $plan->interval_days !== null
                    ? Carbon::parse($plan->next_due_date)->subDays((int) $plan->interval_days)->toDateString()
                    : null,
            ]);
        });

        Schema::table('vehicle_maintenance_records', function (Blueprint $table) {
            $table->text('cancellation_reason')->nullable()->after('notes');
            $table->boolean('condition_verification_required')->default(false)->after('cancellation_reason');
            $table->timestamp('completion_details_recorded_at')->nullable()->after('condition_verification_required');
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_maintenance_records', function (Blueprint $table) {
            $table->dropColumn([
                'cancellation_reason',
                'condition_verification_required',
                'completion_details_recorded_at',
            ]);
        });

        Schema::table('vehicle_maintenance_plans', function (Blueprint $table) {
            $table->dropColumn(['baseline_odometer', 'baseline_date']);
        });
    }
};
