<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Jamjade Car Rental Booking Confirmation</title>
</head>
<body style="margin: 0; padding: 24px; background: #F8FAFF; color: #17315F; font-family: Arial, sans-serif;">
    <table role="presentation" style="width: 100%; max-width: 620px; margin: 0 auto; border-collapse: collapse; background: #FFFFFF;">
        <tr>
            <td style="padding: 28px; border: 1px solid #E6EEFF;">
                <div style="margin-bottom: 18px; color: #346EF6; font-size: 12px; font-weight: 700; letter-spacing: 1px;">
                    JAMJADE CAR RENTAL
                </div>

                <p style="margin: 0 0 14px;">Hello {{ $confirmation['customer']['name'] }},</p>

                <p style="margin: 0 0 14px; line-height: 1.6;">
                    Your booking was successful.
                </p>

                <p style="margin: 0 0 6px; line-height: 1.6;">
                    Booking reference: <strong>{{ $confirmation['bookingReference'] }}</strong>
                </p>

                <p style="margin: 0 0 14px; line-height: 1.6;">
                    Payment status: <strong>{{ $confirmation['paymentStatusLabel'] }}</strong>
                </p>

                <p style="margin: 0 0 14px; line-height: 1.6;">
                    Your official booking confirmation and rental agreement PDF is attached to this email.
                </p>

                <p style="margin: 22px 0 0; color: #6C7A96; line-height: 1.6;">
                    Thank you for choosing Jamjade Car Rental.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
