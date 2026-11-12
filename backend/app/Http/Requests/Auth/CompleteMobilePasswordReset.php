<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;
use App\Support\AccountPasswordRules;

class CompleteMobilePasswordReset extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['reset_id' => ['required', 'uuid'], 'reset_token' => ['required', 'string', 'size:64'], 'password' => [...AccountPasswordRules::required(), 'confirmed'], 'password_confirmation' => ['required', 'string']];
    }
}
