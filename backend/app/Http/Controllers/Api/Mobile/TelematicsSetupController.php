<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\StoreSetupAttemptRequest;
use App\Http\Resources\TelematicsHandoverResource;
use App\Models\Booking;
use App\Services\TelematicsHandoverEligibilityService;
use App\Services\TelematicsSetupService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelematicsSetupController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly TelematicsHandoverEligibilityService $eligibility) {}

    public function current(Request $request): JsonResponse
    {
        $booking = $this->eligibility->currentBookingFor($request->user());

        return $this->success(
            $booking ? 'Telematics setup fetched successfully.' : 'No self-drive telematics setup is currently eligible.',
            $booking ? new TelematicsHandoverResource($booking) : null
        );
    }

    public function show(Request $request, string $booking): JsonResponse
    {
        $booking = $this->eligibleBookings($request)
            ->where(fn ($query) => $query->where('booking_code', $booking)->orWhere('id', $booking))
            ->firstOrFail();

        return $this->success('Telematics setup fetched successfully.', new TelematicsHandoverResource($booking));
    }

    public function attempt(StoreSetupAttemptRequest $request, string $booking, string $step): JsonResponse
    {
        $booking = $this->eligibleBookings($request)
            ->where(fn ($query) => $query->where('booking_code', $booking)->orWhere('id', $booking))
            ->firstOrFail();

        app(TelematicsSetupService::class)->recordMobileAttempt(
            $booking,
            $step,
            // Validation has already established this is an array. Reading the
            // nested payload directly also preserves its typed evidence keys.
            $request->input('evidence'),
            $request->user()
        );

        return $this->success(
            'Telematics setup attempt recorded.',
            new TelematicsHandoverResource($booking->fresh($this->handoverRelations()))
        );
    }

    private function eligibleBookings(Request $request)
    {
        return Booking::query()->with($this->handoverRelations())
            ->where('user_id', $request->user()->id)
            ->where('rental_type', RentalType::SelfDrive->value)
            ->whereIn('status', [BookingStatus::Confirmed->value, BookingStatus::Ongoing->value]);
    }

    private function handoverRelations(): array
    {
        return [
            'telematicsSetupSession.steps',
            'telematicsTrips',
        ];
    }
}
