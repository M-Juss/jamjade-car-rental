<?php

namespace App\Http\Requests\Delivery;

use App\Http\Requests\BaseFormRequest;

class PlaceSearchRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasRole('customer') ?? false;
    }

    public function rules(): array
    {
        return ['input' => [$this->routeIs('mobile.delivery.place') ? 'prohibited' : 'required', 'string', 'min:2', 'max:255'], 'place_id' => [$this->routeIs('mobile.delivery.place') ? 'required' : 'prohibited', 'string', 'max:255'], 'session_token' => ['required', 'uuid']];
    }
}
