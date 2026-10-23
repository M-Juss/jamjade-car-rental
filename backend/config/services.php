<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'paypal' => [
        'mode' => env('PAYPAL_MODE', 'sandbox'),
        'client_id' => env('PAYPAL_CLIENT_ID'),
        'client_secret' => env('PAYPAL_CLIENT_SECRET'),
        'base_url' => env('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com'),
        'currency' => 'PHP',
        'return_url' => env('PAYPAL_RETURN_URL'),
        'cancel_url' => env('PAYPAL_CANCEL_URL'),
        'callback_origin' => env('PAYPAL_CALLBACK_ORIGIN'),
        'app_callback_origins' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env(
                'PAYPAL_APP_CALLBACK_ORIGINS',
                in_array(env('APP_ENV'), ['local', 'testing'], true)
                    ? 'http://localhost:8081,http://127.0.0.1:8081'
                    : ''
            ))
        ))),
    ],

    'psgc' => [
        'base_url' => env('PSGC_API_BASE_URL', 'https://psgc.cloud/api/v2'),
        'timeout' => (int) env('PSGC_API_TIMEOUT', 5),
        'cache_ttl' => (int) env('PSGC_API_CACHE_TTL', 86400),
    ],

];
