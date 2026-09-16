<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Enums\RentalType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

class Booking extends Model
{
    use HasFactory, SoftDeletes;

    /** @var array<string, mixed> */
    private array $pendingAssignment = [];

    /** @var array<string, mixed> */
    private array $pendingTerms = [];

    /** @var array<string, mixed> */
    private array $pendingConfirmationEmail = [];

    /** @var array<string, mixed> */
    private array $pendingLifecycle = [];

    protected $fillable = [
        'booking_code',
        'user_id',
        'vehicle_id',
        'rental_type',
        'rental_start_at',
        'rental_end_at',
        'pickup_location_type',
        'pickup_location',
        'return_location',
        'owner_driver_coverage',
        'status',
        'payment_status',
        'price_per_day',
        'duration_days',
        'subtotal',
        'delivery_fee',
        'owner_driver_fee',
        'add_ons_total',
        'discount_total',
        'remaining_balance',
        'balance_due_at',
        'balance_reminder_sent_at',
        'total_amount',
        'notes',
        'admin_notes',

        // These accessors persist to connected booking detail tables.
        'assigned_driver_id',
        'driver_assigned_at',
        'calibration_status',
        'calibrated_by',
        'calibrated_at',
        'customer_signature',
        'terms_version',
        'terms_accepted_at',
        'confirmation_email_sent_at',
        'confirmation_email_status',
        'confirmation_email_error',
        'confirmed_at',
        'rejected_at',
        'started_at',
        'completed_at',
        'completed_by',
        'return_charges_finalized_at',
        'return_charges_finalized_by',
        'returned_at',
        'cancelled_at',
    ];

    protected static function booted(): void
    {
        static::saved(fn (Booking $booking) => $booking->persistPendingDetails());
    }

    protected function casts(): array
    {
        return [
            'rental_type' => RentalType::class,
            'status' => BookingStatus::class,
            'payment_status' => PaymentStatus::class,
            'rental_start_at' => 'datetime',
            'rental_end_at' => 'datetime',
            'balance_due_at' => 'datetime',
            'balance_reminder_sent_at' => 'datetime',
            'price_per_day' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'owner_driver_fee' => 'decimal:2',
            'add_ons_total' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'remaining_balance' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function scopeBlockingVehicleDates(Builder $query): Builder
    {
        return $query->whereIn('status', [
            BookingStatus::Confirmed->value,
            BookingStatus::Ongoing->value,
        ]);
    }

    public function scopeOverlappingSchedule(Builder $query, mixed $start, mixed $end): Builder
    {
        return $query
            ->where('rental_start_at', '<=', $end)
            ->where('rental_end_at', '>=', $start);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function assignment(): HasOne
    {
        return $this->hasOne(BookingAssignment::class);
    }

    public function assignedDriver(): HasOneThrough
    {
        return $this->hasOneThrough(
            User::class,
            BookingAssignment::class,
            'booking_id',
            'id',
            'id',
            'driver_id'
        );
    }

    public function terms(): HasOne
    {
        return $this->hasOne(BookingTerms::class);
    }

    public function confirmationEmail(): HasOne
    {
        return $this->hasOne(BookingConfirmationEmail::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function paypalCheckouts(): HasMany
    {
        return $this->hasMany(PayPalCheckout::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(BookingEvent::class);
    }

    /** @deprecated Use events() for the unified booking timeline. */
    public function statusLogs(): HasMany
    {
        return $this->events()->where('event_type', 'status_changed');
    }

    public function telematicsTrips(): HasMany
    {
        return $this->hasMany(TelematicsTrip::class);
    }

    public function vehicleInspections(): HasMany
    {
        return $this->hasMany(VehicleInspection::class);
    }

    public function additionalCharges(): HasMany
    {
        return $this->hasMany(BookingAdditionalCharge::class)->with('payments');
    }

    public function successfulPayments(): HasMany
    {
        return $this->payments()->where('status', 'completed');
    }

    public function getDriverOptionAttribute(): string
    {
        return $this->rental_type instanceof RentalType
            ? $this->rental_type->value
            : (string) $this->rental_type;
    }

    public function getDeliveryTimeAttribute(): ?string
    {
        if ($this->rental_type !== RentalType::OwnersDriver || ! $this->rental_start_at) {
            return null;
        }

        return $this->rental_start_at->format('H:i');
    }

    public function getOutsideManilaFeeAttribute(): string
    {
        return '0.00';
    }

    public function getTollFeeAttribute(): string
    {
        return number_format($this->additionalChargeAmount(['toll_fee']), 2, '.', '');
    }

    public function getLateFeeAttribute(): string
    {
        return number_format($this->additionalChargeAmount(['late_return']), 2, '.', '');
    }

    public function getPenaltyTotalAttribute(): string
    {
        return number_format($this->additionalChargeAmount([
            'vehicle_damage', 'cleaning', 'fuel', 'traffic_violation', 'other',
        ]), 2, '.', '');
    }

    public function getDownPaymentAmountAttribute(): string
    {
        $payment = $this->relationLoaded('payments')
            ? $this->payments->where('status', 'completed')->sortBy('completed_at')->first()
            : $this->successfulPayments()->oldest('completed_at')->first();

        return number_format((float) ($payment?->amount ?? 0), 2, '.', '');
    }

    public function getAssignedDriverIdAttribute(): ?int
    {
        if ($this->relationLoaded('assignedDriver')) {
            return $this->assignedDriver?->id;
        }

        return ($value = $this->assignmentValue('driver_id')) === null ? null : (int) $value;
    }

    public function setAssignedDriverIdAttribute(mixed $value): void
    {
        $this->pendingAssignment['driver_id'] = $value;
    }

    public function getDriverAssignedAtAttribute(): mixed
    {
        return $this->assignmentValue('assigned_at');
    }

    public function setDriverAssignedAtAttribute(mixed $value): void
    {
        $this->pendingAssignment['assigned_at'] = $value;
    }

    public function getCalibrationStatusAttribute(): string
    {
        return (string) ($this->assignmentValue('calibration_status') ?? 'locked');
    }

    public function setCalibrationStatusAttribute(mixed $value): void
    {
        $this->pendingAssignment['calibration_status'] = $value;
    }

    public function getCalibratedByAttribute(): ?int
    {
        return ($value = $this->assignmentValue('calibrated_by')) === null ? null : (int) $value;
    }

    public function setCalibratedByAttribute(mixed $value): void
    {
        $this->pendingAssignment['calibrated_by'] = $value;
    }

    public function getCalibratedAtAttribute(): mixed
    {
        return $this->assignmentValue('calibrated_at');
    }

    public function setCalibratedAtAttribute(mixed $value): void
    {
        $this->pendingAssignment['calibrated_at'] = $value;
    }

    public function getCustomerSignatureAttribute(): ?string
    {
        return $this->termsValue('customer_signature');
    }

    public function setCustomerSignatureAttribute(?string $value): void
    {
        $this->pendingTerms['customer_signature'] = $value;
    }

    public function getTermsVersionAttribute(): ?string
    {
        return $this->termsValue('terms_version');
    }

    public function setTermsVersionAttribute(?string $value): void
    {
        $this->pendingTerms['terms_version'] = $value;
    }

    public function getTermsAcceptedAtAttribute(): mixed
    {
        return $this->termsValue('accepted_at');
    }

    public function setTermsAcceptedAtAttribute(mixed $value): void
    {
        $this->pendingTerms['accepted_at'] = $value;
    }

    public function getConfirmationEmailSentAtAttribute(): mixed
    {
        return $this->confirmationEmailValue('sent_at');
    }

    public function setConfirmationEmailSentAtAttribute(mixed $value): void
    {
        $this->pendingConfirmationEmail['sent_at'] = $value;
    }

    public function setConfirmationEmailStatusAttribute(?string $value): void
    {
        $this->pendingConfirmationEmail['status'] = $value;
    }

    public function getConfirmationEmailStatusAttribute(): ?string
    {
        return $this->confirmationEmailValue('status');
    }

    public function setConfirmationEmailErrorAttribute(?string $value): void
    {
        $this->pendingConfirmationEmail['error'] = $value;
    }

    public function getConfirmationEmailErrorAttribute(): ?string
    {
        return $this->confirmationEmailValue('error');
    }

    public function getConfirmedAtAttribute(): mixed
    {
        return $this->statusEventTime(BookingStatus::Confirmed);
    }

    public function setConfirmedAtAttribute(mixed $value): void
    {
        $this->pendingLifecycle['confirmed_at'] = $value;
    }

    public function getRejectedAtAttribute(): mixed
    {
        return $this->statusEventTime(BookingStatus::Rejected);
    }

    public function setRejectedAtAttribute(mixed $value): void
    {
        $this->pendingLifecycle['rejected_at'] = $value;
    }

    public function getStartedAtAttribute(): mixed
    {
        return $this->statusEventTime(BookingStatus::Ongoing);
    }

    public function setStartedAtAttribute(mixed $value): void
    {
        $this->pendingLifecycle['started_at'] = $value;
    }

    public function getCompletedAtAttribute(): mixed
    {
        return $this->statusEventTime(BookingStatus::Completed);
    }

    public function setCompletedAtAttribute(mixed $value): void
    {
        $this->pendingLifecycle['completed_at'] = $value;
    }

    public function getCompletedByAttribute(): ?int
    {
        return $this->statusEvent(BookingStatus::Completed)?->actor_user_id;
    }

    public function setCompletedByAttribute(mixed $value): void
    {
        $this->pendingLifecycle['completed_by'] = $value;
    }

    public function getReturnChargesFinalizedAtAttribute(): mixed
    {
        return $this->eventTime('return_charges_finalized');
    }

    public function setReturnChargesFinalizedAtAttribute(mixed $value): void
    {
        $this->pendingLifecycle['return_charges_finalized_at'] = $value;
    }

    public function getReturnChargesFinalizedByAttribute(): ?int
    {
        return $this->event('return_charges_finalized')?->actor_user_id;
    }

    public function setReturnChargesFinalizedByAttribute(mixed $value): void
    {
        $this->pendingLifecycle['return_charges_finalized_by'] = $value;
    }

    public function getReturnedAtAttribute(): mixed
    {
        return $this->statusEventTime(BookingStatus::Returned);
    }

    public function setReturnedAtAttribute(mixed $value): void
    {
        $this->pendingLifecycle['returned_at'] = $value;
    }

    public function getCancelledAtAttribute(): mixed
    {
        return $this->statusEventTime(BookingStatus::Cancelled);
    }

    public function setCancelledAtAttribute(mixed $value): void
    {
        $this->pendingLifecycle['cancelled_at'] = $value;
    }

    public function telematicsEvents(): HasManyThrough
    {
        return $this->hasManyThrough(TelematicsEvent::class, TelematicsTrip::class, 'booking_id', 'trip_id');
    }

    private function assignmentValue(string $field): mixed
    {
        if ($this->relationLoaded('assignment')) {
            return $this->assignment?->{$field};
        }

        return $this->exists ? $this->assignment()->value($field) : null;
    }

    private function termsValue(string $field): mixed
    {
        if ($this->relationLoaded('terms')) {
            return $this->terms?->{$field};
        }

        return $this->exists ? $this->terms()->value($field) : null;
    }

    private function confirmationEmailValue(string $field): mixed
    {
        if ($this->relationLoaded('confirmationEmail')) {
            return $this->confirmationEmail?->{$field};
        }

        return $this->exists ? $this->confirmationEmail()->value($field) : null;
    }

    private function statusEvent(BookingStatus $status): ?BookingEvent
    {
        return $this->event('status_changed', $status->value);
    }

    private function statusEventTime(BookingStatus $status): mixed
    {
        return $this->statusEvent($status)?->created_at;
    }

    private function event(string $type, ?string $newStatus = null): ?BookingEvent
    {
        if ($this->relationLoaded('events')) {
            return $this->events
                ->filter(fn (BookingEvent $event) => $event->event_type === $type
                    && ($newStatus === null || $event->new_status?->value === $newStatus))
                ->sortByDesc('created_at')
                ->first();
        }

        $query = $this->events()->where('event_type', $type);

        if ($newStatus !== null) {
            $query->where('new_status', $newStatus);
        }

        return $this->exists ? $query->latest('created_at')->first() : null;
    }

    private function eventTime(string $type): mixed
    {
        return $this->event($type)?->created_at;
    }

    private function additionalChargeAmount(array $types): float
    {
        $charges = $this->relationLoaded('additionalCharges')
            ? $this->additionalCharges->filter(
                fn (BookingAdditionalCharge $charge) => in_array($charge->type->value, $types, true)
            )
            : $this->additionalCharges()->whereIn('type', $types)->get();

        return (float) $charges->sum('amount');
    }

    private function persistPendingDetails(): void
    {
        if ($this->pendingAssignment !== []) {
            $this->assignment()->updateOrCreate([], $this->pendingAssignment);
            $this->unsetRelation('assignment');
            $this->unsetRelation('assignedDriver');
            $this->pendingAssignment = [];
        }

        if ($this->pendingTerms !== []) {
            $this->terms()->updateOrCreate([], $this->pendingTerms);
            $this->unsetRelation('terms');
            $this->pendingTerms = [];
        }

        if ($this->pendingConfirmationEmail !== []) {
            $this->confirmationEmail()->updateOrCreate([], $this->pendingConfirmationEmail);
            $this->unsetRelation('confirmationEmail');
            $this->pendingConfirmationEmail = [];
        }

        if ($this->pendingLifecycle !== []) {
            $this->persistPendingLifecycle();
            $this->pendingLifecycle = [];
        }
    }

    private function persistPendingLifecycle(): void
    {
        $statusEvents = [
            'confirmed_at' => BookingStatus::Confirmed,
            'rejected_at' => BookingStatus::Rejected,
            'started_at' => BookingStatus::Ongoing,
            'completed_at' => BookingStatus::Completed,
            'returned_at' => BookingStatus::Returned,
            'cancelled_at' => BookingStatus::Cancelled,
        ];

        foreach ($statusEvents as $field => $status) {
            $value = $this->pendingLifecycle[$field] ?? null;

            if ($value === null) {
                continue;
            }

            $event = $this->statusEvent($status);
            $attributes = [
                'event_type' => 'status_changed',
                'new_status' => $status,
                'actor_user_id' => $status === BookingStatus::Completed
                    ? ($this->pendingLifecycle['completed_by'] ?? null)
                    : null,
            ];

            if ($event) {
                $event->forceFill(['created_at' => $value, ...$attributes])->saveQuietly();
            } else {
                $created = $this->events()->create($attributes);
                $created->forceFill(['created_at' => $value])->saveQuietly();
            }
        }

        if (($value = $this->pendingLifecycle['return_charges_finalized_at'] ?? null) !== null) {
            $attributes = [
                'event_type' => 'return_charges_finalized',
                'actor_user_id' => $this->pendingLifecycle['return_charges_finalized_by'] ?? null,
            ];
            $event = $this->event('return_charges_finalized');

            if ($event) {
                $event->forceFill(['created_at' => $value, ...$attributes])->saveQuietly();
            } else {
                $created = $this->events()->create($attributes);
                $created->forceFill(['created_at' => $value])->saveQuietly();
            }
        }
    }
}
