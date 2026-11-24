<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class TechnicalActivityService
{
    public function paginate(User $user, array $filters): LengthAwarePaginator
    {
        $recordings = DB::table('rc_native_recordings')->where('user_id', $user->id)
            ->selectRaw("CONCAT('recording-', id) as id, created_at, ? as actor, 'research' as module, 'created' as action,
                'Created research upload' as message, 'success' as status", [$user->name]);
        $logins = DB::table((new Activity)->getTable())->where('causer_type', $user->getMorphClass())
            ->where('causer_id', $user->id)->where('event', 'mobile_rc_research_login')
            ->selectRaw("CONCAT('login-', id) as id, created_at, ? as actor, 'research' as module, 'created' as action,
                'Signed in to research' as message, 'success' as status", [$user->name]);
        foreach ([[$recordings, 'Created research upload'], [$logins, 'Signed in to research']] as [$query, $message]) {
            if (! in_array($filters['module'] ?? 'all', ['all', 'research'], true)
                || ! in_array($filters['action'] ?? 'all', ['all', 'created'], true)
                || ! in_array($filters['status'] ?? 'all', ['all', 'success'], true)) {
                $query->whereRaw('1 = 0');
            }
            if ($search = trim($filters['search'] ?? '')) {
                $query->whereRaw('(? LIKE ? OR ? LIKE ?)', [$user->name, '%'.$search.'%', $message, '%'.$search.'%']);
            }
        }

        // Count sources separately, matching AuditLogService's MySQL 8.0.33 safeguard.
        $total = (clone $recordings)->count() + (clone $logins)->count();
        $page = LengthAwarePaginator::resolveCurrentPage();
        $items = $recordings->unionAll($logins)->orderByDesc('created_at')->orderByDesc('id')
            ->offset(($page - 1) * 10)->limit(10)->get();

        return new LengthAwarePaginator($items, $total, 10, $page, ['path' => LengthAwarePaginator::resolveCurrentPath()]);
    }
}
