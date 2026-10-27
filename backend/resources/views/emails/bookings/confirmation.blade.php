@php($isRentalInformation = ($confirmation['formatVersion'] ?? 1) >= 3)
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $isRentalInformation ? 'Rental Information and Payment Receipt' : 'Invoice and Payment Receipt' }}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; word-wrap: break-word;">
    <p style="margin: 0 0 16px;">Dear {{ $confirmation['customer']['name'] }},</p>

    <p style="margin: 0 0 16px;">Please find attached your {{ $isRentalInformation ? 'rental information' : 'invoice' }}, including the rental agreement, and the receipt for the payment listed below.</p>

    <p style="margin: 0 0 16px;">
        Booking reference: <strong>{{ $confirmation['bookingReference'] }}</strong><br>
        Booking status: <strong>{{ $confirmation['bookingStatusLabel'] }}</strong><br>
        @unless ($isRentalInformation)
        Invoice reference: <strong>{{ $confirmation['invoiceReference'] }}</strong><br>
        @endunless
        Receipt reference: <strong>{{ $confirmation['receipt']['reference'] }}</strong><br>
        Payment status as of issue: <strong>{{ $confirmation['paymentStatusLabel'] }}</strong>
    </p>

    <p style="margin: 0 0 16px;">
        Amount received in this payment: <strong>PHP {{ number_format($confirmation['receipt']['amount'], 2) }}</strong><br>
        Total paid as of issue: <strong>PHP {{ number_format($confirmation['payment']['amountPaid'], 2) }}</strong><br>
        Remaining balance as of issue: <strong>PHP {{ number_format($confirmation['payment']['remainingBalance'], 2) }}</strong>
    </p>

    <p style="margin: 0 0 16px;">Please review both attached PDFs and retain them for your records.</p>

    <p style="margin: 0 0 16px;">Thank you for choosing Jamjade Car Rental.</p>

    <p style="margin: 0;">Sincerely,<br>Jamjade Car Rental</p>
</body>
</html>
