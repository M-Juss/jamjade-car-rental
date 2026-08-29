<?php

use App\Http\Controllers\Web\Admin\AuthController;
use App\Http\Controllers\Web\Admin\BookingController;
use App\Http\Controllers\Web\Admin\CustomerController;
use App\Http\Controllers\Web\Admin\DashboardController;
use App\Http\Controllers\Web\Admin\DocumentVerificationController;
use App\Http\Controllers\Web\Admin\FleetTrackerController;
use App\Http\Controllers\Web\Admin\MaintenanceController;
use App\Http\Controllers\Web\Admin\PaymentController;
use App\Http\Controllers\Web\Admin\ReportController;
use App\Http\Controllers\Web\Admin\StaffManagementController;
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

        Route::get('/dashboard', DashboardController::class)
            ->middleware('permission:view dashboard')
            ->name('dashboard');

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

        Route::middleware('permission:manage bookings')->group(function () {
            Route::get('/bookings', [BookingController::class, 'index'])->name('bookings.index');
            Route::get('/bookings/drivers', [BookingController::class, 'drivers'])->name('bookings.drivers');
            Route::get('/bookings/{booking}', [BookingController::class, 'show'])->name('bookings.show');
            Route::post('/bookings/{booking}/confirm', [BookingController::class, 'confirm'])->name('bookings.confirm');
            Route::post('/bookings/{booking}/reject', [BookingController::class, 'reject'])->name('bookings.reject');
            Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel'])->name('bookings.cancel');
            Route::post('/bookings/{booking}/start', [BookingController::class, 'start'])->name('bookings.start');
            Route::post('/bookings/{booking}/returned', [BookingController::class, 'returned'])->name('bookings.returned');
            Route::post('/bookings/{booking}/complete', [BookingController::class, 'complete'])->name('bookings.complete');
            Route::get('/bookings/{booking}/readiness', [BookingController::class, 'readiness'])->name('bookings.readiness');
            Route::post('/bookings/{booking}/outgoing-inspection', [BookingController::class, 'outgoing'])->name('bookings.outgoing-inspection');
            Route::post('/bookings/{booking}/incoming-inspection', [BookingController::class, 'incoming'])->name('bookings.incoming-inspection');
            Route::post('/bookings/{booking}/additional-charges', [BookingController::class, 'charges'])->name('bookings.additional-charges');
            Route::post('/bookings/{booking}/finalize-return-charges', [BookingController::class, 'finalizeCharges'])->name('bookings.finalize-return-charges');
            Route::post('/bookings/{booking}/assign-driver', [BookingController::class, 'assignDriver'])->name('bookings.assign-driver');
            Route::post('/bookings/{booking}/resend-confirmation-email', [BookingController::class, 'resendConfirmationEmail'])
                ->middleware('role:owner|admin')
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
            Route::get('/document-verification', [DocumentVerificationController::class, 'index'])->name('documents.index');
            Route::post('/document-verification/{document}/approve', [DocumentVerificationController::class, 'approve'])->name('documents.approve');
            Route::post('/document-verification/{document}/reject', [DocumentVerificationController::class, 'reject'])->name('documents.reject');
        });
    });
});

Route::prefix('staff')->name('staff.')->middleware(['auth', 'active_admin', 'role:owner'])->group(function () {
    Route::get('/modules', [StaffManagementController::class, 'modules'])->name('modules.index');
    Route::get('/management', [StaffManagementController::class, 'index'])->name('management.index');
    Route::get('/management/roles', [StaffManagementController::class, 'roles'])->name('management.roles.index');
    Route::post('/management/roles', [StaffManagementController::class, 'storeRole'])->name('management.roles.store');
    Route::put('/management/roles/{role}', [StaffManagementController::class, 'updateRole'])->name('management.roles.update');
    Route::delete('/management/roles/{role}', [StaffManagementController::class, 'destroyRole'])->name('management.roles.destroy');
    Route::post('/management/users', [StaffManagementController::class, 'storeUser'])->name('management.users.store');
    Route::put('/management/users/{user}', [StaffManagementController::class, 'updateUser'])->name('management.users.update');
    Route::delete('/management/users/{user}', [StaffManagementController::class, 'destroyUser'])->name('management.users.destroy');
});
