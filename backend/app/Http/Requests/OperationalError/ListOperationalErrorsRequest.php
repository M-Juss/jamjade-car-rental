<?php

namespace App\Http\Requests\OperationalError;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ListOperationalErrorsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', Rule::in(['success', 'failed', 'all'])],
            'action' => ['sometimes', Rule::in(['created', 'updated', 'deleted', 'approved', 'rejected', 'all'])],
            'module' => ['sometimes', Rule::in(['bookings', 'payments', 'vehicles', 'maintenance', 'personnel', 'documents', 'settings', 'all'])],
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
