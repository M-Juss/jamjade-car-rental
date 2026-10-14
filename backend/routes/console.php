<?php

use App\Services\DeliveryQuoteService;
use App\Services\PaymentDeadlineService;
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
