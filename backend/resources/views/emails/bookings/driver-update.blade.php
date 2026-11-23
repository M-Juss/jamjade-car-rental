<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>{{ $update['title'] }}</title></head>
<body style="margin:0;background:#346EF6;font-family:Arial,sans-serif;color:#17315F;padding:24px 12px;">
<table role="presentation" style="width:100%;max-width:600px;margin:auto;background:#FFFFFF;border-radius:12px;"><tr><td style="padding:28px;">
    <p style="font-weight:bold;">JamJade Car Rental</p>
    <h1 style="font-size:22px;">{{ $update['title'] }}</h1>
    <p>{{ $update['message'] }}</p>
    <p><strong>Booking:</strong> {{ $update['bookingCode'] }}</p>
    <p><strong>Pickup:</strong> {{ $update['pickupLocation'] }}</p>
    <p><strong>Driver:</strong> {{ $update['driver']['name'] }}<br>
    <strong>Email:</strong> {{ $update['driver']['email'] }}<br>
    <strong>Contact number:</strong> {{ $update['driver']['phoneNumber'] }}</p>
    <p style="font-size:13px;">{{ \Carbon\CarbonImmutable::parse($update['occurredAt'])->setTimezone('Asia/Manila')->format('M j, Y, g:i A') }}</p>
</td></tr></table></body></html>
