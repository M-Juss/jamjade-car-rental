<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Requests\Delivery\DeliveryRoutesRequest;
use App\Http\Requests\Delivery\PlaceSearchRequest;
use App\Http\Resources\DeliveryQuoteResource;
use App\Models\DeliveryQuote;
use App\Services\DeliveryMapsService;
use App\Services\DeliveryQuoteService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class DeliveryQuoteController extends Controller
{
    use ApiResponseTrait;

    public function suggestions(PlaceSearchRequest $r, DeliveryMapsService $s)
    {
        return $this->success('Address results.', $s->suggestions($r->validated('input'), $r->validated('session_token')));
    }

    public function place(PlaceSearchRequest $r, DeliveryMapsService $s)
    {
        return $this->success('Resolved address.', $s->place($r->validated('place_id'), $r->validated('session_token')));
    }

    public function routes(DeliveryRoutesRequest $r, DeliveryQuoteService $s)
    {
        return $this->success('Delivery route offers.', collect($s->routes($r->user(), $r->validated()))->map(fn ($item) => array_merge(['quote' => (new DeliveryQuoteResource($item['quote']))->resolve($r)], array_diff_key($item, ['quote' => true]))));
    }

    public function index(Request $r)
    {
        return $this->paginated('Your delivery quotes.', DeliveryQuote::where('user_id', $r->user()->id)->whereIn('status', ['awaiting_review', 'ready', 'rejected'])->when($r->filled('vehicle_id'), fn ($query) => $query->where('vehicle_id', $r->integer('vehicle_id')))->latest()->paginate(15), DeliveryQuoteResource::class);
    }

    public function show(Request $r, DeliveryQuote $quote)
    {
        Gate::authorize('view', $quote);

        return $this->success('Delivery quote.', new DeliveryQuoteResource($quote));
    }

    public function select(Request $r, DeliveryQuote $quote, DeliveryQuoteService $s)
    {
        Gate::authorize('select', $quote);

        return $this->success('Route selected.', new DeliveryQuoteResource($s->select($quote, $r->user())));
    }
}
