<?php

use App\Http\Controllers\Api\Mobile\AuthController;
use App\Http\Controllers\Api\Mobile\BookingController;
use App\Http\Controllers\Api\Mobile\DocumentController;
use App\Http\Controllers\Api\Mobile\NotificationController;
use App\Http\Controllers\Api\Mobile\PaymentController;
use App\Http\Controllers\Api\Mobile\PayPalController;
use App\Http\Controllers\Api\Mobile\ProfileController;
use App\Http\Controllers\Api\Mobile\TelematicsController;
use App\Http\Controllers\Api\Mobile\VehicleController;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')->name('mobile.')->group(function () {
    Route::middleware('throttle:mobile-auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register'])->name('register');
        Route::post('/login', [AuthController::class, 'login'])->name('login');
    });

    Route::get('/vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
    Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show'])->name('vehicles.show');

    Route::middleware(['auth:sanctum', 'throttle:mobile-api'])->group(function () {
        Route::get('/me', [AuthController::class, 'me'])->name('me');
        Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

        Route::get('/profile', [ProfileController::class, 'show'])->name('profile.show');
        Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::post('/profile', [ProfileController::class, 'update'])->name('profile.update-upload');
        Route::post('/profile/complete', [ProfileController::class, 'complete'])->name('profile.complete');
        Route::post('/profile/emergency-contact', [ProfileController::class, 'emergencyContact'])->name('profile.emergency-contact');
        Route::post('/profile/emergency-contact/skip', [ProfileController::class, 'skipEmergencyContact'])->name('profile.emergency-contact.skip');

        Route::get('/bookings', [BookingController::class, 'index'])->name('bookings.index');
        Route::post('/bookings', [BookingController::class, 'store'])->name('bookings.store');
        Route::get('/bookings/{booking}', [BookingController::class, 'show'])->name('bookings.show');
        Route::post('/bookings/{booking}/cancel', [BookingController::class, 'cancel'])->name('bookings.cancel');

        Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
        Route::post('/documents/upload', [DocumentController::class, 'upload'])->name('documents.upload');

        Route::post('/payments', [PaymentController::class, 'store'])->name('payments.store');
        Route::post('/paypal/orders', [PayPalController::class, 'createOrder'])->name('paypal.orders.create');
        Route::post('/bookings/{booking}/paypal/orders', [PayPalController::class, 'createBalanceOrder'])->name('bookings.paypal.orders.create');
        Route::post('/paypal/orders/{orderId}/capture', [PayPalController::class, 'captureOrder'])->name('paypal.orders.capture');
        Route::post('/paypal/orders/{orderId}/abandon', [PayPalController::class, 'abandonOrder'])->name('paypal.orders.abandon');

        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');

        Route::post('/telematics/trips/start', [TelematicsController::class, 'start'])->name('telematics.trips.start');
        Route::post('/telematics/trips/{trip}/pause', [TelematicsController::class, 'pause'])->name('telematics.trips.pause');
        Route::post('/telematics/trips/{trip}/resume', [TelematicsController::class, 'resume'])->name('telematics.trips.resume');
        Route::post('/telematics/trips/{trip}/events', [TelematicsController::class, 'event'])->name('telematics.trips.events');
        Route::post('/telematics/trips/{trip}/location', [TelematicsController::class, 'location'])->name('telematics.trips.location');
        Route::post('/telematics/trips/{trip}/end', [TelematicsController::class, 'end'])->name('telematics.trips.end');
    });
});
