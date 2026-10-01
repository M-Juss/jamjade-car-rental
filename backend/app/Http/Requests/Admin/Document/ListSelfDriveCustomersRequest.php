<?php

namespace App\Http\Requests\Admin\Document;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListSelfDriveCustomersRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('review documents') ?? false;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'eligibility' => ['sometimes', 'string', Rule::in(['eligible', 'not_eligible'])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
