<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RcNativeRecording extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['summary' => 'array', 'duration_ms' => 'float', 'expected_bytes' => 'integer',
            'expected_chunks' => 'integer', 'started_at' => 'immutable_datetime', 'verified_at' => 'immutable_datetime'];
    }

    public function collectionContext(): HasOne
    {
        return $this->hasOne(RcCollectionContext::class, 'recording_id');
    }

    public function maneuverContactReview(): HasOne
    {
        return $this->hasOne(RcManeuverContactReview::class, 'recording_id');
    }

    public function latestObservation(): HasOne
    {
        return $this->hasOne(RcObservationRevision::class, 'recording_id')->ofMany('revision', 'max')
            ->select(['rc_observation_revisions.id', 'rc_observation_revisions.recording_id', 'rc_observation_revisions.revision']);
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(RcNativeRecordingChunk::class, 'recording_id');
    }

    public function processingRuns(): HasMany
    {
        return $this->hasMany(RcProcessingRun::class, 'recording_id');
    }

    public function annotationRevisions(): HasMany
    {
        return $this->hasMany(RcAnnotationRevision::class, 'recording_id');
    }

    public function latestAnnotation(): HasOne
    {
        return $this->hasOne(RcAnnotationRevision::class, 'recording_id')->ofMany('revision', 'max')
            ->select(['rc_annotation_revisions.id', 'rc_annotation_revisions.recording_id',
                'rc_annotation_revisions.revision', 'rc_annotation_revisions.state']);
    }
}
