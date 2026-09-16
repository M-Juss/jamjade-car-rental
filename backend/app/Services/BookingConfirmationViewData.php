<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Models\Booking;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;
use JsonException;

class BookingConfirmationViewData
{
    public function make(Booking $booking, ?CarbonInterface $issuedAt = null): array
    {
        $booking->loadMissing(['user.customerProfile', 'vehicle', 'payments', 'assignedDriver', 'terms']);

        $payments = $booking->payments->sortByDesc(
            fn ($payment) => $payment->paid_at ?? $payment->created_at
        );
        $latestPayment = $payments->first();
        $totalAmount = (float) $booking->total_amount;
        $amountPaid = (float) $payments->sum(fn ($payment) => (float) $payment->amount);
        $isFullyPaid = $booking->payment_status === PaymentStatus::Paid
            || ($totalAmount > 0 && $amountPaid >= $totalAmount);
        $remainingBalance = $isFullyPaid ? 0 : max($totalAmount - $amountPaid, 0);
        $profile = $booking->user?->customerProfile;
        $profileName = trim(implode(' ', array_filter([
            $profile?->first_name,
            $profile?->last_name,
        ])));
        $customerName = $profileName !== ''
            ? $profileName
            : ($booking->user?->name ?: 'Renter');
        $signature = $this->signature($booking->customer_signature);

        return [
            'issuedAt' => $issuedAt ?? now(),
            'bookingReference' => $booking->booking_code ?: (string) $booking->id,
            'bookingStatusLabel' => $booking->status?->mobileLabel()
                ?? Str::headline((string) $booking->status),
            'bookingStatusClass' => match ($booking->status?->value) {
                'confirmed', 'ongoing', 'completed' => 'status-success',
                'pending' => 'status-warning',
                default => 'status-neutral',
            },
            'paymentStatusLabel' => $isFullyPaid ? 'Fully Paid' : 'Down Payment',
            'paymentStatusClass' => $isFullyPaid ? 'status-success' : 'status-warning',
            'customer' => [
                'name' => $customerName,
                'email' => $booking->user?->email,
                'phone' => $booking->user?->phone_number,
                'address' => $profile?->address,
            ],
            'driver' => $booking->assignedDriver ? [
                'name' => $booking->assignedDriver->name,
                'phone' => $booking->assignedDriver->phone_number,
            ] : null,
            'vehicle' => [
                'name' => $booking->vehicle?->name,
                'brand' => $booking->vehicle?->brand,
                'model' => $booking->vehicle?->model,
                'transmission' => $booking->vehicle?->transmission,
                'fuelType' => $booking->vehicle?->fuel_type,
                'seats' => $booking->vehicle?->seats,
                'color' => $booking->vehicle?->color,
            ],
            'payment' => [
                'totalAmount' => $totalAmount,
                'amountPaid' => $amountPaid,
                'remainingBalance' => $remainingBalance,
                'method' => $latestPayment?->payment_method,
                'transactionId' => $latestPayment?->transaction_id,
                'paidAt' => $latestPayment?->paid_at,
            ],
            'signatureImage' => $signature['image'],
            'signatureText' => $signature['text'],
        ];
    }

    /**
     * @return array{image: ?string, text: ?string}
     */
    private function signature(?string $value): array
    {
        $value = trim((string) $value);

        if ($value === '') {
            return ['image' => null, 'text' => null];
        }

        if (str_starts_with($value, 'data:image/')) {
            return ['image' => $value, 'text' => null];
        }

        try {
            $strokes = json_decode($value, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return ['image' => null, 'text' => $value];
        }

        if (! is_array($strokes)) {
            return ['image' => null, 'text' => null];
        }

        $normalizedStrokes = collect($strokes)
            ->filter(fn ($stroke) => is_array($stroke))
            ->map(function (array $stroke) {
                return collect($stroke)
                    ->filter(fn ($point) => is_array($point)
                        && is_numeric($point['x'] ?? null)
                        && is_numeric($point['y'] ?? null))
                    ->map(fn (array $point) => [
                        'x' => (float) $point['x'],
                        'y' => (float) $point['y'],
                    ])
                    ->values()
                    ->all();
            })
            ->filter(fn (array $stroke) => count($stroke) > 1)
            ->values();

        $points = $normalizedStrokes->flatten(1);

        if ($points->isEmpty()) {
            return ['image' => null, 'text' => null];
        }

        $minX = (float) $points->min('x');
        $maxX = (float) $points->max('x');
        $minY = (float) $points->min('y');
        $maxY = (float) $points->max('y');
        $padding = 6;
        $viewBoxX = $minX - $padding;
        $viewBoxY = $minY - $padding;
        $viewBoxWidth = max($maxX - $minX + ($padding * 2), 1);
        $viewBoxHeight = max($maxY - $minY + ($padding * 2), 1);
        $polylines = $normalizedStrokes
            ->map(function (array $stroke) {
                $coordinates = collect($stroke)
                    ->map(fn (array $point) => sprintf('%.2f,%.2f', $point['x'], $point['y']))
                    ->implode(' ');

                return '<polyline points="'.$coordinates.'" />';
            })
            ->implode('');
        $svg = sprintf(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%.2f %.2f %.2f %.2f"><g fill="none" stroke="#17315F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">%s</g></svg>',
            $viewBoxX,
            $viewBoxY,
            $viewBoxWidth,
            $viewBoxHeight,
            $polylines
        );

        return [
            'image' => 'data:image/svg+xml;base64,'.base64_encode($svg),
            'text' => null,
        ];
    }
}
