<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->restrictOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->index();
            $table->string('status')->default('draft')->index();
            $table->unsignedBigInteger('odometer');
            $table->unsignedTinyInteger('fuel_level');
            $table->text('comments')->nullable();
            $table->foreignId('based_on_inspection_id')->nullable()->constrained('vehicle_inspections')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('finalized_at')->nullable()->index();
            $table->timestamps();

            $table->index(['vehicle_id', 'type', 'status']);
            $table->index(['booking_id', 'type']);
        });

        Schema::create('vehicle_inspection_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspection_id')->constrained('vehicle_inspections')->cascadeOnDelete();
            $table->string('category')->index();
            $table->string('item_key');
            $table->string('item_label');
            $table->boolean('value');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['inspection_id', 'category', 'item_key'], 'inspection_item_unique');
        });

        Schema::create('vehicle_inspection_markers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspection_id')->constrained('vehicle_inspections')->cascadeOnDelete();
            $table->unsignedInteger('sequence_number');
            $table->string('panel')->index();
            $table->decimal('x_position', 6, 3);
            $table->decimal('y_position', 6, 3);
            $table->string('issue_type')->index();
            $table->text('description');
            $table->timestamps();

            $table->unique(['inspection_id', 'sequence_number'], 'inspection_marker_sequence_unique');
        });

        Schema::create('vehicle_inspection_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspection_id')->constrained('vehicle_inspections')->cascadeOnDelete();
            $table->string('signer_type')->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('signer_name');
            $table->string('signature_path');
            $table->timestamp('signed_at');
            $table->timestamps();

            $table->unique(['inspection_id', 'signer_type'], 'inspection_signer_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_inspection_signatures');
        Schema::dropIfExists('vehicle_inspection_markers');
        Schema::dropIfExists('vehicle_inspection_items');
        Schema::dropIfExists('vehicle_inspections');
    }
};
