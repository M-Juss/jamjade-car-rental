<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CustomerDocument extends Model
{
    use HasFactory, SoftDeletes;

    /** @var array<string, string|null> */
    private array $pendingFiles = [];

    public const VALID_ID = 'valid_id';

    public const DRIVERS_LICENSE = 'drivers_license';

    public const PASSPORT = 'passport';

    public const PROOF_OF_BILLING = 'proof_of_billing';

    public const ALLOWED_DOCUMENT_TYPES = [
        self::DRIVERS_LICENSE,
        self::PROOF_OF_BILLING,
    ];

    public const REQUIRED_SELF_DRIVE_DOCUMENTS = [
        self::DRIVERS_LICENSE,
        self::PROOF_OF_BILLING,
    ];

    public static function requiredSelfDriveDocumentsFor(User $user): array
    {
        return self::REQUIRED_SELF_DRIVE_DOCUMENTS;
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

    protected static function booted(): void
    {
        static::saved(fn (CustomerDocument $document) => $document->persistPendingFiles());
    }

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

    public function files(): HasMany
    {
        return $this->hasMany(CustomerDocumentFile::class)->orderBy('id');
    }

    public function getFilePathAttribute(): ?string
    {
        return $this->fileForRole('primary') ?? $this->fileForRole('front');
    }

    public function setFilePathAttribute(?string $value): void
    {
        $this->pendingFiles['primary'] = $value;
    }

    public function getFrontFilePathAttribute(): ?string
    {
        return $this->fileForRole('front');
    }

    public function setFrontFilePathAttribute(?string $value): void
    {
        $this->pendingFiles['front'] = $value;
    }

    public function getBackFilePathAttribute(): ?string
    {
        return $this->fileForRole('back');
    }

    public function setBackFilePathAttribute(?string $value): void
    {
        $this->pendingFiles['back'] = $value;
    }

    /** @param array{primary?: string|null, front?: string|null, back?: string|null} $files */
    public function syncFiles(array $files): void
    {
        foreach ($files as $role => $path) {
            $this->pendingFiles[$role] = $path;
        }

        $this->persistPendingFiles();
    }

    public static function labelFor(string $type): string
    {
        return match ($type) {
            self::VALID_ID => 'Valid ID',
            self::DRIVERS_LICENSE => "Driver's License",
            self::PASSPORT => 'Passport',
            self::PROOF_OF_BILLING => 'Proof of Address',
            default => str($type)->replace('_', ' ')->title()->toString(),
        };
    }

    private function fileForRole(string $role): ?string
    {
        if (array_key_exists($role, $this->pendingFiles)) {
            return $this->pendingFiles[$role];
        }

        if ($this->relationLoaded('files')) {
            return $this->files->firstWhere('role', $role)?->file_path;
        }

        return $this->exists
            ? $this->files()->where('role', $role)->value('file_path')
            : null;
    }

    private function persistPendingFiles(): void
    {
        if (! $this->exists || $this->pendingFiles === []) {
            return;
        }

        foreach ($this->pendingFiles as $role => $path) {
            if (blank($path)) {
                $this->files()->where('role', $role)->delete();

                continue;
            }

            $this->files()->updateOrCreate(['role' => $role], ['file_path' => $path]);
        }

        $this->pendingFiles = [];
        $this->unsetRelation('files');
    }
}
