<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;

class ListRcResearchTrialsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:30']];
    }
}
