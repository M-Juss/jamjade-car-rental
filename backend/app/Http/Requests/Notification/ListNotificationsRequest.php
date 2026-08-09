<?php

namespace App\Http\Requests\Notification;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListNotificationsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('customer');
    }

    public function rules(): array
    {
        return [
            'category' => [
                'sometimes',
                'string',
                Rule::in(['booking', 'payment', 'vehicle', 'trip', 'system']),
            ],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
