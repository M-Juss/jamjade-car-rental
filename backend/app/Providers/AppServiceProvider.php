<?php

namespace App\Providers;

use App\Models\Booking;
use App\Models\TelematicsTrip;
use App\Observers\FleetMonitoringObserver;
use App\Support\ManagementAccess;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->booting(function () {
            Gate::before([ManagementAccess::class, 'gate']);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        require base_path('routes/channels.php');
        Booking::observe(FleetMonitoringObserver::class);
        TelematicsTrip::observe(FleetMonitoringObserver::class);

        RateLimiter::for('account-login', function (Request $request) {
            $login = $request->input('login')
                ?: $request->input('email')
                ?: $request->input('phone_number');

            $key = is_string($login) && trim($login) !== '' ? strtolower(trim($login)) : $request->ip();

            return [
                Limit::perMinute(30)->by('ip:'.hash('sha256', (string) $request->ip())),
                Limit::perMinute(5)->by('account:'.hash('sha256', (string) $key))
                    ->after(fn ($response) => in_array($response->getStatusCode(), [401, 422], true)),
            ];
        });

        RateLimiter::for('account-code-request', fn (Request $request) => Limit::perMinute(20)->by($request->route()->getName().':'.hash('sha256', (string) $request->ip())));

        RateLimiter::for('account-code-verify', fn (Request $request) => Limit::perMinute(10)->by($request->route()->getName().':'.hash('sha256', (string) $request->ip())));

        RateLimiter::for('owner-email-code', fn (Request $request) => [
            Limit::perMinute(1)->by('minute:'.$request->user()->id),
            Limit::perHour(5)->by('hour:'.$request->user()->id),
        ]);

        RateLimiter::for('mobile-api', function (Request $request) {
            return Limit::perMinute(120)->by(optional($request->user())->id ?: $request->ip());
        });

        RateLimiter::for('mobile-account', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()->id);
        });
    }
}
