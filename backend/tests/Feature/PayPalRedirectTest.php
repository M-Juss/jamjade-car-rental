<?php

use App\Support\PayPalAppUrl;

it('returns Android payment callbacks through an intent with a browser fallback', function (string $action, string $appPath) {
    $appUrl = 'mobilefrontend://paypal/'.$appPath;
    $target = PayPalAppUrl::encode($appUrl);
    $path = "/paypal/{$action}/{$target}?token=TEST-ORDER&PayerID=TEST-PAYER";

    $response = $this->withHeader('User-Agent', 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0.0.0 Mobile')
        ->get($path)
        ->assertOk()
        ->assertViewHas('autoRedirect', true)
        ->assertSee('Return to JamJade');

    $launchUrl = $response->viewData('launchUrl');
    expect($launchUrl)->toStartWith("intent://paypal/{$appPath}?token=TEST-ORDER&PayerID=TEST-PAYER#Intent;scheme=mobilefrontend;")
        ->toContain('S.browser_fallback_url=')
        ->toEndWith(';end');

    preg_match('/S\.browser_fallback_url=([^;]+);/', $launchUrl, $matches);
    $fallbackUrl = rawurldecode($matches[1]);
    parse_str(parse_url($fallbackUrl, PHP_URL_QUERY), $query);

    expect(parse_url($fallbackUrl, PHP_URL_PATH))->toBe("/paypal/{$action}/{$target}")
        ->and($query)->toMatchArray([
            'token' => 'TEST-ORDER',
            'PayerID' => 'TEST-PAYER',
            'manual_return' => '1',
        ]);

    $this->get($fallbackUrl)
        ->assertOk()
        ->assertViewHas('autoRedirect', false)
        ->assertSee('Tap Return to JamJade')
        ->assertDontSee('window.location.replace', false);
})->with([
    ['return', 'return'],
    ['cancel', 'cancel'],
    ['return', 'driver-return'],
    ['cancel', 'driver-cancel'],
]);

it('preserves direct iOS and Expo Go callbacks', function (string $appUrl) {
    $target = PayPalAppUrl::encode($appUrl);

    $this->withHeader('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
        ->get("/paypal/return/{$target}?token=TEST-ORDER")
        ->assertOk()
        ->assertViewHas('launchUrl', $appUrl.'?token=TEST-ORDER')
        ->assertViewHas('autoRedirect', true)
        ->assertSee('window.location.replace', false);
})->with([
    'mobilefrontend://paypal/return',
    'exp://127.0.0.1:8081/--/paypal/return',
]);

it('preserves allowed web callbacks on Android', function () {
    config(['services.paypal.app_callback_origins' => ['http://localhost:8081']]);
    $target = PayPalAppUrl::encode('http://localhost:8081/paypal/return');

    $this->withHeader('User-Agent', 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0.0.0 Mobile')
        ->get("/paypal/return/{$target}?token=TEST-ORDER")
        ->assertOk()
        ->assertViewHas('launchUrl', 'http://localhost:8081/paypal/return?token=TEST-ORDER');
});

it('does not let a callback fragment inject Android intent extras', function () {
    $url = PayPalAppUrl::androidIntent(
        'mobilefrontend://paypal/return#Intent;scheme=untrusted;package=other.app;end',
        'https://example.test/paypal/return?manual_return=1'
    );

    expect($url)->toStartWith('intent://paypal/return#Intent;scheme=mobilefrontend;')
        ->not->toContain('untrusted')
        ->not->toContain('package=other.app');
});
