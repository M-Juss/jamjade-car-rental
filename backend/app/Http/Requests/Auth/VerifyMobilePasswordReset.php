<?php

namespace App\Http\Requests\Auth;

use App\Http\Requests\BaseFormRequest;

class VerifyMobilePasswordReset extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['reset_id' => ['required', 'uuid'], 'code' => ['required', 'string', 'regex:/\A[0-9]{6}\z/']];
    }
}
