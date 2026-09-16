<?php

namespace App\Http\Requests\Admin\StaffManagement;

use App\Http\Requests\BaseFormRequest;
use App\Services\StaffAccessService;
use Illuminate\Validation\Rule;

class StoreStaffRoleRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('admin') ?? false;
    }

    public function rules(): array
    {
        $moduleKeys = app(StaffAccessService::class)->assignableModuleKeys();

        return [
            'name' => ['required', 'string', 'max:80'],
            'modules' => ['required', 'array', 'min:1'],
            'modules.*' => ['string', Rule::in($moduleKeys)],
        ];
    }
}
