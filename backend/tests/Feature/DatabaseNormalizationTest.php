<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('uses the normalized payment, document, and telematics tables', function () {
    expect(Schema::hasTable('payments'))->toBeTrue()
        ->and(Schema::hasColumns('payments', [
            'provider',
            'purpose',
            'status',
            'provider_order_id',
            'provider_transaction_id',
        ]))->toBeTrue()
        ->and(Schema::hasTable('payment_charge_allocations'))->toBeTrue()
        ->and(Schema::hasTable('paypal_checkouts'))->toBeFalse()
        ->and(Schema::hasTable('additional_charge_paypal_checkout'))->toBeFalse()
        ->and(Schema::hasTable('customer_document_files'))->toBeTrue()
        ->and(Schema::hasColumns('telematics_events', [
            'trip_id',
            'geofence_status',
            'distance_from_allowed_area',
            'current_area',
        ]))->toBeTrue()
        ->and(Schema::hasTable('geofence_logs'))->toBeFalse();
});

it('removes duplicated and derived columns from core tables', function () {
    expect(Schema::getColumnListing('bookings'))->not->toContain(
        'driver_option',
        'delivery_time',
        'outside_manila_fee',
        'toll_fee',
        'late_fee',
        'penalty_total',
        'down_payment_amount',
    )->and(Schema::getColumnListing('booking_additional_charges'))->not->toContain(
        'payment_status',
        'paid_at',
    )->and(Schema::getColumnListing('vehicles'))->not->toContain(
        'is_most_booked',
        'last_service_at',
        'next_service_at',
    )->and(Schema::hasColumn('vehicles', 'is_featured'))->toBeTrue()
        ->and(Schema::getColumnListing('customer_documents'))->not->toContain(
            'file_path',
            'front_file_path',
            'back_file_path',
        )
        ->and(Schema::getColumnListing('vehicle_maintenance_plans'))->not->toContain(
            'last_completed_at',
            'last_completed_odometer',
        )
        ->and(Schema::hasColumn('vehicle_maintenance_records', 'total_cost'))->toBeFalse();
});

it('stores each emergency contact as a one-to-one user record', function () {
    $indexes = Schema::getIndexes('emergency_contacts');

    expect(collect($indexes)->contains(
        fn (array $index) => $index['unique'] && $index['columns'] === ['user_id']
    ))->toBeTrue();
});

it('keeps booking concerns in focused child tables', function () {
    expect(Schema::hasTable('booking_events'))->toBeTrue()
        ->and(Schema::hasTable('booking_assignments'))->toBeTrue()
        ->and(Schema::hasTable('booking_terms'))->toBeTrue()
        ->and(Schema::hasTable('booking_confirmation_emails'))->toBeTrue()
        ->and(Schema::hasTable('booking_status_logs'))->toBeFalse();

    expect(Schema::getColumnListing('bookings'))->not->toContain(
        'assigned_driver_id',
        'driver_assigned_at',
        'calibration_status',
        'calibrated_by',
        'calibrated_at',
        'customer_signature',
        'terms_version',
        'terms_accepted_at',
        'confirmation_email_sent_at',
        'confirmation_email_status',
        'confirmation_email_error',
        'confirmed_at',
        'rejected_at',
        'started_at',
        'completed_at',
        'completed_by',
        'return_charges_finalized_at',
        'return_charges_finalized_by',
        'returned_at',
        'cancelled_at',
    );
});
