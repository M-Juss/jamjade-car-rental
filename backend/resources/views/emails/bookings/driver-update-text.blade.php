JamJade Car Rental
{{ $update['title'] }}

{{ $update['message'] }}
Booking: {{ $update['bookingCode'] }}
Pickup: {{ $update['pickupLocation'] }}
Driver: {{ $update['driver']['name'] }}
Email: {{ $update['driver']['email'] }}
Contact number: {{ $update['driver']['phoneNumber'] }}
{{ \Carbon\CarbonImmutable::parse($update['occurredAt'])->setTimezone('Asia/Manila')->format('M j, Y, g:i A') }}
