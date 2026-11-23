<?php

namespace App\Http\Requests\Feedback;

use App\Http\Requests\BaseFormRequest;

class ListFeedbackRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'between:1,50']];
    }
}
