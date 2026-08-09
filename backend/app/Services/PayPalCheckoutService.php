<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\PayPalCheckout;
use App\Models\User;
use App\Support\PayPalAppUrl;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class PayPalCheckoutService
{
    private const BOOKING_TIMEZONE = 'Asia/Manila';

    private const DOWN_PAYMENT_MINIMUM_LEAD_DAYS = 2;

    public function __construct(
        private readonly BookingService $bookingService,
        private readonly PayPalClient $payPalClient,
        private readonly NotificationService $notificationService,
        private readonly BookingEmailService $bookingEmailService
    ) {}

    public function createOrder(User $user, array $data): array
    {
        $today = CarbonImmutable::now(self::BOOKING_TIMEZONE)->startOfDay();
        $rentalStartDate = CarbonImmutable::parse(
            $data['rental_start_at'],
            self::BOOKING_TIMEZONE
        )->startOfDay();

        if (
            $data['payment_option'] === 'down_payment' &&
            $rentalStartDate->lessThan($today->addDays(self::DOWN_PAYMENT_MINIMUM_LEAD_DAYS))
        ) {
            throw ValidationException::withMessages([
                'payment_option' => [
                    'Down payment is available only when the rental date is at least two days from today.',
                ],
            ]);
        }

        $booking = $this->bookingService->createAwaitingPayPalPayment($user, $data);
        $amount = $data['payment_option'] === 'full_payment'
            ? (float) $booking->total_amount
            : ceil((float) $booking->total_amount * BookingService::DOWN_PAYMENT_RATE);

        return $this->createCheckout(
            $user,
            $booking,
            $data['payment_option'],
            $amount,
            true,
            $data['app_return_url'],
            $data['app_cancel_url']
        );
    }

    public function createBalanceOrder(User $user, string $bookingReference, array $callbacks): array
    {
        $booking = Booking::query()
            ->where('user_id', $user->id)
            ->where(fn ($query) => $query
                ->where('booking_code', $bookingReference)
                ->orWhere('id', $bookingReference))
            ->firstOrFail();

        if (! in_array($booking->status->value, ['pending', 'confirmed'], true)) {
            throw ValidationException::withMessages([
                'booking' => ['The remaining balance can only be paid for a pending or approved booking.'],
            ]);
        }

        if ($booking->payment_status !== PaymentStatus::Partial || (float) $booking->remaining_balance <= 0) {
            throw ValidationException::withMessages([
                'booking' => ['This booking does not have an unsettled balance.'],
            ]);
        }

        if ($booking->balance_due_at?->isPast()) {
            throw ValidationException::withMessages([
                'booking' => ['The payment deadline has passed. This booking is pending automatic cancellation.'],
            ]);
        }

        $hasOpenCheckout = $booking->paypalCheckouts()
            ->where('payment_option', 'remaining_balance')
            ->whereNotIn('status', ['completed', 'failed'])
            ->exists();

        if ($hasOpenCheckout) {
            throw ValidationException::withMessages([
                'booking' => ['A PayPal checkout for this remaining balance is already open.'],
            ]);
        }

        return $this->createCheckout(
            $user,
            $booking,
            'remaining_balance',
            (float) $booking->remaining_balance,
            false,
            $callbacks['app_return_url'],
            $callbacks['app_cancel_url']
        );
    }

    private function createCheckout(
        User $user,
        Booking $booking,
        string $paymentOption,
        float $amount,
        bool $deleteBookingOnFailure,
        string $appReturnUrl,
        string $appCancelUrl
    ): array {
        $currency = 'PHP';
        $checkout = PayPalCheckout::create([
            'booking_id' => $booking->id,
            'user_id' => $user->id,
            'payment_option' => $paymentOption,
            'amount' => $amount,
            'currency' => $currency,
            'status' => 'creating',
        ]);

        try {
            $order = $this->payPalClient->createOrder([
                'intent' => 'CAPTURE',
                'purchase_units' => [[
                    'reference_id' => $booking->booking_code,
                    'custom_id' => (string) $checkout->id,
                    'description' => "JamJade booking {$booking->booking_code}",
                    'amount' => [
                        'currency_code' => $currency,
                        'value' => $this->formatAmount($amount),
                    ],
                ]],
                'payment_source' => [
                    'paypal' => [
                        'experience_context' => [
                            'brand_name' => 'JamJade Car Rental',
                            'shipping_preference' => 'NO_SHIPPING',
                            'user_action' => 'PAY_NOW',
                            'return_url' => $this->returnUrl($appReturnUrl),
                            'cancel_url' => $this->cancelUrl($appCancelUrl),
                        ],
                    ],
                ],
            ], "jamjade-create-{$checkout->id}");

            $orderId = $order['id'] ?? null;
            $approvalUrl = collect($order['links'] ?? [])
                ->firstWhere('rel', 'payer-action')['href'] ?? null;
            $approvalUrl ??= collect($order['links'] ?? [])
                ->firstWhere('rel', 'approve')['href'] ?? null;

            if (! is_string($orderId) || $orderId === '' || ! is_string($approvalUrl) || $approvalUrl === '') {
                throw new RuntimeException('PayPal did not return an order approval URL.');
            }

            $checkout->update([
                'paypal_order_id' => $orderId,
                'status' => 'created',
                'approval_url' => $approvalUrl,
                'paypal_response' => $order,
            ]);
        } catch (Throwable $exception) {
            DB::transaction(function () use ($checkout, $booking, $deleteBookingOnFailure) {
                $checkout->delete();

                if ($deleteBookingOnFailure) {
                    $booking->forceDelete();
                }
            });

            throw $exception;
        }

        return [
            'checkoutId' => $checkout->id,
            'orderId' => $checkout->paypal_order_id,
            'approvalUrl' => $checkout->approval_url,
            'amount' => (float) $checkout->amount,
            'currency' => $checkout->currency,
            'bookingCode' => $booking->booking_code,
        ];
    }

    public function captureOrder(User $user, string $orderId): Booking
    {
        $checkout = PayPalCheckout::query()
            ->with('booking')
            ->where('paypal_order_id', $orderId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($checkout->status === 'completed') {
            return $this->loadBooking($checkout->booking_id);
        }

        $this->bookingService->assertCustomerAgeEligible($user);

        if ($checkout->booking->status === BookingStatus::Pending) {
            $this->bookingService->assertVehicleScheduleAvailable(
                $checkout->booking->vehicle_id,
                $checkout->booking->rental_start_at,
                $checkout->booking->rental_end_at,
                $checkout->booking->id
            );
        }

        $checkout->update(['status' => 'capturing']);

        try {
            $captureResponse = $this->payPalClient->captureOrder(
                $orderId,
                "jamjade-capture-{$checkout->id}"
            );
        } catch (Throwable $exception) {
            $checkout->update(['status' => 'approved']);
            throw $exception;
        }

        $capture = data_get($captureResponse, 'purchase_units.0.payments.captures.0');
        $captureId = data_get($capture, 'id');
        $captureStatus = data_get($capture, 'status');
        $capturedCurrency = data_get($capture, 'amount.currency_code');
        $capturedAmount = data_get($capture, 'amount.value');

        if (
            data_get($captureResponse, 'status') !== 'COMPLETED' ||
            $captureStatus !== 'COMPLETED' ||
            ! is_string($captureId) ||
            $capturedCurrency !== 'PHP' ||
            $this->formatAmount((float) $capturedAmount) !== $this->formatAmount((float) $checkout->amount)
        ) {
            $checkout->update([
                'status' => 'failed',
                'paypal_response' => $captureResponse,
            ]);

            throw ValidationException::withMessages([
                'paypal' => ['PayPal did not return a completed PHP capture for the expected amount.'],
            ]);
        }

        return DB::transaction(function () use ($checkout, $captureResponse, $captureId, $user) {
            $lockedCheckout = PayPalCheckout::query()
                ->lockForUpdate()
                ->findOrFail($checkout->id);

            if ($lockedCheckout->status === 'completed') {
                return $this->loadBooking($lockedCheckout->booking_id);
            }

            $booking = Booking::query()->lockForUpdate()->findOrFail($lockedCheckout->booking_id);
            $wasPending = $booking->status === BookingStatus::Pending;

            if ($wasPending) {
                $booking->vehicle()->lockForUpdate()->firstOrFail();
                $this->bookingService->assertVehicleScheduleAvailable(
                    $booking->vehicle_id,
                    $booking->rental_start_at,
                    $booking->rental_end_at,
                    $booking->id
                );
            }

            $amount = (float) $lockedCheckout->amount;
            $paidAfterCapture = (float) $booking->payments()->sum('amount') + $amount;
            $paymentStatus = $paidAfterCapture >= (float) $booking->total_amount
                ? PaymentStatus::Paid
                : PaymentStatus::Partial;
            $remainingBalance = max((float) $booking->total_amount - $paidAfterCapture, 0);
            $balanceDueAt = $paymentStatus === PaymentStatus::Partial
                ? $booking->rental_start_at->copy()->subDay()
                : null;

            Payment::create([
                'booking_id' => $booking->id,
                'user_id' => $booking->user_id,
                'payment_method' => 'PayPal',
                'payment_status' => $paymentStatus,
                'amount' => $amount,
                'transaction_id' => $captureId,
                'paid_at' => now(),
            ]);

            $booking->update([
                'status' => $wasPending ? BookingStatus::Confirmed : $booking->status,
                'payment_status' => $paymentStatus,
                'down_payment_amount' => $paidAfterCapture,
                'remaining_balance' => $remainingBalance,
                'balance_due_at' => $balanceDueAt,
                'balance_reminder_sent_at' => null,
                'confirmed_at' => $wasPending ? now() : $booking->confirmed_at,
            ]);

            $lockedCheckout->update([
                'paypal_capture_id' => $captureId,
                'status' => 'completed',
                'paypal_response' => $captureResponse,
                'captured_at' => now(),
            ]);

            activity()
                ->causedBy($user)
                ->performedOn($booking)
                ->event('paypal_payment_captured')
                ->withProperties([
                    'paypal_order_id' => $lockedCheckout->paypal_order_id,
                    'paypal_capture_id' => $captureId,
                    'amount' => $amount,
                    'currency' => 'PHP',
                ])
                ->log('PayPal payment captured for booking.');

            if ($wasPending) {
                $booking->statusLogs()->create([
                    'old_status' => BookingStatus::Pending,
                    'new_status' => BookingStatus::Confirmed,
                    'changed_by' => $user->id,
                    'reason' => 'Booking automatically approved after successful PayPal payment.',
                ]);

                activity()
                    ->causedBy($user)
                    ->performedOn($booking)
                    ->event('booking_status_changed')
                    ->withProperties([
                        'old_status' => BookingStatus::Pending->value,
                        'new_status' => BookingStatus::Confirmed->value,
                        'reason' => 'Successful PayPal payment.',
                    ])
                    ->log('Booking automatically approved after payment.');

                $this->notificationService->createForBooking(
                    $booking,
                    'booking',
                    'Booking approved',
                    "Booking {$booking->booking_code} was automatically approved after payment.",
                    [
                        'priority' => 'success',
                        'action_label' => 'View Booking',
                        'action' => 'view_booking',
                    ]
                );
            }

            $this->notificationService->createForBooking(
                $booking,
                'payment',
                $paymentStatus === PaymentStatus::Paid ? 'Payment completed' : 'Down payment received',
                sprintf(
                    'PayPal payment of PHP %s was recorded for booking %s.',
                    number_format($amount, 2),
                    $booking->booking_code
                ),
                [
                    'priority' => 'success',
                    'action_label' => 'View Booking',
                    'action' => 'view_booking',
                    'amount' => $amount,
                    'payment_status' => $paymentStatus->value,
                ]
            );

            if ($paymentStatus === PaymentStatus::Partial) {
                $this->notificationService->createForBooking(
                    $booking,
                    'payment',
                    'Remaining balance scheduled',
                    sprintf(
                        'PHP %s is due by %s. If unpaid, the booking will be cancelled and the down payment is non-refundable.',
                        number_format($remainingBalance, 2),
                        $balanceDueAt->format('F j, Y - g:i A')
                    ),
                    [
                        'priority' => 'warning',
                        'action_label' => 'Pay Remaining Balance',
                        'action' => 'pay_balance',
                        'remaining_balance' => $remainingBalance,
                        'due_at' => $balanceDueAt->toISOString(),
                        'non_refundable' => true,
                    ]
                );
            }

            $bookingId = $booking->id;

            DB::afterCommit(function () use ($bookingId) {
                $booking = Booking::query()->find($bookingId);

                if ($booking) {
                    $this->bookingEmailService->sendBookingConfirmation($booking);
                }
            });

            return $this->loadBooking($booking->id);
        });
    }

    public function abandonOrder(User $user, string $orderId): void
    {
        $checkout = PayPalCheckout::query()
            ->with('booking')
            ->where('paypal_order_id', $orderId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($checkout->status === 'completed') {
            throw ValidationException::withMessages([
                'paypal' => ['A completed PayPal checkout cannot be abandoned.'],
            ]);
        }

        DB::transaction(function () use ($checkout) {
            $booking = $checkout->booking;
            $isInitialCheckout = $checkout->payment_option !== 'remaining_balance';

            $checkout->delete();

            if ($isInitialCheckout && $booking && ! $booking->payments()->exists()) {
                $booking->forceDelete();
            }
        });
    }

    private function loadBooking(int $bookingId): Booking
    {
        return Booking::query()
            ->with(['vehicle.images', 'vehicle.features', 'payments', 'user.documents'])
            ->findOrFail($bookingId);
    }

    private function formatAmount(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }

    private function returnUrl(string $appUrl): string
    {
        return $this->configuredUrl('return_url')
            ?? $this->requestCallbackUrl('paypal.return', $appUrl);
    }

    private function cancelUrl(string $appUrl): string
    {
        return $this->configuredUrl('cancel_url')
            ?? $this->requestCallbackUrl('paypal.cancel', $appUrl);
    }

    private function configuredUrl(string $key): ?string
    {
        $url = trim((string) config("services.paypal.{$key}"));

        return $url !== '' ? $url : null;
    }

    private function requestCallbackUrl(string $routeName, string $appUrl): string
    {
        if (app()->bound('request')) {
            return request()->getSchemeAndHttpHost().route(
                $routeName,
                ['target' => PayPalAppUrl::encode($appUrl)],
                false
            );
        }

        return route($routeName, ['target' => PayPalAppUrl::encode($appUrl)]);
    }
}
