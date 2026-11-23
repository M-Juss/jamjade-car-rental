<?php

namespace App\Http\Requests\Admin\Booking;

use App\Http\Requests\BaseFormRequest;
use App\Support\ReportPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Rule;

class ListDrivingAnalysisRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return ($this->user()?->can('view driving analysis') ?? false)
            && ($this->user()?->can('view fleet tracker') ?? false);
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'operator_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'operator_type' => ['sometimes', 'nullable', 'string', 'in:customer,driver'],
            'vehicle_id' => ['sometimes', 'nullable', 'integer', 'exists:vehicles,id'],
            'period' => ['required_with:date', Rule::in(ReportPeriod::MODES)],
            'date' => ['required_with:period', 'date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before_or_equal:'.CarbonImmutable::now(ReportPeriod::TIMEZONE)->toDateString()],
            'graded_only' => ['sometimes', 'boolean'],
        ];
    }
}
