<?php

namespace App\Services;

use App\Enums\AdditionalChargeResponsibility;
use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\BookingAdditionalCharge;
use App\Models\PayPalCheckout;
use App\Models\User;
use App\Support\BookingAgreement;
use App\Support\PayPalAppUrl;
use App\Support\PayPalCallbackUrl;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
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

    public function createOrder(User $user, array $data, ?string $bookingReference = null): array
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

        try {
            $booking = $bookingReference === null
                ? $this->bookingService->createAwaitingPayPalPayment($user, $data)
                : $this->bookingService->reviseAwaitingPayPalPayment($user, $data, $bookingReference);
        } catch (Throwable $exception) {
            if (! $exception instanceof ValidationException && ! $exception instanceof HttpExceptionInterface) {
                app(OperationalErrorService::class)->record('booking');
            }
            throw $exception;
        }
        $amount = $data['payment_option'] === 'full_payment'
            ? (float) $booking->total_amount
            : ceil((float) $booking->total_amount * BookingService::DOWN_PAYMENT_RATE);

        return $this->createCheckout(
            $user,
            $booking,
            $data['payment_option'],
            $amount,
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

        if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed, BookingStatus::Ongoing, BookingStatus::Returned], true)) {
            throw ValidationException::withMessages([
                'booking' => ['The outstanding balance can only be paid for a pending, confirmed, active, or returned booking.'],
            ]);
        }

        if ($booking->payment_status !== PaymentStatus::Partial || (float) $booking->remaining_balance <= 0) {
            throw ValidationException::withMessages([
                'booking' => ['This booking does not have an unsettled balance.'],
            ]);
        }

        if (in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true) && $booking->balance_due_at?->isPast()) {
            throw ValidationException::withMessages([
                'booking' => ['The payment deadline has passed. This booking is pending automatic cancellation.'],
            ]);
        }

        $hasOpenCheckout = $booking->paypalCheckouts()
            ->where('purpose', 'remaining_balance')
            ->whereNotIn('status', ['completed', 'failed', 'abandoned'])
            ->exists();

        if ($hasOpenCheckout) {
            throw ValidationException::withMessages([
                'booking' => ['A PayPal checkout for this remaining balance is already open.'],
            ]);
        }

        $chargeIds = $booking->additionalCharges()
            ->where('responsibility', AdditionalChargeResponsibility::Customer->value)
            ->outstanding()
            ->pluck('id')->all();

        return $this->createCheckout(
            $user,
            $booking,
            'remaining_balance',
            (float) $booking->remaining_balance,
            $callbacks['app_return_url'],
            $callbacks['app_cancel_url'],
            $chargeIds
        );
    }

    public function createDriverOutstandingOrder(User $user, string $bookingReference, array $callbacks): array
    {
        if (! $user->hasRole(DriverAssignmentService::DRIVER_ROLE)) {
            abort(403, 'Driver access is required.');
        }
        $booking = Booking::query()
            ->where(fn ($query) => $query->where('booking_code', $bookingReference)->orWhere('id', $bookingReference))
            ->firstOrFail();
        $charges = BookingAdditionalCharge::query()
            ->where('booking_id', $booking->id)
            ->where('responsible_user_id', $user->id)
            ->where('responsibility', AdditionalChargeResponsibility::Driver->value)
            ->outstanding()
            ->get();
        if ($charges->isEmpty()) {
            throw ValidationException::withMessages(['booking' => ['This service has no unpaid Driver-responsible charges.']]);
        }
        if ($booking->paypalCheckouts()->where('user_id', $user->id)->where('purpose', 'driver_outstanding')
            ->whereNotIn('status', ['completed', 'failed', 'abandoned'])->exists()) {
            throw ValidationException::withMessages(['booking' => ['A PayPal checkout for this Driver balance is already open.']]);
        }

        $charges->load('payments');

        return $this->createCheckout($user, $booking, 'driver_outstanding', (float) $charges->sum('outstanding_amount'),
            $callbacks['app_return_url'], $callbacks['app_cancel_url'], $charges->pluck('id')->all());
    }

    private function createCheckout(
        User $user,
        Booking $booking,
        string $paymentOption,
        float $amount,
        string $appReturnUrl,
        string $appCancelUrl,
        array $additionalChargeIds = []
    ): array {
        $currency = 'PHP';
        // Reserve the payment under the same booking lock used by charge edits.
        // The provider request happens after this short transaction commits.
        $checkout = DB::transaction(function () use ($booking, $user, $paymentOption, $amount, $currency, $additionalChargeIds) {
            $currentBooking = Booking::query()->lockForUpdate()->findOrFail($booking->id);
            if (in_array($paymentOption, ['full_payment', 'down_payment'], true)) {
                $currentBooking->load('payments');
                if (! $this->bookingService->canReviseUnpaidBooking($currentBooking)
                    || $currentBooking->rental_start_at->ne($booking->rental_start_at) || $currentBooking->rental_end_at->ne($booking->rental_end_at)
                    || $currentBooking->total_amount !== $booking->total_amount
                    || (int) $currentBooking->terms()->value('id') !== (int) $booking->terms?->id) {
                    throw ValidationException::withMessages(['booking' => ['The booking or payment changed. Review it again.']]);
                }
            }
            if (in_array($paymentOption, ['remaining_balance', 'driver_outstanding'], true)) {
                $charges = $currentBooking->additionalCharges()->where('responsible_user_id', $user->id)
                    ->where('responsibility', $paymentOption === 'remaining_balance' ? 'customer' : 'driver')
                    ->outstanding()->with('payments')->orderBy('id')->lockForUpdate()->get();
                $expectedIds = array_map('intval', $additionalChargeIds);
                sort($expectedIds);
                $currentAmount = $paymentOption === 'remaining_balance'
                    ? (float) $currentBooking->remaining_balance : (float) $charges->sum('outstanding_amount');
                if ($charges->modelKeys() !== $expectedIds || abs($currentAmount - $amount) >= 0.005 || $currentBooking->status->isTerminal()) {
                    throw ValidationException::withMessages(['booking' => ['The charges changed. Refresh the booking before paying.']]);
                }
                if ($currentBooking->paypalCheckouts()->where('user_id', $user->id)->where('purpose', $paymentOption)
                    ->whereNotIn('status', ['completed', 'failed', 'abandoned'])->exists()) {
                    throw ValidationException::withMessages(['booking' => ['A checkout for this balance is already open.']]);
                }
            }
            $checkout = PayPalCheckout::create([
                'booking_id' => $booking->id, 'user_id' => $user->id, 'payment_option' => $paymentOption,
                'amount' => $amount, 'currency' => $currency, 'status' => 'creating',
            ]);
            if ($additionalChargeIds !== []) {
                $allocations = BookingAdditionalCharge::query()->whereIn('id', $additionalChargeIds)->with('payments')->get()
                    ->mapWithKeys(fn (BookingAdditionalCharge $charge) => [$charge->id => ['amount' => $charge->outstanding_amount]])
                    ->filter(fn (array $allocation) => (float) $allocation['amount'] > 0)->all();
                $checkout->additionalCharges()->sync($allocations);
            }

            return $checkout;
        });

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
            // The provider may have accepted the request even when the response was lost.
            // Keep the attempt and booking for reconciliation instead of deleting evidence.
            app(OperationalErrorService::class)->record('payment_start', $booking->id);

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
            ->where('provider_order_id', $orderId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($checkout->status === 'completed') {
            return $this->loadBooking($checkout->booking_id);
        }

        if ($checkout->booking->status === BookingStatus::Pending &&
            ($checkout->booking->rental_end_at->lte(now()) ||
                ($checkout->payment_option === 'down_payment' && BookingAgreement::balanceDeadline($checkout->booking->rental_start_at)->lte(now())))) {
            throw ValidationException::withMessages(['booking' => ['This checkout expired. Review the booking and payment requirements again.']]);
        }
        if ($checkout->payment_option !== 'driver_outstanding' && $checkout->booking->status->isTerminal()) {
            throw ValidationException::withMessages(['booking' => ['This booking no longer accepts payment.']]);
        }
        if ($checkout->payment_option !== 'driver_outstanding' && $checkout->booking->status === BookingStatus::Confirmed
            && $checkout->booking->balance_due_at?->lte(now())) {
            throw ValidationException::withMessages(['booking' => ['The payment deadline has passed.']]);
        }

        if ($checkout->payment_option !== 'driver_outstanding') {
            $this->bookingService->assertCustomerAgeEligible($user);
        }

        if ($checkout->booking->status === BookingStatus::Pending) {
            $this->bookingService->assertVehicleScheduleAvailable(
                $checkout->booking->vehicle_id,
                $checkout->booking->rental_start_at,
                $checkout->booking->rental_end_at,
                $checkout->booking->id
            );
        }

        [$captureToken, $hadUncertainAttempt] = DB::transaction(function () use ($checkout) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($checkout->booking_id);
            $locked = PayPalCheckout::query()->lockForUpdate()->findOrFail($checkout->id);
            $staleCapture = $locked->status === 'capturing'
                && ($locked->capture_started_at ?? $locked->updated_at)->lte(now()->subMinutes(2));
            if (! in_array($locked->status, ['created', 'approved'], true) && ! $staleCapture) {
                throw ValidationException::withMessages(['paypal' => ['Payment confirmation is already in progress or unavailable. Try again shortly.']]);
            }
            if ($locked->payment_option !== 'driver_outstanding' && $booking->status->isTerminal()) {
                throw ValidationException::withMessages(['booking' => ['This booking no longer accepts payment.']]);
            }
            if ($booking->status === BookingStatus::Pending && ($booking->rental_end_at->lte(now())
                || ($locked->payment_option === 'down_payment' && BookingAgreement::balanceDeadline($booking->rental_start_at)->lte(now())))) {
                throw ValidationException::withMessages(['booking' => ['This checkout expired. Review the booking and payment requirements again.']]);
            }
            if ($locked->payment_option !== 'driver_outstanding' && $booking->status === BookingStatus::Confirmed
                && $booking->balance_due_at?->lte(now())) {
                throw ValidationException::withMessages(['booking' => ['The payment deadline has passed.']]);
            }
            if ($booking->status === BookingStatus::Pending) {
                $booking->vehicle()->lockForUpdate()->firstOrFail();
                $this->bookingService->assertVehicleScheduleAvailable($booking->vehicle_id, $booking->rental_start_at, $booking->rental_end_at, $booking->id);
            }
            $hadUncertainAttempt = $locked->status !== 'created';
            $firstAttempt = $locked->capture_first_started_at ?? ($hadUncertainAttempt ? $locked->created_at : now());
            if ($hadUncertainAttempt && $firstAttempt->lte(now()->subHours(5))) {
                throw ValidationException::withMessages(['paypal' => ['This payment needs review. Contact JamJade before trying again.']]);
            }
            $token = (string) Str::uuid();
            $locked->update(['status' => 'capturing', 'capture_attempt_token' => $token, 'capture_started_at' => now(),
                'capture_first_started_at' => $firstAttempt]);

            return [$token, $hadUncertainAttempt];
        });

        try {
            $captureResponse = $this->payPalClient->captureOrder(
                $orderId,
                "jamjade-capture-{$checkout->id}"
            );
        } catch (RequestException $exception) {
            if ($this->isOrderNotApproved($exception) && ! $hadUncertainAttempt) {
                $this->updateCaptureAttempt($checkout->id, $captureToken, [
                    'status' => 'failed', 'provider_response' => json_encode($exception->response->json()), 'failed_at' => now(),
                ]);

                throw ValidationException::withMessages([
                    'paypal' => ['PayPal payment was not approved. Review your booking before trying again.'],
                ]);
            }

            if ($this->updateCaptureAttempt($checkout->id, $captureToken, ['status' => 'approved'])) {
                app(OperationalErrorService::class)->record('payment', $checkout->booking_id);
            }
            throw $exception;
        } catch (Throwable $exception) {
            if ($this->updateCaptureAttempt($checkout->id, $captureToken, ['status' => 'approved'])) {
                app(OperationalErrorService::class)->record('payment', $checkout->booking_id);
            }
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
            if ($this->updateCaptureAttempt($checkout->id, $captureToken, [
                'status' => 'approved', 'provider_response' => json_encode($captureResponse),
            ])) {
                app(OperationalErrorService::class)->record('payment', $checkout->booking_id);
            }

            throw ValidationException::withMessages([
                'paypal' => ['PayPal did not return a completed PHP capture for the expected amount.'],
            ]);
        }

        return DB::transaction(function () use ($checkout, $captureResponse, $captureId, $user, $captureToken) {
            $booking = Booking::query()->lockForUpdate()->findOrFail($checkout->booking_id);
            $lockedCheckout = PayPalCheckout::query()
                ->lockForUpdate()
                ->findOrFail($checkout->id);

            if ($lockedCheckout->status === 'completed') {
                return $this->loadBooking($lockedCheckout->booking_id);
            }

            if ($lockedCheckout->capture_attempt_token !== $captureToken || $lockedCheckout->status !== 'capturing') {
                throw ValidationException::withMessages(['paypal' => ['Payment confirmation changed. Retry confirmation.']]);
            }
            $lockedCheckout->load('additionalCharges');
            if ($lockedCheckout->payment_option !== 'driver_outstanding' && $booking->status->isTerminal()) {
                throw ValidationException::withMessages(['booking' => ['This booking no longer accepts payment. Contact Jamjade to reconcile any provider payment.']]);
            }

            if ($lockedCheckout->payment_option === 'driver_outstanding') {
                $chargeIds = $lockedCheckout->additionalCharges->pluck('id');
                $charges = BookingAdditionalCharge::query()->whereIn('id', $chargeIds)->lockForUpdate()->get();
                $charges->load('payments');
                $expected = (float) $charges->where('responsible_user_id', $user->id)
                    ->filter(fn (BookingAdditionalCharge $charge) => $charge->payment_status !== PaymentStatus::Paid)
                    ->sum('outstanding_amount');
                if ($this->formatAmount($expected) !== $this->formatAmount((float) $lockedCheckout->amount)) {
                    throw ValidationException::withMessages(['paypal' => ['The Driver outstanding balance changed before capture.']]);
                }
                $lockedCheckout->update([
                    'paypal_capture_id' => $captureId, 'status' => 'completed',
                    'paypal_response' => $captureResponse, 'captured_at' => now(),
                ]);
                $this->notificationService->createForUser($user, 'payment', 'Driver balance paid',
                    "Your Driver-responsible balance for booking {$booking->booking_code} was paid.", [
                        'booking_id' => $booking->id, 'priority' => 'success', 'action' => 'view_service', 'action_label' => 'View Service',
                    ]);
                activity()->causedBy($user)->performedOn($booking)->event('driver_additional_charge_payment_captured')
                    ->withProperties(['paypal_capture_id' => $captureId, 'amount' => (float) $lockedCheckout->amount])->log('Driver additional-charge balance paid.');

                return $this->loadBooking($booking->id);
            }
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
            $paidAfterCapture = (float) $booking->successfulPayments()->sum('amount') + $amount;
            $paymentStatus = $paidAfterCapture >= (float) $booking->total_amount
                ? PaymentStatus::Paid
                : PaymentStatus::Partial;
            $remainingBalance = max((float) $booking->total_amount - $paidAfterCapture, 0);
            $balanceDueAt = $paymentStatus === PaymentStatus::Partial && in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)
                ? ($booking->balance_due_at ?? BookingAgreement::balanceDeadline($booking->rental_start_at))
                : null;

            $booking->update([
                'status' => $wasPending ? BookingStatus::Confirmed : $booking->status,
                'payment_status' => $paymentStatus,
                'remaining_balance' => $remainingBalance,
                'balance_due_at' => $balanceDueAt,
                'balance_reminder_sent_at' => null,
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
                $booking->events()->create([
                    'event_type' => 'status_changed',
                    'old_status' => BookingStatus::Pending,
                    'new_status' => BookingStatus::Confirmed,
                    'actor_user_id' => $user->id,
                    'reason' => 'Booking automatically confirmed after successful PayPal payment.',
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
                    ->log('Booking automatically confirmed after payment.');
            }

            $this->notificationService->createForCustomerPayment($booking, $lockedCheckout, $wasPending);

            $this->bookingEmailService->queueForPayment($lockedCheckout);

            return $this->loadBooking($booking->id);
        });
    }

    public function abandonOrder(User $user, string $orderId): void
    {
        $checkout = PayPalCheckout::query()
            ->with('booking')
            ->where('provider_order_id', $orderId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($checkout->status === 'completed') {
            throw ValidationException::withMessages([
                'paypal' => ['A completed PayPal checkout cannot be abandoned.'],
            ]);
        }

        DB::transaction(function () use ($checkout) {
            Booking::query()->lockForUpdate()->findOrFail($checkout->booking_id);
            $locked = PayPalCheckout::query()->lockForUpdate()->findOrFail($checkout->id);
            if ($locked->status === 'abandoned') {
                return;
            }
            if ($locked->status !== 'created') {
                throw ValidationException::withMessages(['paypal' => ['This payment needs review before it can be abandoned.']]);
            }
            if (in_array($locked->payment_option, ['down_payment', 'full_payment'], true)) {
                $locked->update(['status' => 'abandoned']);
            } else {
                $locked->delete();
            }
        });
    }

    private function updateCaptureAttempt(int $checkoutId, string $token, array $attributes): bool
    {
        return PayPalCheckout::query()->whereKey($checkoutId)->where('status', 'capturing')
            ->where('capture_attempt_token', $token)->update($attributes) > 0;
    }

    private function loadBooking(int $bookingId): Booking
    {
        return Booking::query()
            ->with([
                'vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'assignedDriver',
                'assignment', 'terms', 'confirmationEmail', 'events',
            ])
            ->findOrFail($bookingId);
    }

    private function formatAmount(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }

    private function isOrderNotApproved(RequestException $exception): bool
    {
        return $exception->response->status() === 422
            && data_get($exception->response->json(), 'details.0.issue') === 'ORDER_NOT_APPROVED';
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
        return PayPalCallbackUrl::to(
            route($routeName, ['target' => PayPalAppUrl::encode($appUrl)], false),
            app()->bound('request') ? request() : null,
        );
    }
}
