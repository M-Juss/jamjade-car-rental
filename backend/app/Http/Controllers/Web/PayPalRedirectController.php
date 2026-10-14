<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Support\PayPalAppUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PayPalRedirectController extends Controller
{
    public function return(Request $request, ?string $target = null): Response
    {
        return $this->redirectToApp($request, 'return', $target);
    }

    public function cancel(Request $request, ?string $target = null): Response
    {
        return $this->redirectToApp($request, 'cancel', $target);
    }

    private function redirectToApp(Request $request, string $action, ?string $target): Response
    {
        $query = collect($request->only(['token', 'PayerID']))
            ->filter(fn (mixed $value) => is_scalar($value) && $value !== '')
            ->map(fn (mixed $value) => (string) $value)
            ->all();
        $appUrl = PayPalAppUrl::decode($target) ?? "mobilefrontend://paypal/{$action}";

        if ($query !== []) {
            $appUrl .= (str_contains($appUrl, '?') ? '&' : '?').http_build_query($query);
        }

        $launchUrl = $appUrl;
        if (str_contains(strtolower($request->userAgent() ?? ''), 'android')) {
            $launchUrl = PayPalAppUrl::androidIntent(
                $appUrl,
                $request->fullUrlWithQuery(['manual_return' => '1'])
            ) ?? $appUrl;
        }

        $autoRedirect = ! $request->boolean('manual_return');

        return response()
            ->view('paypal.redirect', [
                'launchUrl' => $launchUrl,
                'autoRedirect' => $autoRedirect,
                'cancelled' => $action === 'cancel',
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
}
