<?php

namespace App\Http\Requests\Admin\Report;

use App\Enums\RentalType;
use App\Http\Requests\BaseFormRequest;
use App\Services\ReportAnalyticsService;
use App\Support\ReportPeriod;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Rule;

class ReportAnalyticsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('view reports') ?? false;
    }

    public function rules(): array
    {
        return [
            'range' => [
                'sometimes', 'string', Rule::prohibitedIf($this->routeIs('admin.reports.csv')),
                Rule::in(['6_months', '12_months', 'this_year', 'all_time']),
                'prohibits:period,date,section,vehicle_id,rental_type,page,per_page,search',
            ],
            'period' => ['sometimes', Rule::in(ReportPeriod::MODES)],
            'date' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before_or_equal:'.CarbonImmutable::now(ReportPeriod::TIMEZONE)->toDateString()],
            'section' => ['sometimes', Rule::in(ReportAnalyticsService::SECTIONS)],
            'vehicle_id' => ['sometimes', 'integer', 'min:1', 'exists:vehicles,id'],
            'rental_type' => ['sometimes', Rule::enum(RentalType::class)],
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:'.ReportAnalyticsService::PAGE_SIZE],
        ];
    }

    public function period(): ReportPeriod
    {
        return new ReportPeriod($this->validated('period', 'month'), $this->validated('date'));
    }

    public function section(): string
    {
        return $this->validated('section', 'overview');
    }
}
