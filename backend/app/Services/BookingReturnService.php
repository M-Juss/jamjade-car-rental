<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingReturnService
{
    public function estimate(Booking $booking): array
    {
        $booking->loadMissing(['terms', 'returnRecord']);
        $receipt = $booking->returnRecord;
        $stop = $receipt?->vehicle_received_at;
        $active = $booking->status === BookingStatus::Ongoing;
        $seconds = ($active || $stop) && $booking->rental_end_at
            ? max(0, $booking->rental_end_at->diffInSeconds($stop ?? now(), false)) : 0;
        $hours = $seconds > 0 ? max(1, intdiv((int) $seconds, 3600) + (fmod($seconds, 3600) > 1800 ? 1 : 0)) : 0;
        $policy = $booking->terms?->late_return_policy;

        return [
            'vehicleReceivedAt' => $stop?->toISOString(),
            'expectedReturnAt' => $receipt?->expected_return_at?->toISOString(),
            'elapsedMinutes' => (int) ceil($seconds / 60),
            'billableHours' => $hours,
            'hourlyRate' => $policy['hourlyRate'] ?? null,
            'seatBracket' => $policy['seatBracket'] ?? null,
            'estimatedAmount' => $policy ? round($hours * $policy['hourlyRate'], 2) : null,
            'policy' => $policy,
            'requiresManualPricing' => $policy === null,
            'reviewedAt' => $receipt?->late_charge_reviewed_at?->toISOString(),
            'approvedAmount' => $receipt?->approved_late_charge === null ? null : (float) $receipt->approved_late_charge,
        ];
    }

    public function receive(Booking $booking, User $actor, string $receivedAt): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $receivedAt) {
            $booking = Booking::lockForUpdate()->findOrFail($booking->id);
            $this->assertOngoing($booking);
            $time = CarbonImmutable::parse($receivedAt)->utc()->startOfSecond();
            if ($time->isFuture() || $time->lt($booking->started_at ?? $booking->rental_start_at)) {
                throw ValidationException::withMessages(['vehicle_received_at' => ['Received time must be between rental release and the current time.']]);
            }
            $record = $booking->returnRecord()->firstOrCreate([]);
            if ($record->vehicle_received_at) {
                if (! $record->vehicle_received_at->equalTo($time)) {
                    throw ValidationException::withMessages(['vehicle_received_at' => ['The received time is already recorded and cannot be changed.']]);
                }

                return $booking->fresh();
            }
            $record->update(['vehicle_received_at' => $time, 'received_by' => $actor->id]);
            app(LocationMonitoringService::class)->close($booking);
            $booking->events()->create(['event_type' => 'vehicle_received', 'actor_user_id' => $actor->id, 'reason' => 'Vehicle physically received at '.$time->setTimezone('Asia/Manila')->format('Y-m-d H:i:s P').'.']);
            activity()->causedBy($actor)->performedOn($booking)->event('vehicle_received')->log('Physical vehicle receipt recorded.');

            return $booking->fresh();
        });
    }

    public function followUp(Booking $booking, User $actor, array $data): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $data) {
            $booking = Booking::lockForUpdate()->findOrFail($booking->id);
            $this->assertOngoing($booking);
            $record = $booking->returnRecord()->firstOrCreate([]);
            if ($record->vehicle_received_at) {
                throw ValidationException::withMessages(['note' => ['The vehicle has already been received.']]);
            }
            $record->update(['expected_return_at' => empty($data['expected_return_at']) ? null : CarbonImmutable::parse($data['expected_return_at'])->utc()]);
            $booking->events()->create(['event_type' => 'return_follow_up', 'actor_user_id' => $actor->id, 'reason' => trim($data['note'])]);
            activity()->causedBy($actor)->performedOn($booking)->event('return_follow_up')->log('Return follow-up recorded.');

            return $booking->fresh();
        });
    }

    public function review(Booking $booking, User $actor, array $data): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $data) {
            $booking = Booking::lockForUpdate()->findOrFail($booking->id);
            $this->assertOngoing($booking);
            $record = $booking->returnRecord;
            if (! $record?->vehicle_received_at || ! $booking->vehicleInspections()->where('type', 'incoming')->where('status', 'finalized')->exists()
                || $booking->return_charges_finalized_at) {
                throw ValidationException::withMessages(['amount' => ['Record the vehicle as received and finalize Incoming Inspection before reviewing the late charge.']]);
            }
            if ($record->late_charge_reviewed_at) {
                throw ValidationException::withMessages(['amount' => ['The late return charge has already been reviewed. Refresh the booking.']]);
            }
            $estimate = $this->estimate($booking);
            $amount = (float) $data['amount'];
            $reason = trim($data['adjustment_reason'] ?? '');
            if (($estimate['estimatedAmount'] === null || abs($amount - $estimate['estimatedAmount']) >= 0.005) && $reason === '') {
                throw ValidationException::withMessages(['adjustment_reason' => ['Explain a waiver, adjustment, or manually agreed legacy rate.']]);
            }
            if ($booking->rental_type->value === 'self_drive' && $data['responsibility'] !== 'customer') {
                throw ValidationException::withMessages(['responsibility' => ['Self Drive charges are the Customer responsibility.']]);
            }
            if ($estimate['billableHours'] === 0 && $amount > 0) {
                throw ValidationException::withMessages(['amount' => ['A vehicle received on time cannot incur a late return charge.']]);
            }
            $existingCharges = $booking->additionalCharges()->where('type', 'late_return')->get();
            $charge = null;
            if ($existingCharges->isNotEmpty()) {
                if (abs($amount - (float) $existingCharges->sum('amount')) >= 0.005) {
                    throw ValidationException::withMessages(['amount' => ['A late return charge is already recorded. Review its recorded total without adding a duplicate.']]);
                }
                $charge = $existingCharges->count() === 1 ? $existingCharges->first() : null;
            } elseif ($amount > 0) {
                $charge = app(AdditionalChargeService::class)->create($booking, [[
                    'type' => 'late_return',
                    'description' => $estimate['billableHours'].' billable late hour(s).'.($reason ? ' '.$reason : ' Agreed rate: PHP '.number_format($estimate['hourlyRate'], 2).'/hour.'),
                    'amount' => $amount, 'responsibility' => $data['responsibility'],
                ]], $actor, true)[0];
            }
            $record->update([
                'late_charge_reviewed_at' => now(), 'reviewed_by' => $actor->id,
                'approved_late_charge' => $amount, 'adjustment_reason' => $reason ?: null, 'late_charge_id' => $charge?->id,
            ]);
            $booking->events()->create(['event_type' => 'late_charge_reviewed', 'actor_user_id' => $actor->id, 'reason' => $reason ?: 'Agreed late return charge approved.']);
            activity()->causedBy($actor)->performedOn($booking)->event('late_charge_reviewed')
                ->withProperties(['approved_amount' => $amount, 'billable_hours' => $estimate['billableHours']])->log('Late return charge reviewed.');

            return $booking->fresh();
        });
    }

    private function assertOngoing(Booking $booking): void
    {
        if ($booking->status !== BookingStatus::Ongoing) {
            throw ValidationException::withMessages(['booking' => ['Return operations require an ongoing rental.']]);
        }
    }
}
