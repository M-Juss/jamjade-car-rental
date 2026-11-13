<?php

namespace App\Http\Requests\Research;

use Illuminate\Foundation\Http\FormRequest;

class ImportRcRuntimeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('admin');
    }

    public function rules(): array
    {
        return ['model' => ['required', 'file', 'max:4096']];
    }
}
