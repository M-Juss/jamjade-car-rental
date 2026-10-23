<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $documentTitle }} - {{ $confirmation['bookingReference'] }}</title>
    @include('pdf.bookings.partials.styles')
</head>
<body>
@php
    $displayValue = static fn ($value): string => filled($value) ? (string) $value : 'Not provided';
    $formatMoney = static fn ($value): string => 'PHP '.number_format((float) $value, 2);
    $formatDate = static fn ($value, string $format = 'F j, Y - g:i A'): string => $value ? \Carbon\CarbonImmutable::parse($value)->timezone('Asia/Manila')->format($format) : 'Not provided';
    $logoPath = public_path('images/JamJadeLogo-solid.png');
    $logoDataUri = is_file($logoPath)
        ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath))
        : null;
@endphp

@include($contentView)
</body>
</html>
