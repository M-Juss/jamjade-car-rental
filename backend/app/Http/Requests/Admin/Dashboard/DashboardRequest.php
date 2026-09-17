<?php

namespace App\Http\Requests\Admin\Dashboard;

use App\Http\Requests\BaseFormRequest;

class DashboardRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('view dashboard') ?? false;
    }

    public function rules(): array
    {
        return [
            'start' => ['required', 'date'],
            'end' => ['required', 'date', 'after_or_equal:start'],
        ];
    }
}
