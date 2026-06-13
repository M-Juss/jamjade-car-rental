<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

final class PublicStorageUrl
{
    public static function make(?string $path): ?string
    {
        if (blank($path)) {
            return null;
        }

        $path = trim($path);

        if (preg_match('/^https?:\/\//i', $path)) {
            return $path;
        }

        if (str_starts_with($path, '/storage/') || str_starts_with($path, 'storage/')) {
            return asset('/'.ltrim($path, '/'));
        }

        if (str_starts_with($path, '/uploads/') || str_starts_with($path, 'uploads/')) {
            return asset('/'.ltrim($path, '/'));
        }

        return asset(Storage::url($path));
    }
}
