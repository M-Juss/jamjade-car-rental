<?php

namespace App\Services;

use App\Models\OperationalError;
use Illuminate\Support\Facades\Log;
use Throwable;

class OperationalErrorService
{
    public function record(string $category, ?int $bookingId = null): void
    {
        if (! isset(AuditLogService::FAILURES[$category])) {
            return;
        }

        try {
            OperationalError::query()->create([
                'category' => $category,
                'booking_id' => $bookingId,
                'actor_user_id' => auth()->id(),
                'actor_name' => auth()->user()?->name ?? 'System',
                'action' => $this->action($category),
            ]);
            if (app()->bound('request')) {
                request()->attributes->set('audit_failure_recorded', true);
            }
        } catch (Throwable $exception) {
            Log::warning('Operational error could not be recorded.', ['exception_type' => $exception::class]);
        }
    }

    private function action(string $category): string
    {
        $request = app()->bound('request') ? request() : null;

        return match (true) {
            $request?->isMethod('DELETE') => 'deleted',
            $request?->is('*/approve') => 'approved',
            $request?->is('*/reject') => 'rejected',
            $request?->isMethod('PUT'), $request?->isMethod('PATCH'), $request?->is('*/photo') => 'updated',
            $category === 'settings' => 'updated',
            default => AuditLogService::FAILURES[$category][1] ?? 'updated',
        };
    }
}
