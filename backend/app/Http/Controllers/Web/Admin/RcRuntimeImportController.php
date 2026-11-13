<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\ImportRcRuntimeRequest;
use App\Services\RcResearchAccessService;
use App\Services\RcRuntimeForestService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class RcRuntimeImportController extends Controller
{
    public function show(Request $request)
    {
        abort_unless(app(RcResearchAccessService::class)->enabled(), 403);

        if ($request->expectsJson()) {
            try {
                app(RcRuntimeForestService::class)->probabilities([array_fill(0, 35, 0.0)]);
                return response()->json(['success' => true, 'message' => 'Model is usable.', 'data' => null]);
            } catch (\Throwable) {
                return response()->json(['success' => false, 'message' => 'Model is unavailable.', 'data' => null], 503);
            }
        }

        return response()->view('rc-runtime-import')->header('Cache-Control', 'no-store');
    }

    public function store(ImportRcRuntimeRequest $request)
    {
        abort_unless(app(RcResearchAccessService::class)->enabled(), 403);
        $path = 'rc-research-v2/datasets/models/pilot-split-v3-yaw-forest-v1/runtime-forest-v1.json.encrypted';
        abort_if(Storage::disk('local')->exists($path), 409, 'A model is already installed.');
        $json = file_get_contents($request->file('model')->getRealPath());
        if ($json === false || ! hash_equals(RcRuntimeForestService::SHA256, hash('sha256', $json))) {
            throw ValidationException::withMessages(['model' => 'This is not the expected runtime model.']);
        }
        abort_unless(Storage::disk('local')->put($path, Crypt::encryptString($json)), 500, 'Model could not be stored.');
        activity()->causedBy($request->user())->event('rc_runtime_model_imported')->log('RC runtime model installed.');

        return response()->json(['success' => true, 'message' => 'Model installed.', 'data' => null])->header('Cache-Control', 'no-store');
    }
}
