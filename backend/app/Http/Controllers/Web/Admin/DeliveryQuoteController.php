<?php

namespace App\Http\Controllers\Web\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Delivery\ReviewDeliveryQuoteRequest;
use App\Http\Resources\DeliveryQuoteResource;
use App\Models\DeliveryQuote;
use App\Services\DeliveryQuoteService;
use App\Traits\ApiResponseTrait;

class DeliveryQuoteController extends Controller
{
    use ApiResponseTrait;

    public function index()
    {
        return $this->paginated('Delivery toll requests.', DeliveryQuote::with(['user:id,name', 'vehicle:id,name'])->where('status', 'awaiting_review')->where('review_deadline', '>', now())->oldest()->paginate(15), DeliveryQuoteResource::class);
    }

    public function route(DeliveryQuote $quote, DeliveryQuoteService $service)
    {
        return $this->success('Selected delivery route.', $service->selectedRoute($quote));
    }

    public function review(ReviewDeliveryQuoteRequest $r, DeliveryQuote $quote, DeliveryQuoteService $s)
    {
        return $this->success('Delivery quote reviewed.', new DeliveryQuoteResource($s->review($quote, $r->user(), $r->validated())));
    }
}
