<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('welcome'));

// Server-side proxy voor Anthropic API — sleutel blijft server-side in .env.
// Forwardt alleen het vereiste subset van het request-body naar Anthropic.
Route::post('/api/ai-analyze', function (Request $request) {
    $apiKey = config('services.anthropic.key');

    if (!$apiKey) {
        return response()->json([
            'error' => 'ANTHROPIC_API_KEY niet geconfigureerd op de server. Voeg de variabele toe aan .env of de Laravel Cloud-omgeving.',
        ], 503);
    }

    $payload = $request->validate([
        'model'      => 'required|string',
        'max_tokens' => 'required|integer|min:1|max:4096',
        'messages'   => 'required|array',
        'messages.*.role'    => 'required|in:user,assistant',
        'messages.*.content' => 'required|string|max:32000',
    ]);

    $response = Http::withHeaders([
        'x-api-key'         => $apiKey,
        'anthropic-version' => config('services.anthropic.version', '2023-06-01'),
        'content-type'      => 'application/json',
    ])->timeout(60)->post('https://api.anthropic.com/v1/messages', $payload);

    return response($response->body(), $response->status())
        ->header('Content-Type', 'application/json');
});
