<?php

namespace App\Http\Requests\Research;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListRcResearchRecordingsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'label_status' => ['sometimes', Rule::in(['confirmed', 'uncertain'])],
        ];
    }
}
