@php
    $isRentalInformation = ($confirmation['formatVersion'] ?? 1) >= 3;
    $isConfirmed = strtolower((string) ($confirmation['bookingStatusLabel'] ?? '')) === 'confirmed';
    $rental = $confirmation['rental'] ?? [];
    $vehicle = $confirmation['vehicle'] ?? [];
    $formatDate = static fn ($value) => $value
        ? \Illuminate\Support\Carbon::parse($value)->timezone('Asia/Manila')->format('M j, Y, g:i A')
        : null;
    $rentalPeriod = trim(implode(' – ', array_filter([
        $formatDate($rental['startAt'] ?? null),
        $formatDate($rental['endAt'] ?? null),
    ])));
    $vehicleName = $vehicle['name'] ?? trim(implode(' ', array_filter([
        $vehicle['brand'] ?? null,
        $vehicle['model'] ?? null,
    ])));
@endphp
{{ $isConfirmed ? 'Booking confirmed' : 'Payment received' }}

Dear {{ $confirmation['customer']['name'] ?? 'Renter' }},

Booking reference: {{ $confirmation['bookingReference'] ?? '—' }}
@if ($vehicleName !== '')
Vehicle: {{ $vehicleName }}
@endif
@if ($rentalPeriod !== '')
Rental dates: {{ $rentalPeriod }}
@endif
@if (!empty($rental['pickupLocation']))
Pickup: {{ $rental['pickupLocation'] }}
@endif
@if (!empty($rental['returnLocation']))
Return: {{ $rental['returnLocation'] }}
@endif
Booking status: {{ $confirmation['bookingStatusLabel'] ?? '—' }}
Receipt reference: {{ $confirmation['receipt']['reference'] ?? '—' }}
@unless ($isRentalInformation)
Invoice reference: {{ $confirmation['invoiceReference'] ?? '—' }}
@endunless
Payment status: {{ $confirmation['paymentStatusLabel'] ?? '—' }}

Amount received this payment: PHP {{ number_format($confirmation['receipt']['amount'] ?? 0, 2) }}
Payment summary at issue
Total paid as of issue: PHP {{ number_format($confirmation['payment']['amountPaid'] ?? 0, 2) }}
Remaining balance as of issue: PHP {{ number_format($confirmation['payment']['remainingBalance'] ?? 0, 2) }}

Your {{ $isRentalInformation ? 'rental information' : 'invoice' }}, including the rental agreement, and payment receipt are attached. Please review and keep both PDFs for your records.

Thank you for choosing JamJade Car Rental.

JamJade Car Rental
