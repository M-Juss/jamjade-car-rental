<?php

namespace App\Services;

use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\CustomerDocument;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    public function paginateForUser(User $user, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return Notification::query()
            ->with('booking.vehicle')
            ->where('user_id', $user->id)
            ->when($filters['booking_code'] ?? null, fn ($query, string $code) => $query->whereHas('booking', fn ($booking) => $booking->where('booking_code', $code)))
            ->when($filters['category'] ?? null, fn ($query, string $category) => $query->where('category', $category))
            ->latest()
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function cursorForUser(User $user, array $filters, int $perPage, ?string $cursor): CursorPaginator
    {
        return Notification::query()
            ->with('booking.vehicle')
            ->where('user_id', $user->id)
            ->when($filters['booking_code'] ?? null, fn ($query, string $code) => $query->whereHas('booking', fn ($booking) => $booking->where('booking_code', $code)))
            ->when($filters['category'] ?? null, fn ($query, string $category) => $query->where('category', $category))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->cursorPaginate($perPage, ['*'], 'cursor', Cursor::fromEncoded($cursor));
    }

    public function unreadCount(User $user, ?string $bookingCode = null): int
    {
        return Notification::query()->where('user_id', $user->id)->whereNull('read_at')
            ->when($bookingCode, fn ($query, string $code) => $query->whereHas('booking', fn ($booking) => $booking->where('booking_code', $code)))
            ->count();
    }

    public function createForBooking(Booking $booking, string $category, string $title, string $message, array $data = []): Notification
    {
        return $this->createForUser($booking->user, $category, $title, $message, [
            'booking_id' => $booking->id,
            ...$data,
        ]);
    }

    public function createForTelematicsParticipants(Booking $booking, string $title, string $message, array $data = []): Notification
    {
        $notification = $this->createForBooking($booking, 'trip', $title, $message, $data);
        if ($booking->rental_type === RentalType::OwnersDriver && $booking->assignedDriver) {
            $this->createForUser($booking->assignedDriver, 'trip', $title, $message, [
                'booking_id' => $booking->id,
                ...$data,
            ]);
        }

        return $notification;
    }

    public function createForUser(User $user, string $category, string $title, string $message, array $data = []): Notification
    {
        return Notification::create([
            'user_id' => $user->id,
            'booking_id' => $data['booking_id'] ?? null,
            'type' => 'booking',
            'category' => $category,
            'priority' => $data['priority'] ?? 'normal',
            'title' => $title,
            'message' => $message,
            'full_message' => $data['full_message'] ?? $message,
            'data' => $data,
            'action_label' => $data['action_label'] ?? null,
        ]);
    }

    public function createForCustomerPayment(Booking $booking, Payment $payment, bool $bookingConfirmed = false): Notification
    {
        $hasBalance = $booking->payment_status === PaymentStatus::Partial;
        $title = $bookingConfirmed ? 'Booking confirmed' : ($hasBalance ? 'Payment received' : 'Payment completed');
        $message = sprintf('PHP %s received for booking %s.', number_format((float) $payment->amount, 2), $booking->booking_code);
        $details = $bookingConfirmed ? "Booking {$booking->booking_code} is confirmed. {$message}" : $message;
        $data = [
            'priority' => 'success',
            'action_label' => $hasBalance ? 'Pay Remaining Balance' : 'View Booking',
            'action' => $hasBalance ? 'pay_balance' : 'view_booking',
            'payment_id' => $payment->id,
            'amount' => (float) $payment->amount,
            'payment_status' => $booking->payment_status->value,
            'remaining_balance' => (float) $booking->remaining_balance,
        ];

        if ($hasBalance) {
            $balance = sprintf('Remaining balance: PHP %s', number_format((float) $booking->remaining_balance, 2));
            if ($booking->balance_due_at) {
                $dueAt = $booking->balance_due_at->copy()->timezone('Asia/Manila');
                $balance .= ' due by '.$dueAt->format('F j, Y - g:i A');
                $data['due_at'] = $dueAt->toISOString();
                $data['non_refundable'] = true;
            }
            $message .= " {$balance}.";
            $details .= " {$balance}.";
            if ($booking->balance_due_at) {
                $details .= ' If unpaid by the deadline, the booking will be cancelled and the down payment is non-refundable.';
            }
        } else {
            $message .= ' Fully paid.';
            $details .= ' The booking is fully paid.';
        }

        return $this->createForBooking($booking, 'payment', $title, $message, [
            ...$data,
            'full_message' => $details,
        ]);
    }

    public function notifyPaymentDocumentsSent(Booking $booking, int $paymentId, bool $legacyInvoice = false): void
    {
        DB::transaction(function () use ($booking, $paymentId, $legacyInvoice) {
            $notification = Notification::query()
                ->where('user_id', $booking->user_id)
                ->where('booking_id', $booking->id)
                ->where('data->payment_id', $paymentId)
                ->lockForUpdate()->first();
            $message = $legacyInvoice
                ? 'Your invoice, rental agreement, and payment receipt were sent to your email.'
                : 'Your rental information, rental agreement, and payment receipt were sent to your email.';

            if ($notification) {
                if (! ($notification->data['documents_sent'] ?? false)) {
                    $details = "{$notification->full_message} {$message}";
                    $notification->update([
                        'full_message' => $details,
                        'data' => [...$notification->data, 'full_message' => $details, 'documents_sent' => true, 'print_required' => true],
                    ]);
                }

                return;
            }

            $this->createForBooking($booking, 'payment', $legacyInvoice ? 'Invoice and receipt sent' : 'Rental information and receipt sent', $message, [
                'priority' => 'success', 'action_label' => 'View Booking', 'action' => 'view_booking',
                'payment_id' => $paymentId, 'documents_sent' => true, 'print_required' => true,
            ]);
        });
    }

    public function createForDocument(
        CustomerDocument $document,
        string $title,
        string $message,
        array $data = []
    ): Notification {
        return Notification::create([
            'user_id' => $document->user_id,
            'customer_document_id' => $document->id,
            'type' => 'document_verification',
            'category' => 'system',
            'priority' => $data['priority'] ?? 'normal',
            'title' => $title,
            'message' => $message,
            'full_message' => $data['full_message'] ?? $message,
            'data' => [
                ...$data,
                'action' => $data['action'] ?? 'view_documents',
                'documentId' => $document->id,
                'documentType' => $document->document_type,
                'documentStatus' => $document->status->value,
            ],
            'action_label' => $data['action_label'] ?? 'View Documents',
        ]);
    }

    public function markAsRead(Notification $notification, User $user): Notification
    {
        abort_unless($notification->user_id === $user->id, 403);

        $notification->forceFill(['read_at' => now()])->save();

        return $notification->fresh('booking.vehicle');
    }

    public function markAllAsRead(User $user, ?string $bookingCode = null): int
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->when($bookingCode, fn ($query, string $code) => $query->whereHas('booking', fn ($booking) => $booking->where('booking_code', $code)))
            ->update(['read_at' => now()]);
    }
}
