<?php

namespace App\Http\Requests\Admin\Telematics;

use App\Enums\RentalType;
use App\Http\Requests\BaseFormRequest;
use App\Services\FleetTrackerService;
use Illuminate\Validation\Rule;

class ListFleetRentalsRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('view fleet tracker') ?? false;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:160'],
            'status' => ['sometimes', 'string', Rule::in(FleetTrackerService::TRACKING_STATUSES)],
            'rental_type' => ['sometimes', 'string', Rule::enum(RentalType::class)],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
