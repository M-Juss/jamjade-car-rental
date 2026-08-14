<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_maintenance_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->string('category')->index();
            $table->text('description')->nullable();
            $table->string('trigger_type')->index();
            $table->unsignedInteger('interval_km')->nullable();
            $table->unsignedInteger('interval_days')->nullable();
            $table->timestamp('last_completed_at')->nullable();
            $table->unsignedBigInteger('last_completed_odometer')->nullable();
            $table->date('next_due_date')->nullable()->index();
            $table->unsignedBigInteger('next_due_odometer')->nullable()->index();
            $table->boolean('is_active')->default(true)->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['vehicle_id', 'is_active']);
        });

        Schema::create('vehicle_maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->foreignId('maintenance_plan_id')->nullable()->constrained('vehicle_maintenance_plans')->nullOnDelete();
            $table->string('category')->index();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status')->index();
            $table->timestamp('scheduled_start')->index();
            $table->timestamp('scheduled_end')->index();
            $table->timestamp('actual_started_at')->nullable();
            $table->timestamp('completed_at')->nullable()->index();
            $table->timestamp('cancelled_at')->nullable();
            $table->unsignedBigInteger('odometer_at_start')->nullable();
            $table->unsignedBigInteger('odometer_at_completion')->nullable();
            $table->string('service_provider')->nullable();
            $table->string('technician')->nullable();
            $table->decimal('labor_cost', 12, 2)->nullable();
            $table->decimal('parts_cost', 12, 2)->nullable();
            $table->decimal('other_cost', 12, 2)->nullable();
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->text('work_performed')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('resulting_condition_inspection_id')->nullable();
            $table->foreign('resulting_condition_inspection_id', 'maintenance_resulting_condition_fk')
                ->references('id')->on('vehicle_inspections')->nullOnDelete();
            $table->timestamps();
            $table->index(['vehicle_id', 'status', 'scheduled_start'], 'maintenance_vehicle_status_start');
            $table->index(['vehicle_id', 'scheduled_start', 'scheduled_end'], 'maintenance_vehicle_schedule');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_maintenance_records');
        Schema::dropIfExists('vehicle_maintenance_plans');
    }
};
