<?php

use App\Models\MobilePasswordReset;
use App\Models\PendingMobileRegistration;
use App\Services\BookingEmailService;
use App\Services\DeliveryQuoteService;
use App\Services\DocumentRetentionService;
use App\Services\LocationMonitoringService;
use App\Services\PaymentDeadlineService;
use App\Services\RentalDrivingReportService;
use App\Services\ReturnDeadlineService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(fn () => app(PaymentDeadlineService::class)->process())
    ->name('process-booking-payment-deadlines')
    ->everyFifteenMinutes()
    ->withoutOverlapping();

Artisan::command('delivery:purge-provider-data', function (DeliveryQuoteService $service) {
    $count = $service->purgeExpiredProviderData();
    $this->info("Expired delivery points removed: {$count}.");
})->purpose('Remove expired delivery coordinates while retaining accepted financial amounts');

Schedule::command('delivery:purge-provider-data')->hourly()->withoutOverlapping();

Artisan::command('telematics:purge-latest-locations', function (LocationMonitoringService $service) {
    $count = $service->purgeExpiredLocations();
    $this->info("Expired latest locations cleared: {$count}.");
})->purpose('Clear expired encrypted latest-location values without deleting trip records');

Schedule::command('telematics:purge-latest-locations')->hourly()->withoutOverlapping();

Artisan::command('telematics:finalize-driving-reports', function (RentalDrivingReportService $reports) {
    $this->info('Driving reports finalized: '.$reports->process().'.');
})->purpose('Finalize completed rental grades after the motion upload window');

Schedule::command('telematics:finalize-driving-reports')->everyMinute()->withoutOverlapping();

Schedule::call(fn () => app(ReturnDeadlineService::class)->process())
    ->name('process-rental-return-deadlines')->everyMinute()->withoutOverlapping();

Artisan::command('mobile-registration:purge', function () {
    $count = PendingMobileRegistration::query()->where('absolute_expires_at', '<=', now())->delete();
    $this->info("Expired pending registrations removed: {$count}.");
})->purpose('Remove expired unverified mobile registrations');

Schedule::command('mobile-registration:purge')->hourly()->withoutOverlapping();

Artisan::command('documents:archive-expired', function (DocumentRetentionService $service) {
    $this->info('Verification documents archived: '.$service->archiveExpired().'.');
})->purpose('Remove expired verification images and archive their document records');

Schedule::command('documents:archive-expired')->daily()->withoutOverlapping();

Schedule::call(fn () => MobilePasswordReset::query()->where('expires_at', '<=', now())->delete())
    ->name('mobile-password-reset-purge')->hourly()->withoutOverlapping();

Artisan::command('booking-documents:retry {--include-failed : Retry failed deliveries as well as pending ones}', function (BookingEmailService $service) {
    $count = $service->retryPendingDocuments((bool) $this->option('include-failed'));
    $this->info("Booking document emails dispatched: {$count}.");
})->purpose('Dispatch up to 50 pending invoice/receipt emails without regenerating issued documents');

Schedule::command('booking-documents:retry')->everyFiveMinutes()->withoutOverlapping();
