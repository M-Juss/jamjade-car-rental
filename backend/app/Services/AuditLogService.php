<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AuditLogService
{
    // Only business operations belong here. Never return activity descriptions or properties.
    public const EVENTS = [
        'booking_created' => ['bookings', 'created', 'Created booking'],
        'booking_status_changed' => ['bookings', 'updated', 'Updated booking'],
        'booking_dates_revised' => ['bookings', 'updated', 'Updated booking dates'],
        'booking_driver_assigned' => ['bookings', 'updated', 'Assigned booking driver'],
        'booking_driver_reassigned' => ['bookings', 'updated', 'Reassigned booking driver'],
        'vehicle_received' => ['bookings', 'updated', 'Recorded vehicle return'],
        'return_follow_up' => ['bookings', 'updated', 'Recorded return follow-up'],
        'booking_outgoing_inspection_finalized' => ['bookings', 'updated', 'Completed outgoing inspection'],
        'booking_incoming_inspection_finalized' => ['bookings', 'updated', 'Completed incoming inspection'],
        'payment_recorded' => ['payments', 'created', 'Recorded payment'],
        'booking_refund_reviewed' => ['payments', 'updated', 'Reviewed booking refund'],
        'booking_refund_recorded' => ['payments', 'created', 'Recorded booking refund'],
        'paypal_payment_captured' => ['payments', 'created', 'Confirmed payment'],
        'driver_additional_charge_payment_captured' => ['payments', 'created', 'Confirmed additional payment'],
        'booking_additional_charge_created' => ['payments', 'created', 'Added booking charge'],
        'booking_additional_charge_updated' => ['payments', 'updated', 'Updated booking charge'],
        'booking_additional_charge_deleted' => ['payments', 'deleted', 'Deleted booking charge'],
        'booking_return_charges_finalized' => ['payments', 'updated', 'Finalized return charges'],
        'late_charge_reviewed' => ['payments', 'updated', 'Reviewed late charge'],
        'vehicle_created' => ['vehicles', 'created', 'Created vehicle'],
        'vehicle_updated' => ['vehicles', 'updated', 'Updated vehicle details'],
        'vehicle_deleted' => ['vehicles', 'deleted', 'Deleted vehicle'],
        'vehicle_condition_update_finalized' => ['vehicles', 'updated', 'Updated vehicle condition'],
        'initial_vehicle_condition_finalized' => ['vehicles', 'created', 'Recorded initial vehicle condition'],
        'maintenance_plan_created' => ['maintenance', 'created', 'Created maintenance plan'],
        'maintenance_plan_updated' => ['maintenance', 'updated', 'Updated maintenance plan'],
        'maintenance_plan_deleted' => ['maintenance', 'deleted', 'Deleted maintenance plan'],
        'maintenance_plan_deactivated' => ['maintenance', 'updated', 'Deactivated maintenance plan'],
        'maintenance_scheduled' => ['maintenance', 'created', 'Scheduled maintenance'],
        'maintenance_rescheduled' => ['maintenance', 'updated', 'Rescheduled maintenance'],
        'maintenance_started' => ['maintenance', 'updated', 'Started maintenance'],
        'maintenance_cancelled' => ['maintenance', 'updated', 'Cancelled maintenance'],
        'maintenance_completion_details_recorded' => ['maintenance', 'updated', 'Recorded maintenance completion details'],
        'maintenance_completed' => ['maintenance', 'updated', 'Completed maintenance'],
        'personnel_created' => ['personnel', 'created', 'Created personnel account'],
        'personnel_updated' => ['personnel', 'updated', 'Updated personnel account'],
        'personnel_permanently_deleted' => ['personnel', 'deleted', 'Deleted personnel account'],
        'personnel_deleted' => ['personnel', 'deleted', 'Deleted personnel account'],
        'personnel_photo_updated' => ['personnel', 'updated', 'Updated personnel photo'],
        'personnel_photo_deleted' => ['personnel', 'deleted', 'Removed personnel photo'],
        'admin_invited' => ['personnel', 'created', 'Invited administrator'],
        'admin_invitation_accepted' => ['personnel', 'approved', 'Accepted administrator invitation'],
        'admin_invitation_cancelled' => ['personnel', 'deleted', 'Cancelled administrator invitation'],
        'admin_access_revoked' => ['personnel', 'updated', 'Revoked administrator access'],
        'document_uploaded' => ['documents', 'created', 'Submitted verification document'],
        'document_approved' => ['documents', 'approved', 'Approved verification document'],
        'document_rejected' => ['documents', 'rejected', 'Rejected verification document'],
        'document_reviewed' => ['documents', 'updated', 'Reviewed verification document'],
        'vehicle_configuration_saved' => ['settings', 'updated', 'Saved vehicle configuration'],
        'vehicle_configuration_deactivated' => ['settings', 'updated', 'Deactivated vehicle option'],
        'vehicle_configuration_deleted' => ['settings', 'deleted', 'Deleted vehicle option'],
        'owner_email_updated' => ['settings', 'updated', 'Updated Owner email'],
        'delivery_pricing_updated' => ['settings', 'updated', 'Updated delivery pricing'],
        'late_pricing_updated' => ['settings', 'updated', 'Updated late-return pricing'],
        'mobile_password_changed' => ['settings', 'updated', 'Updated account password'],
    ];

    public const FAILURES = [
        'payment_start' => ['payments', 'created', 'Payment could not be started'],
        'payment' => ['payments', 'created', 'Payment could not be confirmed'],
        'booking' => ['bookings', 'created', 'Booking could not be completed'],
        'documents' => ['documents', 'created', 'Booking documents could not be prepared or sent'],
        'personnel' => ['personnel', 'updated', 'Personnel action could not be completed'],
        'vehicles' => ['vehicles', 'updated', 'Vehicle action could not be completed'],
        'maintenance' => ['maintenance', 'updated', 'Maintenance action could not be completed'],
        'settings' => ['settings', 'updated', 'Settings could not be updated'],
    ];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $boundary = DB::table('activity_log_settings')->where('id', 1)->first();
        abort_unless($boundary, 503, 'Activity Log is not configured.');
        $success = DB::table((new Activity)->getTable().' as activities')
            ->where('activities.id', '>', $boundary->activity_after_id)
            ->leftJoin('users', function ($join) {
                $join->on('users.id', '=', 'activities.causer_id')->where('activities.causer_type', (new User)->getMorphClass());
            });
        $failure = DB::table('operational_errors')->where('id', '>', $boundary->failure_after_id);
        $catalog = self::EVENTS;
        // Older pricing records used a log name rather than an event.
        $catalog['legacy_delivery_pricing'] = self::EVENTS['delivery_pricing_updated'];
        $catalog['legacy_late_pricing'] = self::EVENTS['late_pricing_updated'];
        $catalog['legacy_document_approved'] = self::EVENTS['document_approved'];
        $catalog['legacy_document_rejected'] = self::EVENTS['document_rejected'];
        $search = trim($filters['search'] ?? '');

        $this->scopeSuccess($success, $catalog, $filters);
        $failure->whereIn('category', array_keys(self::FAILURES));
        if (($filters['status'] ?? 'all') === 'failed') {
            $success->whereRaw('1 = 0');
        }
        if (($filters['status'] ?? 'all') === 'success') {
            $failure->whereRaw('1 = 0');
        }
        $failure->where(function (Builder $query) use ($filters) {
            foreach (self::FAILURES as $category => $values) {
                if (($filters['module'] ?? 'all') !== 'all' && $values[0] !== $filters['module']) {
                    continue;
                }
                $query->orWhere(function (Builder $query) use ($category, $values, $filters) {
                    $query->where('category', $category);
                    if (($filters['action'] ?? 'all') !== 'all') {
                        $query->where(function (Builder $query) use ($values, $filters) {
                            $query->where('action', $filters['action']);
                            if ($values[1] === $filters['action']) {
                                $query->orWhereNull('action');
                            }
                        });
                    }
                });
            }
            // An empty set of compatible categories must match no rows.
            $query->orWhereRaw('1 = 0');
        });
        if ($search !== '') {
            $success->where(function (Builder $query) use ($catalog, $search) {
                $query->whereRaw("COALESCE(users.name, CASE WHEN activities.causer_id IS NULL THEN 'System' ELSE 'Former user' END) LIKE ?", ['%'.$search.'%']);
                foreach ($catalog as $event => $values) {
                    if (stripos($values[2], $search) !== false) {
                        $query->orWhere(fn (Builder $query) => $this->matchEvent($query, $event));
                    }
                }
            });
            $failure->where(function (Builder $query) use ($search) {
                $query->whereRaw("COALESCE(actor_name, 'Not recorded') LIKE ?", ['%'.$search.'%']);
                $categories = array_keys(array_filter(self::FAILURES, fn ($values) => stripos($values[2], $search) !== false));
                $query->orWhereIn('category', $categories);
            });
        }
        // Count each source directly: filtering/counting a materialized UNION can
        // crash MySQL 8.0.33. Limit the combined read to the requested page only.
        $total = (clone $success)->count() + (clone $failure)->count();
        $success->selectRaw("CONCAT('activity-', activities.id) as id, activities.created_at, COALESCE(users.name, CASE WHEN activities.causer_id IS NULL THEN 'System' ELSE 'Former user' END) as actor, 'success' as status");
        $failure->selectRaw("CONCAT('failure-', id) as id, created_at, COALESCE(actor_name, 'Not recorded') as actor, 'failed' as status");
        foreach (['module', 'action', 'message'] as $index => $column) {
            $this->selectSuccessCase($success, $catalog, $index, $column);
            $this->selectFailureCase($failure, $index, $column);
        }
        $page = LengthAwarePaginator::resolveCurrentPage();
        $items = $total ? $success->unionAll($failure)->orderByDesc('created_at')->orderByDesc('id')->offset(($page - 1) * 10)->limit(10)->get() : collect();

        return new LengthAwarePaginator($items, $total, 10, $page, ['path' => LengthAwarePaginator::resolveCurrentPath()]);
    }

    private function scopeSuccess(Builder $query, array $catalog, array $filters): void
    {
        $query->where(function (Builder $query) use ($catalog, $filters) {
            foreach ($catalog as $event => $values) {
                if (($filters['module'] ?? 'all') !== 'all' && $values[0] !== $filters['module']) {
                    continue;
                }
                if (($filters['action'] ?? 'all') !== 'all' && $values[1] !== $filters['action']) {
                    continue;
                }
                $query->orWhere(fn (Builder $query) => $this->matchEvent($query, $event));
            }
            $query->orWhereRaw('1 = 0');
        });
    }

    private function matchEvent(Builder $query, string $event): void
    {
        if (in_array($event, ['legacy_delivery_pricing', 'legacy_late_pricing'], true)) {
            $query->whereNull('activities.event')->where('activities.log_name', $event === 'legacy_delivery_pricing' ? 'delivery-pricing' : 'late-return-pricing');
        } elseif (in_array($event, ['legacy_document_approved', 'legacy_document_rejected'], true)) {
            $query->where('activities.event', 'document_reviewed')->where('activities.properties->status', $event === 'legacy_document_approved' ? 'approved' : 'rejected');
        } else {
            $query->where('activities.event', $event);
            if ($event === 'document_reviewed') {
                $query->where(fn (Builder $query) => $query->whereNull('activities.properties->status')->orWhereNotIn('activities.properties->status', ['approved', 'rejected']));
            }
        }
    }

    private function selectSuccessCase(Builder $query, array $catalog, int $index, string $column): void
    {
        $sql = 'CASE';
        $bindings = [];
        foreach ($catalog as $event => $values) {
            $condition = DB::query();
            $this->matchEvent($condition, $event);
            $where = DB::connection()->getQueryGrammar()->compileWheres($condition);
            $sql .= ' WHEN '.substr($where, 6).' THEN ?';
            array_push($bindings, ...$condition->getBindings());
            $bindings[] = $values[$index];
        }
        $query->selectRaw($sql.' END as '.$column, $bindings);
    }

    private function selectFailureCase(Builder $query, int $index, string $column): void
    {
        $sql = 'CASE category';
        $bindings = [];
        foreach (self::FAILURES as $key => $values) {
            $sql .= ' WHEN ? THEN ?';
            array_push($bindings, $key, $values[$index]);
        }
        $expression = $sql.' END';
        if ($column === 'action') {
            $expression = 'COALESCE(action, '.$expression.')';
        }
        $query->selectRaw($expression.' as '.$column, $bindings);
    }
}
