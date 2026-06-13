<?php

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
