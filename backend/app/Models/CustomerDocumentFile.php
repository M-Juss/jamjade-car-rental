<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerDocumentFile extends Model
{
    protected $fillable = ['role', 'file_path'];

    public function document(): BelongsTo
    {
        return $this->belongsTo(CustomerDocument::class, 'customer_document_id');
    }
}
