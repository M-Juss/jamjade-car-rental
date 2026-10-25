<?php

use App\Http\Controllers\Api\Mobile\AccountController;
use App\Http\Controllers\Api\Mobile\AddressDirectoryController;
use App\Http\Controllers\Api\Mobile\AuthController;
use App\Http\Controllers\Api\Mobile\BookingController;
use App\Http\Controllers\Api\Mobile\CustomerReceiptController;
use App\Http\Controllers\Api\Mobile\DeliveryQuoteController;
use App\Http\Controllers\Api\Mobile\DocumentController;
use App\Http\Controllers\Api\Mobile\DriverBookingController;
use App\Http\Controllers\Api\Mobile\LocationMonitoringController;
use App\Http\Controllers\Api\Mobile\NotificationController;
use App\Http\Controllers\Api\Mobile\PaymentController;
use App\Http\Controllers\Api\Mobile\PayPalController;
use App\Http\Controllers\Api\Mobile\ProfileController;
use App\Http\Controllers\Api\Mobile\RcResearchController;
use App\Http\Controllers\Api\Mobile\TelematicsController;
use App\Http\Controllers\Api\Mobile\TelematicsSetupController;
use App\Http\Controllers\Api\Mobile\VehicleController;
use App\Http\Middleware\RestrictRcResearchToken;
use Illuminate\Support\Facades\Route;

Route::prefix('mobile')->name('mobile.')->group(function () {
    Route::middleware('throttle:mobile-auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register'])->name('register');
        Route::post('/login', [AuthController::class, 'login'])->name('login');
    });

    Route::middleware('throttle:mobile-api')->group(function () {
        Route::get('/vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
        Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show'])->name('vehicles.show');
    });

    Route::middleware(['auth:sanctum', RestrictRcResearchToken::class, 'active_user', 'throttle:mobile-api'])->group(function () {
        Route::get('/rc-research', [RcResearchController::class, 'show'])->name('rc-research.show');
        Route::get('/rc-research/native-access', [RcResearchController::class, 'nativeAccess'])->name('rc-research.native-access');
        Route::post('/rc-research/sessions', [RcResearchController::class, 'storeSession'])->name('rc-research.sessions.store');
        Route::post('/rc-research/sessions/{session}/trials', [RcResearchController::class, 'storeTrial'])->whereUuid('session')->name('rc-research.trials.store');
        Route::get('/rc-research/trials', [RcResearchController::class, 'trials'])->name('rc-research.trials.index');
        Route::delete('/rc-research/trials/{trial}', [RcResearchController::class, 'destroyTrial'])->whereUuid('trial')->name('rc-research.trials.destroy');
        Route::get('/me', [AuthController::class, 'me'])->name('me');
        Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

        Route::middleware(['role:customer', 'throttle:mobile-account'])->group(function () {
            Route::put('/account/email', [AccountController::class, 'updateEmail'])->name('account.email');
            Route::put('/account/password', [AccountController::class, 'changePassword'])->name('account.password');
        });

        Route::get('/profile', [ProfileController::class, 'show'])->name('profile.show');
        Route::put('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::post('/profile', [ProfileController::class, 'update'])->name('profile.update-upload');
        Route::post('/profile/complete', [ProfileController::class, 'complete'])->name('profile.complete');
        Route::post('/profile/emergency-contact', [ProfileController::class, 'emergencyContact'])->name('profile.emergency-contact');
        Route::post('/profile/emergency-contact/skip', [ProfileController::class, 'skipEmergencyContact'])->name('profile.emergency-contact.skip');

        Route::get('/address/regions', [AddressDirectoryController::class, 'regions'])->name('address.regions');
        Route::get('/address/provinces', [AddressDirectoryController::class, 'provinces'])->name('address.provinces');
        Route::get('/address/cities-municipalities', [AddressDirectoryController::class, 'citiesMunicipalities'])->name('address.cities-municipalities');
        Route::get('/address/barangays', [AddressDirectoryController::class, 'barangays'])->name('address.barangays');

        Route::middleware(['role:customer', 'throttle:20,1'])->prefix('delivery')->group(function () {
            Route::get('/places', [DeliveryQuoteController::class, 'suggestions'])->name('delivery.places');
            Route::get('/place', [DeliveryQuoteController::class, 'place'])->name('delivery.place');
            Route::post('/quotes', [DeliveryQuoteController::class, 'store']);
            Route::get('/quotes', [DeliveryQuoteController::class, 'index']);
            Route::get('/quotes/{quote}', [DeliveryQuoteController::class, 'show']);
            Route::get('/quotes/{quote}/estimate', [DeliveryQuoteController::class, 'estimate']);
        });

        Route::get('/bookings', [BookingController::class, 'index'])->middleware('role:customer')->name('bookings.index');
        Route::post('/bookings', [BookingController::class, 'store'])->middleware('role:customer')->name('bookings.store');
        Route::get('/bookings/{booking}/delivery-estimate', [BookingController::class, 'deliveryEstimate'])->middleware(['role:customer', 'throttle:20,1']);
        Route::get('/bookings/{booking}', [BookingController::class, 'show'])->middleware('role:customer')->name('bookings.show');
        Route::middleware('role:customer')->group(function () {
            Route::get('/bookings/{booking}/receipts', [CustomerReceiptController::class, 'index']);
            Route::get('/receipts/{receipt}', [CustomerReceiptController::class, 'show'])->whereNumber('receipt');
            Route::get('/receipts/{receipt}/download', [CustomerReceiptController::class, 'download'])->whereNumber('receipt');
            Route::get('/paypal/orders/{orderId}/receipt', [CustomerReceiptController::class, 'forOrder']);
        });
        Route::get('/telematics/rentals', [TelematicsSetupController::class, 'index'])->name('telematics.rentals.index');
        Route::get('/telematics/setup', [TelematicsSetupController::class, 'current'])->name('telematics.setup.current');
        Route::get('/bookings/{booking}/telematics-setup', [TelematicsSetupController::class, 'show'])->name('bookings.telematics-setup.show');
        Route::post('/bookings/{booking}/telematics-setup/steps/{step}/attempt', [TelematicsSetupController::class, 'attempt'])->name('bookings.telematics-setup.steps.attempt');
        Route::get('/driver/services', [DriverBookingController::class, 'index'])->name('driver.services.index');
        Route::get('/driver/services/{booking}', [DriverBookingController::class, 'show'])->name('driver.services.show');

        Route::get('/documents', [DocumentController::class, 'index'])->middleware('role:customer')->name('documents.index');
        Route::post('/documents/upload', [DocumentController::class, 'upload'])->middleware('role:customer')->name('documents.upload');

        Route::post('/payments', [PaymentController::class, 'store'])->middleware('role:customer')->name('payments.store');
        Route::post('/paypal/orders', [PayPalController::class, 'createOrder'])->middleware('role:customer')->name('paypal.orders.create');
        Route::post('/bookings/{booking}/paypal/orders', [PayPalController::class, 'createBalanceOrder'])->middleware('role:customer')->name('bookings.paypal.orders.create');
        Route::post('/driver/services/{booking}/paypal/orders', [PayPalController::class, 'createDriverOutstandingOrder'])->name('driver.services.paypal.orders.create');
        Route::post('/paypal/orders/{orderId}/capture', [PayPalController::class, 'captureOrder'])->name('paypal.orders.capture');
        Route::post('/paypal/orders/{orderId}/abandon', [PayPalController::class, 'abandonOrder'])->name('paypal.orders.abandon');

        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read-all');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('notifications.read');

        Route::prefix('/bookings/{booking}/location-monitoring')->group(function () {
            Route::get('/', [LocationMonitoringController::class, 'show']);
            Route::post('/start', [LocationMonitoringController::class, 'start']);
            Route::post('/location', [LocationMonitoringController::class, 'location']);
            Route::post('/pause', [LocationMonitoringController::class, 'pause']);
        });

        Route::post('/telematics/trips/start', [TelematicsController::class, 'start'])->name('telematics.trips.start');
        Route::post('/telematics/trips/{trip}/pause', [TelematicsController::class, 'pause'])->name('telematics.trips.pause');
        Route::post('/telematics/trips/{trip}/resume', [TelematicsController::class, 'resume'])->name('telematics.trips.resume');
        Route::post('/telematics/trips/{trip}/events', [TelematicsController::class, 'event'])->name('telematics.trips.events');
        Route::post('/telematics/trips/{trip}/location', [TelematicsController::class, 'location'])->name('telematics.trips.location');
        Route::post('/telematics/trips/{trip}/end', [TelematicsController::class, 'end'])->name('telematics.trips.end');
    });
});
