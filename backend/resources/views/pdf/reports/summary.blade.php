<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Jamjade Reports & Analytics</title>
    <style>
        body { color: #1a2340; font-family: DejaVu Sans, sans-serif; font-size: 11px; }
        h1 { margin-bottom: 4px; font-size: 22px; }
        h2 { margin: 22px 0 8px; font-size: 15px; }
        .muted { color: #6b7589; }
        .summary { width: 100%; margin-top: 18px; border-collapse: collapse; }
        .summary td { width: 33.33%; padding: 10px; border: 1px solid #dde3ee; }
        .summary strong { display: block; margin-top: 4px; font-size: 16px; }
        table.data { width: 100%; border-collapse: collapse; }
        table.data th, table.data td { padding: 7px; border: 1px solid #dde3ee; text-align: left; }
        table.data th { background: #eef4ff; font-size: 9px; text-transform: uppercase; }
    </style>
</head>
<body>
    <h1>Jamjade Reports & Analytics</h1>
    <div class="muted">
        Generated {{ $generatedAt->format('F j, Y g:i A') }} · Range: {{ str($report['range'])->replace('_', ' ')->title() }}
    </div>

    <table class="summary">
        <tr>
            <td>Total Revenue<strong>PHP {{ number_format($report['summary']['totalRevenue'], 2) }}</strong></td>
            <td>Total Bookings<strong>{{ number_format($report['summary']['totalBookings']) }}</strong></td>
            <td>Completed Rentals<strong>{{ number_format($report['summary']['completedBookings']) }}</strong></td>
        </tr>
        <tr>
            <td>Active Rentals<strong>{{ number_format($report['summary']['activeRentals']) }}</strong></td>
            <td>Cancelled Bookings<strong>{{ number_format($report['summary']['cancelledBookings']) }}</strong></td>
            <td>Average Duration<strong>{{ $report['summary']['averageBookingDuration'] }} days</strong></td>
        </tr>
    </table>

    <h2>Recent Booking Records</h2>
    <table class="data">
        <thead>
            <tr>
                <th>Booking</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Rental Date</th>
                <th>Return Date</th>
                <th>Total</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($report['bookings'] as $booking)
                <tr>
                    <td>{{ $booking['bookingId'] }}</td>
                    <td>{{ $booking['customer'] }}</td>
                    <td>{{ $booking['vehicle'] }}</td>
                    <td>{{ $booking['rentalDate'] }}</td>
                    <td>{{ $booking['returnDate'] }}</td>
                    <td>PHP {{ number_format($booking['totalCost'], 2) }}</td>
                    <td>{{ $booking['status'] }}</td>
                </tr>
            @empty
                <tr><td colspan="7">No bookings found for this period.</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
