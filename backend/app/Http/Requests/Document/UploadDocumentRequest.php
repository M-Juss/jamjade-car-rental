<?php

namespace App\Http\Requests\Document;

use App\Http\Requests\BaseFormRequest;
use App\Models\CustomerDocument;
use Illuminate\Validation\Rule;

class UploadDocumentRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasRole('customer');
    }

    protected function prepareForValidation(): void
    {
        if ($this->input('document_type') !== CustomerDocument::DRIVERS_LICENSE || ! is_string($this->input('document_number'))) {
            return;
        }

        $number = strtoupper(trim($this->input('document_number')));

        // Only format valid input; do not silently remove invalid characters or excess digits.
        if (preg_match('/^[A-Z0-9-]+$/D', $number)) {
            $characters = str_replace('-', '', $number);
            $number = implode('-', array_filter([
                substr($characters, 0, 3),
                substr($characters, 3, 2),
                substr($characters, 5),
            ], fn (string $part) => $part !== ''));
        }

        $this->merge(['document_number' => $number]);
    }

    public function rules(): array
    {
        $documentType = $this->input('document_type');
        $isDriversLicense = $documentType === CustomerDocument::DRIVERS_LICENSE;
        $hasTwoSides = $documentType === CustomerDocument::DRIVERS_LICENSE;
        $hasSingleFile = in_array($documentType, [
            CustomerDocument::PROOF_OF_BILLING,
        ], true);
        $fileRules = ['file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'];

        return [
            'document_type' => ['required', Rule::in(CustomerDocument::ALLOWED_DOCUMENT_TYPES)],
            'document_number' => [
                Rule::requiredIf($isDriversLicense),
                'nullable',
                'string',
                'max:13',
                'regex:/^[A-Z0-9]{1,3}(?:-[A-Z0-9]{1,2}(?:-[A-Z0-9]{1,6})?)?$/D',
            ],
            'expires_at' => [
                Rule::requiredIf($isDriversLicense),
                'nullable',
                'date',
                'after:today',
            ],
            'file' => [
                Rule::requiredIf($hasSingleFile),
                'nullable',
                ...$fileRules,
            ],
            'front_file' => [
                Rule::requiredIf($hasTwoSides),
                'nullable',
                ...$fileRules,
            ],
            'back_file' => [
                Rule::requiredIf($hasTwoSides),
                'nullable',
                ...$fileRules,
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'document_number.required' => "The driver's license number is required.",
            'document_number.max' => "The driver's license number must contain at most 11 letters or digits.",
            'document_number.regex' => 'Use only letters and digits, up to 11 characters, formatted like N03-12-123456.',
            'expires_at.required' => "The driver's license expiration date is required.",
            'expires_at.after' => "The driver's license expiration date must be in the future.",
            'file.required' => 'A document image is required.',
            'front_file.required' => 'The front document image is required.',
            'back_file.required' => 'The back document image is required.',
        ];
    }
}
