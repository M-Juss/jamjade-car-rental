<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerDocument extends Model
{
    use HasFactory, SoftDeletes;

    public const VALID_ID = 'valid_id';

    public const DRIVERS_LICENSE = 'drivers_license';

    public const PASSPORT = 'passport';

    public const PROOF_OF_BILLING = 'proof_of_billing';

    public const ALLOWED_DOCUMENT_TYPES = [
        self::DRIVERS_LICENSE,
        self::PASSPORT,
        self::PROOF_OF_BILLING,
    ];

    public const REQUIRED_SELF_DRIVE_DOCUMENTS = [
        self::DRIVERS_LICENSE,
        self::PROOF_OF_BILLING,
    ];

    public static function requiredSelfDriveDocumentsFor(User $user): array
    {
        $requiredDocuments = self::REQUIRED_SELF_DRIVE_DOCUMENTS;

        if ($user->customerProfile?->passport_required) {
            $requiredDocuments[] = self::PASSPORT;
        }

        return $requiredDocuments;
    }

    protected $fillable = [
        'user_id',
        'document_type',
        'document_number',
        'expires_at',
        'file_path',
        'front_file_path',
        'back_file_path',
        'status',
        'submitted_at',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => DocumentStatus::class,
            'expires_at' => 'date',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public static function labelFor(string $type): string
    {
        return match ($type) {
            self::VALID_ID => 'Valid ID',
            self::DRIVERS_LICENSE => "Driver's License",
            self::PASSPORT => 'Passport',
            self::PROOF_OF_BILLING => 'Meralco Bill',
            default => str($type)->replace('_', ' ')->title()->toString(),
        };
    }
}
