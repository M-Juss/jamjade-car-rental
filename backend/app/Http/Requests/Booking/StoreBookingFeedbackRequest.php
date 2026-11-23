<?php

namespace App\Http\Requests\Booking;

use App\Http\Requests\BaseFormRequest;

class StoreBookingFeedbackRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('leaveFeedback', $this->route('booking'));
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('comment'))) {
            $comment = trim($this->input('comment'));
            $this->merge(['comment' => $comment === '' ? null : $comment]);
        }
    }

    public function rules(): array
    {
        return ['rating' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:1000']];
    }
}
