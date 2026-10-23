<?php

use App\Services\BookingEmailService;
use App\Services\DeliveryQuoteService;
use App\Services\LocationMonitoringService;
use App\Services\PaymentDeadlineService;
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

Schedule::call(fn () => app(ReturnDeadlineService::class)->process())
    ->name('process-rental-return-deadlines')->everyMinute()->withoutOverlapping();

Artisan::command('booking-documents:retry {--include-failed : Retry failed deliveries as well as pending ones}', function (BookingEmailService $service) {
    $count = $service->retryPendingDocuments((bool) $this->option('include-failed'));
    $this->info("Booking document emails dispatched: {$count}.");
})->purpose('Dispatch up to 50 pending invoice/receipt emails without regenerating issued documents');

Schedule::command('booking-documents:retry')->everyFiveMinutes()->withoutOverlapping();
