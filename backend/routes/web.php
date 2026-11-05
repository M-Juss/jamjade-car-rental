<?php

use App\Http\Controllers\Web\Admin\AuthController;
use App\Http\Controllers\Web\Admin\BookingController;
use App\Http\Controllers\Web\Admin\BookingGeofenceController;
use App\Http\Controllers\Web\Admin\CustomerController;
use App\Http\Controllers\Web\Admin\DashboardController;
use App\Http\Controllers\Web\Admin\DeliveryPricingController;
use App\Http\Controllers\Web\Admin\DocumentVerificationController;
use App\Http\Controllers\Web\Admin\FleetBroadcastAuthController;
use App\Http\Controllers\Web\Admin\FleetTrackerController;
use App\Http\Controllers\Web\Admin\GeofenceController;
use App\Http\Controllers\Web\Admin\LateReturnPricingController;
use App\Http\Controllers\Web\Admin\MaintenanceController;
use App\Http\Controllers\Web\Admin\ManagementNavigationController;
use App\Http\Controllers\Web\Admin\PaymentController;
use App\Http\Controllers\Web\Admin\PersonnelController;
use App\Http\Controllers\Web\Admin\RcAnnotationController;
use App\Http\Controllers\Web\Admin\RcNativeRecordingController;
use App\Http\Controllers\Web\Admin\RcProcessingRunController;
use App\Http\Controllers\Web\Admin\RcResearchController;
use App\Http\Controllers\Web\Admin\ReportController;
use App\Http\Controllers\Web\Admin\SelfDriveVerificationController;
use App\Http\Controllers\Web\Admin\VehicleConfigurationController;
use App\Http\Controllers\Web\Admin\VehicleController;
use App\Http\Controllers\Web\PayPalRedirectController;
use Illuminate\Support\Facades\Route;

Route::get('/paypal/return/{target?}', [PayPalRedirectController::class, 'return'])
    ->name('paypal.return');
Route::get('/paypal/cancel/{target?}', [PayPalRedirectController::class, 'cancel'])
    ->name('paypal.cancel');

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('admin')->name('admin.')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])
        ->name('login');

    Route::middleware(['auth', 'active_admin'])->group(function () {
        Route::get('/me', [AuthController::class, 'me'])->name('me');
        Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
        Route::get('/navigation-counts', ManagementNavigationController::class)->name('navigation-counts');
        Route::middleware(['role:admin', 'throttle:60,1'])->prefix('rc-research')->name('rc-research.')->group(function () {
            Route::get('/native-recordings/{recording}/annotations', [RcAnnotationController::class, 'show'])->whereUuid('recording')->name('annotations.show');
            Route::post('/native-recordings/{recording}/annotations', [RcAnnotationController::class, 'store'])->middleware('throttle:10,1')->whereUuid('recording')->name('annotations.store');
            Route::get('/native-recordings/{recording}/annotations/history', [RcAnnotationController::class, 'history'])->whereUuid('recording')->name('annotations.history');
            Route::get('/native-recordings/{recording}/annotations/{revision}', [RcAnnotationController::class, 'revision'])->whereUuid(['recording', 'revision'])->name('annotations.revision');
            Route::get('/native-recordings/{recording}/reference-runs', [RcProcessingRunController::class, 'references'])->whereUuid('recording')->name('processing.references');
            Route::get('/native-recordings/{recording}/processing-runs', [RcProcessingRunController::class, 'index'])->whereUuid('recording')->name('processing.index');
            Route::post('/native-recordings/{recording}/processing-runs', [RcProcessingRunController::class, 'store'])->middleware('throttle:10,1')->whereUuid('recording')->name('processing.store');
            Route::get('/native-recordings/{recording}/processing-runs/{run}', [RcProcessingRunController::class, 'show'])->whereUuid(['recording', 'run'])->name('processing.show');
            Route::get('/native-recordings', [RcNativeRecordingController::class, 'index'])->name('native.index');
            Route::get('/native-recordings/{recording}', [RcNativeRecordingController::class, 'show'])->whereUuid('recording')->name('native.show');
            Route::get('/native-recordings/{recording}/window', [RcNativeRecordingController::class, 'window'])->whereUuid('recording')->name('native.window');
            Route::get('/trials', [RcResearchController::class, 'index'])->name('trials.index');
            Route::get('/trials/{trial}', [RcResearchController::class, 'show'])->whereUuid('trial')->name('trials.show');
        });
        Route::post('/broadcasting/auth', FleetBroadcastAuthController::class)
            ->middleware('permission:view fleet tracker')->name('fleet.broadcasting.auth');

        Route::get('/dashboard', DashboardController::class)
            ->middleware('permission:view dashboard')
            ->name('dashboard');

        Route::get('/vehicle-options', [VehicleConfigurationController::class, 'options'])
            ->middleware('role_or_permission:admin|manage vehicles|manage bookings|manage maintenance');
        Route::middleware('role:admin')->prefix('vehicle-configuration')->group(function () {
            Route::get('/', [VehicleConfigurationController::class, 'index']);
            Route::post('/', [VehicleConfigurationController::class, 'store']);
            Route::put('/{option}', [VehicleConfigurationController::class, 'update']);
            Route::delete('/{option}', [VehicleConfigurationController::class, 'destroy']);
        });

        Route::middleware('permission:manage vehicles')->group(function () {
            Route::get('/vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
            Route::post('/vehicles', [VehicleController::class, 'store'])->name('vehicles.store');
            Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show'])->name('vehicles.show');
            Route::get('/vehicles/{vehicle}/current-condition', [VehicleController::class, 'currentCondition'])->name('vehicles.current-condition');
            Route::get('/vehicles/{vehicle}/inspections', [VehicleController::class, 'inspectionHistory'])->name('vehicles.inspections.index');
            Route::get('/vehicles/{vehicle}/inspections/{inspection}', [VehicleController::class, 'inspection'])->name('vehicles.inspections.show');
            Route::post('/vehicles/{vehicle}/initial-condition', [VehicleController::class, 'storeInitialCondition'])->name('vehicles.initial-condition.store');
            Route::post('/vehicles/{vehicle}/condition-updates', [VehicleController::class, 'storeConditionUpdate'])->name('vehicles.condition-updates.store');
            Route::put('/vehicles/{vehicle}', [VehicleController::class, 'update'])->name('vehicles.update');
            Route::delete('/vehicles/{vehicle}', [VehicleController::class, 'destroy'])->name('vehicles.destroy');
        });

        Route::middleware('role_or_permission:admin|manage geofences')->get('/geofences', [GeofenceController::class, 'index'])->name('geofences.index');
        Route::middleware('role:admin')->group(function () {
            Route::get('/late-return-pricing', [LateReturnPricingController::class, 'show']);
            Route::put('/late-return-pricing', [LateReturnPricingController::class, 'update']);
            Route::get('/delivery-pricing', [DeliveryPricingController::class, 'show']);
            Route::put('/delivery-pricing', [DeliveryPricingController::class, 'update']);
            Route::post('/bookings/{booking}/monitoring-zones', [BookingGeofenceController::class, 'store']);
            Route::put('/bookings/{booking}/monitoring-zones/{zone}', [BookingGeofenceController::class, 'update']);
            Route::delete('/bookings/{booking}/monitoring-zones/{zone}', [BookingGeofenceController::class, 'destroy']);
            Route::post('/geofences', [GeofenceController::class, 'store'])->name('geofences.store');
            Route::put('/geofences/{geofence}', [GeofenceController::class, 'update'])->name('geofences.update');
            Route::post('/geofences/{geofence}/activate', [GeofenceController::class, 'activate'])->name('geofences.activate');
            Route::post('/geofences/{geofence}/deactivate', [GeofenceController::class, 'deactivate'])->name('geofences.deactivate');
            Route::delete('/geofences/{geofence}', [GeofenceController::class, 'destroy'])->name('geofences.destroy');
        });

        Route::middleware('permission:manage bookings')->group(function () {
            Route::get('/bookings', [BookingController::class, 'index'])->name('bookings.index');
            Route::get('/bookings/drivers', [BookingController::class, 'drivers'])->name('bookings.drivers');
            Route::get('/bookings/{booking}', [BookingController::class, 'show'])->name('bookings.show');
            Route::post('/bookings/{booking}/confirm', [BookingController::class, 'confirm'])->name('bookings.confirm');
            Route::post('/bookings/{booking}/reject', [BookingController::class, 'reject'])->name('bookings.reject');
            Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel'])->name('bookings.cancel');
            Route::post('/bookings/{booking}/no-show', [BookingController::class, 'noShow']);
            Route::post('/bookings/{booking}/refund-review', [BookingController::class, 'reviewRefund'])->middleware('role:admin');
            Route::post('/bookings/{booking}/record-refund', [BookingController::class, 'recordRefund'])->middleware('role:admin');
            Route::post('/bookings/{booking}/start', [BookingController::class, 'start'])->name('bookings.start');
            Route::post('/bookings/{booking}/telematics-setup/start', [BookingController::class, 'startTelematicsHandover'])->name('bookings.telematics-setup.start');
            Route::post('/bookings/{booking}/receive-vehicle', [BookingController::class, 'receiveVehicle']);
            Route::post('/bookings/{booking}/return-follow-up', [BookingController::class, 'returnFollowUp']);
            Route::post('/bookings/{booking}/review-late-charge', [BookingController::class, 'reviewLateCharge']);
            Route::post('/bookings/{booking}/complete', [BookingController::class, 'complete'])->name('bookings.complete');
            Route::get('/bookings/{booking}/readiness', [BookingController::class, 'readiness'])->name('bookings.readiness');
            Route::post('/bookings/{booking}/outgoing-inspection', [BookingController::class, 'outgoing'])->name('bookings.outgoing-inspection');
            Route::post('/bookings/{booking}/outgoing-inspection-handover', [BookingController::class, 'outgoingAndHandover'])->name('bookings.outgoing-inspection-handover');
            Route::post('/bookings/{booking}/incoming-inspection', [BookingController::class, 'incoming'])->name('bookings.incoming-inspection');
            Route::post('/bookings/{booking}/additional-charges', [BookingController::class, 'charges'])->name('bookings.additional-charges');
            Route::put('/bookings/{booking}/additional-charges/{charge}', [BookingController::class, 'updateCharge'])->whereNumber('charge');
            Route::delete('/bookings/{booking}/additional-charges/{charge}', [BookingController::class, 'deleteCharge'])->whereNumber('charge');
            Route::post('/bookings/{booking}/finalize-return', [BookingController::class, 'finalizeReturn'])->name('bookings.finalize-return');
            Route::post('/bookings/{booking}/assign-driver', [BookingController::class, 'assignDriver'])->name('bookings.assign-driver');
            Route::post('/bookings/{booking}/resend-confirmation-email', [BookingController::class, 'resendConfirmationEmail'])
                ->middleware('role:admin')
                ->name('bookings.resend-confirmation-email');
        });

        Route::middleware('permission:manage maintenance')->group(function () {
            Route::get('/maintenance', [MaintenanceController::class, 'index'])->name('maintenance.index');
            Route::get('/maintenance/summary', [MaintenanceController::class, 'summary'])->name('maintenance.summary');
            Route::get('/maintenance/vehicles', [MaintenanceController::class, 'vehicles'])->name('maintenance.vehicles');
            Route::post('/maintenance', [MaintenanceController::class, 'schedule'])->name('maintenance.store');
            Route::get('/maintenance/{maintenanceRecord}', [MaintenanceController::class, 'show'])->name('maintenance.show');
            Route::post('/maintenance/{maintenanceRecord}/start', [MaintenanceController::class, 'start'])->name('maintenance.start');
            Route::put('/maintenance/{maintenanceRecord}/reschedule', [MaintenanceController::class, 'reschedule'])->name('maintenance.reschedule');
            Route::post('/maintenance/{maintenanceRecord}/complete', [MaintenanceController::class, 'complete'])->name('maintenance.complete');
            Route::post('/maintenance/{maintenanceRecord}/cancel', [MaintenanceController::class, 'cancel'])->name('maintenance.cancel');
            Route::get('/maintenance/{maintenanceRecord}/completion-condition', [MaintenanceController::class, 'conditionForCompletion'])->name('maintenance.completion-condition.show');
            Route::post('/maintenance/{maintenanceRecord}/completion-condition', [MaintenanceController::class, 'storeConditionForCompletion'])->name('maintenance.completion-condition.store');
            Route::post('/maintenance/{maintenanceRecord}/condition', [MaintenanceController::class, 'linkCondition'])->name('maintenance.condition');
            Route::get('/maintenance-plans', [MaintenanceController::class, 'plans'])->name('maintenance-plans.index');
            Route::get('/vehicles/{vehicle}/maintenance-plans', [MaintenanceController::class, 'vehiclePlans'])->name('vehicles.maintenance-plans.index');
            Route::post('/maintenance-plans', [MaintenanceController::class, 'storePlan'])->name('maintenance-plans.store');
            Route::put('/maintenance-plans/{plan}', [MaintenanceController::class, 'updatePlan'])->name('maintenance-plans.update');
            Route::delete('/maintenance-plans/{plan}', [MaintenanceController::class, 'deletePlan'])->name('maintenance-plans.destroy');
        });

        Route::middleware('permission:manage customers')->group(function () {
            Route::get('/customers', [CustomerController::class, 'index'])->name('customers.index');
            Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
        });

        Route::middleware('permission:view reports')->group(function () {
            Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
            Route::get('/reports/pdf', [ReportController::class, 'pdf'])->name('reports.pdf');
            Route::get('/reports/excel', [ReportController::class, 'excel'])->name('reports.excel');
        });

        Route::get('/fleet-tracker', [FleetTrackerController::class, 'index'])
            ->middleware('permission:view fleet tracker')
            ->name('fleet-tracker.index');

        Route::get('/payments', [PaymentController::class, 'index'])
            ->middleware('permission:manage payments')
            ->name('payments.index');

        Route::middleware('permission:review documents')->group(function () {
            Route::get('/self-drive-verification/customers', [SelfDriveVerificationController::class, 'index'])->name('self-drive-verification.index');
            Route::get('/self-drive-verification/customers/{customer}', [SelfDriveVerificationController::class, 'show'])->name('self-drive-verification.show');
            Route::get('/document-verification', [DocumentVerificationController::class, 'index'])->name('documents.index');
            Route::post('/document-verification/{document}/approve', [DocumentVerificationController::class, 'approve'])->name('documents.approve');
            Route::post('/document-verification/{document}/reject', [DocumentVerificationController::class, 'reject'])->name('documents.reject');
        });
    });
});

Route::prefix('admin/personnel')->name('personnel.')->middleware(['auth', 'active_admin', 'role:admin'])->group(function () {
    Route::get('/', [PersonnelController::class, 'index'])->name('index');
    Route::post('/users', [PersonnelController::class, 'store'])->name('users.store');
    Route::put('/users/{user}', [PersonnelController::class, 'update'])->name('users.update');
    Route::delete('/users/{user}', [PersonnelController::class, 'destroy'])->name('users.destroy');
});
