<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangeAccountPasswordRequest;
use App\Http\Requests\OwnerAccount\ConfirmEmailChange;
use App\Http\Requests\OwnerAccount\RequestEmailChange;
use App\Mail\OwnerVerificationMail;
use App\Models\User;
use App\Services\AuthService;
use App\Traits\ApiResponseTrait;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class OwnerProfileController extends Controller
{
    use ApiResponseTrait;

    public function requestEmail(RequestEmailChange $request)
    {
        $data = $request->validated();
        $code = (string) random_int(100000, 999999);
        Mail::to($data['email'])->send(new OwnerVerificationMail($code, 'Verify your new JamJade sign-in email.'));
        DB::table('owner_email_changes')->updateOrInsert(['user_id' => $request->user()->id], ['email' => $data['email'], 'code_hash' => Hash::make($code), 'attempts' => 0, 'expires_at' => now()->addMinutes(15), 'created_at' => now(), 'updated_at' => now()]);

        return $this->noData('Verification code sent.');
    }

    public function confirmEmail(ConfirmEmailChange $request)
    {
        $result = DB::transaction(function () use ($request) {
            $pending = DB::table('owner_email_changes')->where('user_id', $request->user()->id)->lockForUpdate()->first();
            if (! $pending || $pending->attempts >= 5 || now()->greaterThan($pending->expires_at)) {
                return false;
            }
            if (! Hash::check($request->validated('code'), $pending->code_hash)) {
                DB::table('owner_email_changes')->where('user_id', $request->user()->id)->increment('attempts');

                return false;
            }
            if (User::where('email', $pending->email)->exists()) {
                return false;
            }
            $request->user()->forceFill(['email' => $pending->email, 'email_verified_at' => now()])->save();
            activity()->causedBy($request->user())->event('owner_email_updated')->log('Owner email updated.');
            DB::table('owner_email_changes')->where('user_id', $request->user()->id)->delete();

            return true;
        });
        if (! $result) {
            throw ValidationException::withMessages(['code' => ['Invalid or expired code. Request a new code.']]);
        }

        return $this->noData('Email updated.');
    }

    public function password(ChangeAccountPasswordRequest $request, AuthService $auth)
    {
        DB::transaction(function () use ($request, $auth) {
            $auth->changeAccountPassword($request->user(), $request->validated());
            DB::table('owner_email_changes')->where('user_id', $request->user()->id)->delete();
        });
        auth('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->noData('Password updated. Please sign in again.');
    }
}
