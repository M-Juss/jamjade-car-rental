@php($isRentalInformation = ($confirmation['formatVersion'] ?? 1) >= 3)
Dear {{ $confirmation['customer']['name'] }},

Please find attached your {{ $isRentalInformation ? 'rental information' : 'invoice' }}, including the rental agreement, and the receipt for the payment listed below.

Booking reference: {{ $confirmation['bookingReference'] }}
Booking status: {{ $confirmation['bookingStatusLabel'] }}
@unless ($isRentalInformation)
Invoice reference: {{ $confirmation['invoiceReference'] }}
@endunless
Receipt reference: {{ $confirmation['receipt']['reference'] }}
Payment status as of issue: {{ $confirmation['paymentStatusLabel'] }}

Amount received in this payment: PHP {{ number_format($confirmation['receipt']['amount'], 2) }}
Total paid as of issue: PHP {{ number_format($confirmation['payment']['amountPaid'], 2) }}
Remaining balance as of issue: PHP {{ number_format($confirmation['payment']['remainingBalance'], 2) }}

Please review both attached PDFs and retain them for your records.

Thank you for choosing Jamjade Car Rental.

Sincerely,
Jamjade Car Rental
