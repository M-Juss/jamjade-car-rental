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

        return response()
            ->view('paypal.redirect', [
                'appUrl' => $appUrl,
                'cancelled' => $action === 'cancel',
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
}
