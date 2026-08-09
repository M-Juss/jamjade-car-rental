<?php

namespace App\Http\Requests\Admin\Report;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class ReportRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('view reports') ?? false;
    }

    public function rules(): array
    {
        return [
            'range' => [
                'sometimes',
                'string',
                Rule::in(['6_months', '12_months', 'this_year', 'all_time']),
            ],
        ];
    }
}
