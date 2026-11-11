<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;
use App\Support\AccountPasswordRules;

class ChangeAccountPasswordRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'password' => [...AccountPasswordRules::required(), 'confirmed', 'different:current_password'],
            'password_confirmation' => ['required', 'string'],
        ];
    }
}
