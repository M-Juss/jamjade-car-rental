<?php

namespace App\Services;

use App\Mail\AdminInvitationMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AdminInvitationService
{
    public function send(string $email, User $actor): void
    {
        abort_unless($actor->hasRole('owner'), 403);
        DB::transaction(function () use ($email, $actor) {
            User::query()->whereKey($actor->id)->lockForUpdate()->firstOrFail();
            if (User::withTrashed()->where('email', $email)->exists()) {
                throw ValidationException::withMessages(['email' => ['An account already uses this email.']]);
            }
            $existing = DB::table('admin_invitations')->where('email', $email)->lockForUpdate()->first();
            if ($existing?->accepted_at) {
                throw ValidationException::withMessages(['email' => ['This invitation has already been accepted.']]);
            }
            if ($existing && now()->diffInSeconds($existing->updated_at, true) < 60 && ! $existing->cancelled_at) {
                throw ValidationException::withMessages(['email' => ['Wait one minute before resending this invitation.']]);
            }
            $token = Str::random(64);
            DB::table('admin_invitations')->updateOrInsert(['email' => $email], [
                'invited_by' => $actor->id, 'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addDay(), 'cancelled_at' => null,
                'accepted_at' => null, 'created_at' => $existing?->created_at ?? now(), 'updated_at' => now(),
            ]);
            Mail::to($email)->send(new AdminInvitationMail(url('/admin-invitations/'.$token)));
            activity()->causedBy($actor)->event('admin_invited')->log('Admin invitation sent.');
        });
    }

    public function invitation(string $token): object
    {
        abort_unless(strlen($token) === 64, 404);
        $invitation = DB::table('admin_invitations')->where('token_hash', hash('sha256', $token))->first();
        abort_unless($invitation && ! $invitation->accepted_at && ! $invitation->cancelled_at
            && now()->lt($invitation->expires_at), 410, 'This invitation has expired or is no longer available.');

        return $invitation;
    }

    public function accept(string $token, array $data): void
    {
        DB::transaction(function () use ($token, $data) {
            $invitation = $this->invitation($token);
            $owner = User::query()->lockForUpdate()->find($invitation->invited_by);
            abort_unless($owner?->is_active && $owner->hasRole('owner'), 410);
            DB::table('admin_invitations')->where('id', $invitation->id)->lockForUpdate()->first();
            $invitation = $this->invitation($token);
            if (User::withTrashed()->where('email', $invitation->email)->exists()) {
                throw ValidationException::withMessages(['name' => ['An account already uses this invitation email.']]);
            }
            $user = User::create([
                'name' => $data['name'], 'email' => $invitation->email,
                'password' => $data['password'], 'email_verified_at' => now(), 'is_active' => true,
            ]);
            $user->assignRole('admin');
            DB::table('admin_invitations')->where('id', $invitation->id)->update([
                'accepted_at' => now(), 'token_hash' => null, 'updated_at' => now(),
            ]);
            activity()->causedBy($user)->performedOn($user)->event('admin_invitation_accepted')->log('Admin invitation accepted.');
        });
    }

    public function cancel(int $id, User $actor): void
    {
        abort_unless($actor->hasRole('owner'), 403);
        DB::transaction(function () use ($id, $actor) {
            User::query()->whereKey($actor->id)->lockForUpdate()->firstOrFail();
            $invitation = DB::table('admin_invitations')->where('id', $id)->lockForUpdate()->first();
            abort_unless($invitation && ! $invitation->accepted_at, 422);
            DB::table('admin_invitations')->where('id', $id)->update(['cancelled_at' => now(), 'token_hash' => null, 'updated_at' => now()]);
            activity()->causedBy($actor)->event('admin_invitation_cancelled')->log('Admin invitation cancelled.');
        });
    }

    public function revoke(User $account, User $actor): void
    {
        abort_unless($actor->hasRole('owner'), 403);
        DB::transaction(function () use ($account, $actor) {
            $user = User::query()->lockForUpdate()->findOrFail($account->id);
            abort_unless($user->roles()->count() === 1 && $user->hasRole('admin'), 422, 'Only Admin access can be revoked here.');
            $user->forceFill(['is_active' => false, 'remember_token' => Str::random(60)])->save();
            $user->tokens()->delete();
            activity()->causedBy($actor)->performedOn($user)->event('admin_access_revoked')->log('Admin access revoked.');
        });
    }
}
