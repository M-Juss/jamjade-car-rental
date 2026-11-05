<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Research\StoreRcCollectionContextRequest;
use App\Http\Requests\Research\StoreRcObservationRequest;
use App\Http\Resources\RcCollectionStatusResource;
use App\Models\RcNativeRecording;
use App\Services\RcCollectionService;
use App\Services\RcNativeResearchService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;

class RcCollectionController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private RcCollectionService $collection, private RcNativeResearchService $research) {}

    public function catalog()
    {
        return $this->success('Exercise protocols.', $this->collection->catalog())->header('Cache-Control', 'private, no-store');
    }

    public function status(Request $request)
    {
        $input = $request->validate(['ids' => ['required', 'array', 'list', 'min:1', 'max:10'], 'ids.*' => ['required', 'uuid', 'distinct']]);
        $records = RcNativeRecording::where('user_id', $request->user()->id)->whereIn('client_recording_id', $input['ids'])
            ->with(['collectionContext:recording_id,display_code', 'latestObservation', 'latestAnnotation'])->get();

        return $this->success('Recording status.', RcCollectionStatusResource::collection($records))->header('Cache-Control', 'private, no-store');
    }

    public function context(StoreRcCollectionContextRequest $request, string $recording)
    {
        $record = $this->research->recording($request->user(), $recording);
        $this->collection->context($record, $request->validated());

        return $this->response($record);
    }

    public function observe(StoreRcObservationRequest $request, string $recording)
    {
        $record = $this->research->recording($request->user(), $recording);
        $this->collection->observe($record, $request->validated());

        return $this->response($record);
    }

    private function response(RcNativeRecording $record)
    {
        return $this->success('Collection details saved.', new RcCollectionStatusResource($record->load(['collectionContext:recording_id,display_code', 'latestObservation', 'latestAnnotation'])))
            ->header('Cache-Control', 'private, no-store');
    }
}
