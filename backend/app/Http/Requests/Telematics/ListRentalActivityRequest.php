<?php

namespace App\Http\Requests\Telematics;

use App\Http\Requests\BaseFormRequest;
use Closure;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Facades\Validator;

class ListRentalActivityRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole(['customer', 'driver']);
    }

    public function rules(): array
    {
        return [
            'cursor' => ['bail', 'sometimes', 'string', 'max:512', function (string $attribute, mixed $value, Closure $fail) {
                $cursor = Cursor::fromEncoded($value)?->toArray();
                if (! is_array($cursor) || Validator::make($cursor, [
                    'occurred_ms' => ['required', 'integer', 'min:0'],
                    'kind' => ['required', 'in:notification,maneuver'],
                    'source_id' => ['required', 'string', 'regex:/^(?:[0-9]{1,20}|[0-9a-f-]{36})$/D'],
                ])->fails() || ($cursor['_pointsToNextItems'] ?? null) !== true) {
                    $fail('The activity cursor is invalid. Refresh activity and try again.');
                }
            }],
        ];
    }
}
