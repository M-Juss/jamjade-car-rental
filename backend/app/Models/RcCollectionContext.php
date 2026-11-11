<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RcCollectionContext extends Model
{
    protected $primaryKey = 'recording_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    public function isLegacyLaneChange(): bool
    {
        $payload = $this->payload ?? [];

        return ($payload['protocol_code'] ?? null) === 'SW'
            && in_array($payload['catalog_version'] ?? null, ['rc-exercises-v1', 'rc-exercises-v2', 'rc-exercises-v3'], true)
            && ($payload['protocol_snapshot']['layout_key'] ?? null) === 'swerve_recovery';
    }

    public function reviewCode(): string
    {
        return $this->isLegacyLaneChange() ? str_replace('-SW-', '-LC-', $this->display_code) : $this->display_code;
    }

    protected function casts(): array
    {
        return ['payload' => 'encrypted:array'];
    }
}
