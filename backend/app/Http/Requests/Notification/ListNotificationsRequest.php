<?php

namespace App\Http\Requests\Notification;

use App\Enums\UserRole;
use App\Http\Requests\BaseFormRequest;
use Closure;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ListNotificationsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole([UserRole::Customer->value, UserRole::Driver->value]);
    }

    public function rules(): array
    {
        return [
            'booking_code' => ['sometimes', 'string', 'max:100'],
            'category' => [
                'sometimes',
                'string',
                Rule::in(['booking', 'payment', 'vehicle', 'trip', 'system']),
            ],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'pagination' => ['sometimes', 'string', Rule::in(['page', 'cursor'])],
            'cursor' => ['bail', 'sometimes', 'string', 'max:2048', 'prohibited_unless:pagination,cursor', function (string $attribute, mixed $value, Closure $fail) {
                $parameters = is_string($value) ? Cursor::fromEncoded($value)?->toArray() : null;
                if (! is_array($parameters) || Validator::make($parameters, [
                    'created_at' => ['required', 'date_format:Y-m-d H:i:s'],
                    'id' => ['required', 'integer', 'min:1'],
                    '_pointsToNextItems' => ['required', 'accepted'],
                ])->fails() || $parameters['_pointsToNextItems'] !== true) {
                    $fail('The notification cursor is invalid. Refresh notifications and try again.');
                }
            }],
        ];
    }
}
