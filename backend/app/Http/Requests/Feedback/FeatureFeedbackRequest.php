<?php

namespace App\Http\Requests\Feedback;

use App\Http\Requests\BaseFormRequest;

class FeatureFeedbackRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('feature', $this->route('feedback'));
    }

    public function rules(): array
    {
        return ['is_featured' => ['required', 'boolean']];
    }
}
