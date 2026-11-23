<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PublicFeedbackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $parts = preg_split('/\s+/u', trim($this->customer->name), -1, PREG_SPLIT_NO_EMPTY);
        $profile = $this->customer->customerProfile;
        $name = trim($profile?->first_name ?? '') ?: ($parts[0] ?? 'Customer');
        $lastName = trim($profile?->last_name ?? '') ?: (count($parts) > 1 ? end($parts) : '');
        if ($lastName !== '') {
            $name .= ' '.Str::substr($lastName, 0, 1).'.';
        }

        return ['id' => $this->id, 'name' => $name, 'rating' => $this->rating, 'comment' => $this->comment];
    }
}
