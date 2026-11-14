<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Models\Booking;
use App\Models\BookingEvent;
use App\Models\CustomerDocument;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DocumentRetentionService
{
    public function __construct(private readonly DocumentVerificationService $verification) {}

    public function archiveExpired(): int
    {
        $count = 0;
        CustomerDocument::query()->whereIn('document_type', CustomerDocument::REQUIRED_SELF_DRIVE_DOCUMENTS)
            ->where('submitted_at', '<=', now()->subMonthsNoOverflow(12))->lazyById()->each(function ($candidate) use (&$count) {
                $count += DB::transaction(function () use ($candidate) {
                    $user = User::query()->whereKey($candidate->user_id)->lockForUpdate()->first();
                    $document = CustomerDocument::query()->whereKey($candidate->id)->lockForUpdate()->first();
                    if (! $user || ! $document || ! $document->submitted_at) {
                        return 0;
                    }
                    $bookings = Booking::query()->where('user_id', $user->id);
                    if ((clone $bookings)->where('rental_type', RentalType::SelfDrive->value)
                        ->whereIn('status', [BookingStatus::Pending->value, BookingStatus::Confirmed->value, BookingStatus::Ongoing->value, BookingStatus::Returned->value])->exists()) {
                        return 0;
                    }
                    $lastCompleted = BookingEvent::query()->where('event_type', 'status_changed')
                        ->where('new_status', BookingStatus::Completed->value)
                        ->whereIn('booking_id', (clone $bookings)->select('id'))->max('created_at');
                    if ((clone $bookings)->where('status', BookingStatus::Completed->value)
                        ->whereDoesntHave('events', fn ($query) => $query->where('event_type', 'status_changed')
                            ->where('new_status', BookingStatus::Completed->value))->exists()) {
                        return 0;
                    }
                    $anchor = $document->reviewed_at ?? $document->submitted_at;
                    if ($lastCompleted && Carbon::parse($lastCompleted)->greaterThan($anchor)) {
                        $anchor = Carbon::parse($lastCompleted);
                    }
                    if ($anchor->copy()->addMonthsNoOverflow(12)->isFuture()) {
                        return 0;
                    }
                    $paths = $document->files()->pluck('file_path')->filter()->unique()->values()->all();
                    foreach ($paths as $path) {
                        DB::table('document_retention_file_deletions')->insert([
                            'user_id' => $user->id,
                            'file_path' => $path,
                            'created_at' => now(),
                        ]);
                    }
                    $document->files()->delete();
                    $document->delete();
                    $this->verification->refreshCustomerSelfDriveStatus($user);

                    return 1;
                });
            });

        $this->removeArchivedFiles();

        return $count;
    }

    private function removeArchivedFiles(): void
    {
        DB::table('document_retention_file_deletions')->orderBy('id')->lazyById()->each(function ($candidate) {
            DB::transaction(function () use ($candidate) {
                // Uploads lock the same user before restoring a document.
                User::query()->whereKey($candidate->user_id)->lockForUpdate()->first();
                $pending = DB::table('document_retention_file_deletions')->where('id', $candidate->id)->lockForUpdate()->first();
                if (! $pending) {
                    return;
                }

                $inUse = DB::table('customer_document_files')
                    ->join('customer_documents', 'customer_documents.id', '=', 'customer_document_files.customer_document_id')
                    ->whereNull('customer_documents.deleted_at')
                    ->where('customer_document_files.file_path', $pending->file_path)->exists();
                if ($inUse) {
                    DB::table('document_retention_file_deletions')->where('id', $pending->id)->delete();

                    return;
                }

                try {
                    $disk = Storage::disk('public');
                    if (($disk->exists($pending->file_path) && ! $disk->delete($pending->file_path)) || $disk->exists($pending->file_path)) {
                        Log::warning('Verification document retention could not remove a file.', ['cleanup_id' => $pending->id]);

                        return;
                    }
                } catch (\Throwable $exception) {
                    Log::warning('Verification document retention could not remove a file.', ['cleanup_id' => $pending->id]);

                    return;
                }

                DB::table('document_retention_file_deletions')->where('id', $pending->id)->delete();
            });
        });
    }
}
