<?php

namespace App\Http\Requests\Admin\Document;

use App\Enums\DocumentStatus;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListDocumentsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('review documents') ?? false;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'string', Rule::enum(DocumentStatus::class)],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
