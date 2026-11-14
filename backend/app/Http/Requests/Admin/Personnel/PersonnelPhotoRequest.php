<?php

namespace App\Http\Requests\Admin\Personnel;

use App\Http\Requests\BaseFormRequest;

class PersonnelPhotoRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasAnyRole(['admin', 'staff']);
    }

    public function rules(): array
    {
        return ['photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120']];
    }
}
