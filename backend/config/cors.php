<?php

return [
    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'admin/*',
        'staff/*',
    ],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(array_map(
        'trim',
        explode(',', env(
            'CORS_ALLOWED_ORIGINS',
            'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001'
        ))
    )),

    'allowed_origins_patterns' => array_filter(array_merge(
        ['#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#'],
        array_map('trim', explode(',', env('CORS_ALLOWED_ORIGIN_PATTERNS', '')))
    )),

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
