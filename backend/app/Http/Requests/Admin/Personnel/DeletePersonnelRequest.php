<?php

namespace App\Http\Requests\Admin\Personnel;

use App\Http\Requests\BaseFormRequest;

class DeletePersonnelRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    public function rules(): array
    {
        return [];
    }
}
