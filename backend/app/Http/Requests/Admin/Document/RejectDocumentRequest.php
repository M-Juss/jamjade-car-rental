<?php

namespace App\Http\Requests\Admin\Document;

use App\Http\Requests\BaseFormRequest;

class RejectDocumentRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('review documents') ?? false;
    }

    public function rules(): array
    {
        return [
            'rejection_reason' => ['required', 'string', 'max:1000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'rejection_reason' => trim((string) $this->input('rejection_reason')),
        ]);
    }
}
