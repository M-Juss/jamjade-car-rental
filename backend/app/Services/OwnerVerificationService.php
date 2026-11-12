<?php

namespace App\Services;

use App\Mail\OwnerVerificationMail;
use App\Models\Booking;
use App\Models\DeliveryPricingSetting;
use App\Models\LateReturnPricingSetting;
use App\Models\OwnerVerification;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Support\Testing\Fakes\MailFake;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Guards a validated write and commits code consumption with the write itself. */
class OwnerVerificationService
{
    /** @param callable(): Model $lockTarget @param callable(Model): mixed $write */
    public function run(Request $request, string $action, string $target, array $payload, callable $lockTarget, callable $write, ?callable $required = null): mixed
    {
        $actor = $request->user();
        $mode = $request->header('X-Owner-Verification');
        if ($mode !== 'request' && $request->header('X-Owner-Code')) {
            $this->limit('verify:'.$actor->id, 20, 60);
        }

        $result = DB::transaction(function () use ($request, $action, $target, $payload, $lockTarget, $write, $required, $actor, $mode) {
            $model = $lockTarget();
            if ($required && ! $required($model)) {
                return ['value' => $mode === 'request' ? response()->json(['success' => true, 'data' => ['verificationRequired' => false]]) : $write($model)];
            }
            $owner = $this->owner();
            if ($owner->is($actor)) {
                return ['value' => $mode === 'request'
                    ? response()->json(['success' => true, 'data' => ['verificationRequired' => false]])
                    : $write($model)];
            }
            $payloadHash = $this->fingerprint($payload);
            $stateHash = $this->fingerprint($this->state($model));
            $verificationId = (string) $request->header('X-Owner-Verification-Id', '');
            if ($mode === 'request') {
                $existing = $verificationId === ''
                    ? OwnerVerification::query()->where('actor_id', $actor->id)->where('action', $action)->where('target', $target)->whereNull('consumed_at')->where('expires_at', '>', now())->lockForUpdate()->first()
                    : OwnerVerification::query()->whereKey($verificationId)->lockForUpdate()->first();
                if ($verificationId !== '' && ! $existing) {
                    return ['error' => 'This verification has expired. Start again.'];
                }
                if ($verificationId === '' && $existing && ($existing->owner_id !== $owner->id || $existing->owner_email_hash !== $this->ownerEmailHash($owner))) {
                    $existing->update(['consumed_at' => now()]);
                    $existing = null;
                }
                if ($existing) {
                    if ($existing->actor_id !== $actor->id || $existing->owner_id !== $owner->id || $existing->owner_email_hash !== $this->ownerEmailHash($owner) || $existing->action !== $action || $existing->target !== $target || $existing->consumed_at || $existing->expires_at->isPast() || $existing->failed_attempts >= 5) {
                        return ['error' => 'This verification has expired. Try again later.'];
                    }
                    if ($verificationId !== '' && ($existing->payload_hash !== $payloadHash || $existing->state_hash !== $stateHash)) {
                        return ['error' => 'The action changed. Start again.'];
                    }
                    if ($existing->resend_available_at->isFuture()) {
                        if ($verificationId === '' && $existing->payload_hash === $payloadHash && $existing->state_hash === $stateHash) {
                            return ['value' => response()->json(['success' => true, 'data' => ['verificationId' => $existing->id, 'expiresAt' => $existing->expires_at->toISOString(), 'resendAvailableAt' => $existing->resend_available_at->toISOString()]])->header('Cache-Control', 'no-store')];
                        }
                        $retryAfter = max(1, (int) ceil(now()->diffInSeconds($existing->resend_available_at, false)));
                        throw new HttpException(429, 'A verification code was recently sent. Try again shortly.', null, ['Retry-After' => (string) $retryAfter]);
                    }
                    $existing->payload_hash = $payloadHash;
                    $existing->state_hash = $stateHash;
                } else {
                    OwnerVerification::query()->where('actor_id', $actor->id)->where('action', $action)->where('target', $target)->whereNull('consumed_at')->update(['consumed_at' => now()]);
                    $existing = new OwnerVerification(['id' => (string) Str::uuid(), 'actor_id' => $actor->id, 'owner_id' => $owner->id, 'owner_email_hash' => $this->ownerEmailHash($owner), 'action' => $action, 'target' => $target, 'payload_hash' => $payloadHash, 'state_hash' => $stateHash, 'failed_attempts' => 0, 'created_at' => now(), 'expires_at' => now()->addMinutes(15)]);
                }
                $this->limit('issue:'.$actor->id, 5);
                $this->limit('ip:'.hash('sha256', (string) $request->ip()), 20);
                do {
                    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
                } while ($existing->exists && Hash::check($code, $existing->code_hash));
                $existing->code_hash = Hash::make($code);
                $existing->resend_available_at = now()->addSeconds(60);
                $existing->save();
                $summary = $this->summary($actor, $action, $target, $payload, $model);
                try {
                    if (config('mail.mailers.'.config('mail.default').'.transport') === 'log' && ! (Mail::getFacadeRoot() instanceof MailFake)) {
                        throw new \RuntimeException('A delivery mailer is required.');
                    }
                    Mail::to($owner->email)->send(new OwnerVerificationMail($code, $summary));
                } catch (\Throwable) {
                    throw new HttpException(503, 'The owner verification code could not be sent. Try again.');
                }

                return ['value' => response()->json(['success' => true, 'message' => 'Verification code sent.', 'data' => ['verificationId' => $existing->id, 'expiresAt' => $existing->expires_at->toISOString(), 'resendAvailableAt' => $existing->resend_available_at->toISOString()]])->header('Cache-Control', 'no-store')];
            }
            if ($verificationId === '' || ! preg_match('/^\d{6}$/', (string) $request->header('X-Owner-Code', ''))) {
                throw new HttpException(428, 'Owner verification is required.');
            }
            $verification = OwnerVerification::query()->whereKey($verificationId)->lockForUpdate()->first();
            if (! $verification || $verification->actor_id !== $actor->id || $verification->owner_id !== $owner->id || $verification->owner_email_hash !== $this->ownerEmailHash($owner) || $verification->action !== $action || $verification->target !== $target || $verification->payload_hash !== $payloadHash || $verification->state_hash !== $stateHash || $verification->consumed_at || $verification->expires_at->isPast() || $verification->failed_attempts >= 5) {
                return ['error' => 'This verification has expired or the action changed. Start again.'];
            }
            if (! Hash::check((string) $request->header('X-Owner-Code'), $verification->code_hash)) {
                $verification->increment('failed_attempts');

                return ['error' => 'The verification code is incorrect.'];
            }
            $value = $write($model);
            $verification->update(['consumed_at' => now()]);

            return ['value' => $value];
        });
        if (isset($result['error'])) {
            throw ValidationException::withMessages(['owner_code' => [$result['error']]]);
        }

        return $result['value'];
    }

    private function ownerEmailHash(User $owner): string
    {
        return hash('sha256', strtolower(trim($owner->email)));
    }

    private function owner(): User
    {
        $owners = User::role('owner')->where('is_active', true)->limit(2)->get();
        if ($owners->count() !== 1) {
            throw new HttpException(503, 'Owner verification is unavailable.');
        }

        return $owners->first();
    }

    private function limit(string $key, int $maximum, int $seconds = 3600): void
    {
        $key = 'owner-verification:'.$key;
        if (RateLimiter::tooManyAttempts($key, $maximum)) {
            throw new HttpException(429, 'Too many verification attempts. Try again later.', null, ['Retry-After' => (string) max(1, RateLimiter::availableIn($key))]);
        }
        RateLimiter::hit($key, $seconds);
    }

    private function state(Model $model): array
    {
        $state = ['record' => $model->getAttributes()];
        if ($model instanceof DeliveryPricingSetting) {
            $state['late_pricing'] = LateReturnPricingSetting::query()->lockForUpdate()->findOrFail(1)->getAttributes();
        }
        if ($model instanceof Vehicle) {
            $state['images'] = $model->images()->orderBy('id')->lockForUpdate()->get()->map->getAttributes()->all();
            $state['features'] = $model->features()->orderBy('id')->lockForUpdate()->get()->map->getAttributes()->all();
        }
        if ($model instanceof Booking) {
            $state['cancellation'] = $model->cancellation()->lockForUpdate()->get()->map->getAttributes()->all();
            $state['return'] = $model->returnRecord()->lockForUpdate()->get()->map->getAttributes()->all();
            $state['terms'] = $model->terms()->lockForUpdate()->get()->map->getAttributes()->all();
            $state['charges'] = $model->additionalCharges()->without('payments')->orderBy('id')->lockForUpdate()->get()->map->getAttributes()->all();
            $state['payments'] = $model->payments()->orderBy('id')->lockForUpdate()->get()->map->getAttributes()->all();
            $chargeIds = array_column($state['charges'], 'id');
            $state['allocations'] = DB::table('payment_charge_allocations')->whereIn('booking_additional_charge_id', $chargeIds)
                ->orderBy('booking_additional_charge_id')->orderBy('payment_id')->lockForUpdate()->get()->map(fn ($row) => (array) $row)->all();
            $state['inspections'] = $model->vehicleInspections()->orderBy('id')->lockForUpdate()->get()->map->getAttributes()->all();
        }

        return $state;
    }

    private function summary(User $actor, string $action, string $target, array $payload, Model $model): string
    {
        $before = [];
        if ($model instanceof Booking) {
            if (str_contains(strtolower($action), 'refund')) {
                $before = $model->cancellation?->only(['refund_amount', 'refund_reason']) ?? [];
            } elseif ($action === 'Review late return charge') {
                $estimate = app(BookingReturnService::class)->estimate($model);
                $before = [
                    'estimated_amount' => $estimate['estimatedAmount'] ?? 'Unavailable (legacy agreement)',
                    'billable_hours' => $estimate['billableHours'],
                    'hourly_rate' => $estimate['hourlyRate'] ?? 'Unavailable',
                ];
                $recorded = $model->additionalCharges()->where('type', 'late_return')->first();
                if ($recorded) {
                    $before['recorded_charge'] = $recorded->only(['amount', 'responsibility']);
                }
            } elseif (str_contains(strtolower($action), 'charge')) {
                $chargeId = (int) Str::afterLast($target, ' charge ');
                if ($chargeId) {
                    $before = $model->additionalCharges()->whereKey($chargeId)->first()?->only(['type', 'description', 'amount', 'responsibility', 'responsible_user_id']) ?? [];
                }
            }
        } elseif ($model instanceof Vehicle) {
            $before = ['price_per_day' => $model->price_per_day];
        } else {
            $before = $model->getAttributes();
            unset($before['id'], $before['created_at'], $before['updated_at'], $before['garage_address'], $before['garage_latitude'], $before['garage_longitude']);
            if ($model instanceof DeliveryPricingSetting) {
                $before += LateReturnPricingSetting::query()->findOrFail(1)->only(['small_vehicle_hourly_rate', 'large_vehicle_hourly_rate']);
            }
        }
        $details = $payload;
        unset($details['images']);
        $format = function (array $values) use (&$format): string {
            $parts = [];
            foreach ($values as $key => $value) {
                if ($value instanceof UploadedFile) {
                    continue;
                }
                if ($value instanceof \BackedEnum) {
                    $value = $value->value;
                }
                $label = ucfirst(str_replace('_', ' ', (string) $key));
                $parts[] = $label.': '.(is_array($value) ? $format($value) : (is_bool($value) ? ($value ? 'yes' : 'no') : (string) $value));
            }

            return $parts ? implode("\n", $parts) : 'None';
        };

        return $actor->name.' requested '.$action.' for '.$target.".\n\nCurrent values:\n".$format($before)."\n\nRequested values:\n".$format($details);
    }

    private function fingerprint(mixed $value): string
    {
        return hash('sha256', json_encode($this->canonical($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function canonical(mixed $value): mixed
    {
        if ($value instanceof UploadedFile) {
            return ['file_sha256' => hash_file('sha256', $value->getRealPath()), 'name' => $value->getClientOriginalName()];
        }
        if (is_array($value)) {
            if (! array_is_list($value)) {
                ksort($value);
            }

            return array_map(fn ($item) => $this->canonical($item), $value);
        }

        return $value;
    }
}
