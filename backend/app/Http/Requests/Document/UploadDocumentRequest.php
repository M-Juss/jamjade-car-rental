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

    public function rules(): array
    {
        $documentType = $this->input('document_type');
        $isDriversLicense = $documentType === CustomerDocument::DRIVERS_LICENSE;
        $hasTwoSides = $documentType === CustomerDocument::DRIVERS_LICENSE;
        $hasSingleFile = in_array($documentType, [
            CustomerDocument::PASSPORT,
            CustomerDocument::PROOF_OF_BILLING,
        ], true);
        $fileRules = ['file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'];

        return [
            'document_type' => ['required', Rule::in(CustomerDocument::ALLOWED_DOCUMENT_TYPES)],
            'document_number' => [
                Rule::requiredIf($isDriversLicense),
                'nullable',
                'string',
                'max:100',
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
            'expires_at.required' => "The driver's license expiration date is required.",
            'expires_at.after' => "The driver's license expiration date must be in the future.",
            'file.required' => 'A document image is required.',
            'front_file.required' => 'The front document image is required.',
            'back_file.required' => 'The back document image is required.',
        ];
    }
}
