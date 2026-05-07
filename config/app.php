<?php

return [
    'name' => env('APP_NAME', 'Inhaalvaccinatie Adviseur'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => 'Europe/Amsterdam',
    'locale' => 'nl',
    'fallback_locale' => 'en',
    'faker_locale' => 'nl_NL',
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'previous_keys' => [],
    'maintenance' => [
        'driver' => 'file',
    ],
];
