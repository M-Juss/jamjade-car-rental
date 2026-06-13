<?php

namespace App\Http\Requests\Admin\AccessControl;

use App\Http\Requests\BaseFormRequest;
use App\Services\AdminAccessService;
use Illuminate\Validation\Rule;

class StoreAdminRoleRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('owner') ?? false;
    }

    public function rules(): array
    {
        $moduleKeys = app(AdminAccessService::class)->assignableModuleKeys();

        return [
            'name' => ['required', 'string', 'max:80'],
            'modules' => ['required', 'array', 'min:1'],
            'modules.*' => ['string', Rule::in($moduleKeys)],
        ];
    }
}
