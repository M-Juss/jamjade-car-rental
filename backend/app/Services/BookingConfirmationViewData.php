<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Models\Booking;
use App\Models\Payment;
use Carbon\CarbonInterface;
use Illuminate\Support\Str;
use JsonException;

class BookingConfirmationViewData
{
    public function make(Booking $booking, ?CarbonInterface $issuedAt = null, ?Payment $payment = null): array
    {
        $booking->loadMissing(['user.customerProfile', 'vehicle', 'assignedDriver', 'terms', 'deliveryQuote']);

        $latestPayment = $payment ?? $booking->successfulCustomerPayments()->orderByDesc('completed_at')->orderByDesc('id')->first();
        $totalAmount = (float) $booking->total_amount;
        $totalCents = (int) round($totalAmount * 100);
        $paidCents = (int) round((float) $booking->successfulCustomerPayments()->sum('amount') * 100);
        $amountPaid = (float) ($paidCents / 100);
        $isFullyPaid = $totalCents > 0 && $paidCents >= $totalCents;
        $remainingCents = max($totalCents - $paidCents, 0);
        $remainingBalance = $remainingCents === 0 ? 0 : (float) ($remainingCents / 100);
        $profile = $booking->user?->customerProfile;
        $profileName = trim(implode(' ', array_filter([
            $profile?->first_name,
            $profile?->last_name,
        ])));
        $customerName = $profileName !== ''
            ? $profileName
            : ($booking->user?->name ?: 'Renter');
        $signature = $this->signature($booking->customer_signature);
        $items = [['label' => 'Rental Subtotal', 'amount' => (float) $booking->subtotal]];
        foreach ([
            'add_ons_total' => 'Add-ons', 'delivery_fee' => 'Delivery Fee',
            'delivery_toll_fee' => 'Delivery Toll', 'owner_driver_fee' => "Owner's Driver Fee",
        ] as $field => $label) {
            if ((float) $booking->{$field} > 0) {
                $items[] = ['label' => $label, 'amount' => (float) $booking->{$field}];
            }
        }
        $charges = $booking->additionalCharges()->without('payments')
            ->where('responsibility', AdditionalChargeResponsibility::Customer->value)
            ->where('responsible_user_id', $booking->user_id)->orderBy('id')->get();
        foreach ($charges as $charge) {
            $items[] = ['label' => $charge->type->label().': '.$charge->description, 'amount' => (float) $charge->amount];
        }
        if ((float) $booking->discount_total > 0) {
            $items[] = ['label' => 'Discount', 'amount' => -(float) $booking->discount_total];
        }
        $paymentLabel = $isFullyPaid ? 'Fully Paid' : ($amountPaid > 0 ? 'Partially Paid' : 'Unpaid');

        return [
            'agreementVersion' => $booking->terms_version,
            'additionalChargeItems' => $charges->map(fn ($charge) => ['label' => $charge->type->label().': '.$charge->description, 'amount' => (float) $charge->amount])->all(),
            'lateReturnPolicy' => $booking->terms?->late_return_policy,
            'issuedAt' => ($issuedAt ?? now())->toISOString(),
            'balanceDueAt' => $remainingBalance > 0 ? $booking->balance_due_at?->toISOString() : null,
            'createdAt' => $booking->created_at?->toISOString(),
            'termsAcceptedAt' => $booking->terms_accepted_at?->toISOString(),
            'formatVersion' => 3,
            'currentDeliveryTerms' => $booking->deliveryQuote !== null || $booking->terms_version >= '2026-10-12',
            'bookingReference' => $booking->booking_code ?: (string) $booking->id,
            'bookingStatusLabel' => $booking->status?->mobileLabel()
                ?? Str::headline((string) $booking->status),
            'bookingStatusClass' => match ($booking->status?->value) {
                'confirmed', 'ongoing', 'completed' => 'status-success',
                'pending' => 'status-warning',
                default => 'status-neutral',
            },
            'paymentStatusLabel' => $paymentLabel,
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
            'rental' => [
                'startAt' => $booking->rental_start_at?->toISOString(),
                'endAt' => $booking->rental_end_at?->toISOString(),
                'days' => (int) $booking->duration_days,
                'pickupType' => $booking->pickup_location_type,
                'pickupLocation' => $booking->pickup_location,
                'returnLocation' => $booking->return_location,
                'driverOption' => $booking->rental_type?->label(),
                'coverage' => $booking->owner_driver_coverage,
            ],
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
                'pricePerDay' => (float) $booking->price_per_day,
                'items' => $items,
                'method' => $latestPayment?->payment_method,
                'transactionId' => $latestPayment?->transaction_id,
                'paidAt' => $latestPayment?->paid_at?->toISOString(),
            ],
            'receipt' => $latestPayment ? [
                'reference' => 'RCP-'.str_pad((string) $latestPayment->id, 5, '0', STR_PAD_LEFT),
                'amount' => (float) $latestPayment->amount,
                'paidAt' => $latestPayment->paid_at?->toISOString(),
                'method' => $latestPayment->payment_method,
                'transactionId' => $latestPayment->transaction_id,
                'purpose' => match ($latestPayment->purpose) {
                    'down_payment' => 'Down Payment',
                    'full_payment' => 'Full Payment',
                    'remaining_balance' => 'Remaining Balance',
                    'customer_outstanding' => 'Customer Additional Charges',
                    default => 'Booking Payment',
                },
            ] : null,
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
