<?php

namespace App\Http\Requests\OwnerAccount;

use App\Http\Requests\BaseFormRequest;

class ConfirmEmailChange extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('owner');
    }

    public function rules(): array
    {
        return ['code' => ['required', 'digits:6']];
    }
}
