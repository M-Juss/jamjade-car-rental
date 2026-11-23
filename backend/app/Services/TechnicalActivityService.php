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
                'Uploaded research recording' as message, 'success' as status", [$user->name]);
        $logins = DB::table((new Activity)->getTable())->where('causer_type', $user->getMorphClass())
            ->where('causer_id', $user->id)->where('event', 'mobile_rc_research_login')
            ->selectRaw("CONCAT('login-', id) as id, created_at, ? as actor, 'research' as module, 'created' as action,
                'Signed in to research' as message, 'success' as status", [$user->name]);
        $query = DB::query()->fromSub($recordings->unionAll($logins), 'technical_activity');
        if (($filters['module'] ?? 'all') !== 'all') {
            $query->where('module', $filters['module']);
        }
        if (($filters['action'] ?? 'all') !== 'all') {
            $query->where('action', $filters['action']);
        }
        if (($filters['status'] ?? 'all') !== 'all') {
            $query->where('status', $filters['status']);
        }
        if ($search = trim($filters['search'] ?? '')) {
            $query->where(fn ($q) => $q->where('actor', 'like', '%'.$search.'%')->orWhere('message', 'like', '%'.$search.'%'));
        }

        return $query->orderByDesc('created_at')->orderByDesc('id')->paginate(10);
    }
}
