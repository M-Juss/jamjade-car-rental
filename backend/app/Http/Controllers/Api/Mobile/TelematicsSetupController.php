<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Enums\BookingStatus;
use App\Enums\RentalType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Telematics\ListTelematicsRentalsRequest;
use App\Http\Requests\Telematics\RestartSetupRequest;
use App\Http\Requests\Telematics\StoreSetupAttemptRequest;
use App\Http\Resources\TelematicsHandoverResource;
use App\Http\Resources\TelematicsRentalResource;
use App\Models\Booking;
use App\Services\DriverAssignmentService;
use App\Services\SelfDriveBookingAvailabilityService;
use App\Services\TelematicsHandoverEligibilityService;
use App\Services\TelematicsSetupService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelematicsSetupController extends Controller
{
    use ApiResponseTrait;

    public function __construct(private readonly TelematicsHandoverEligibilityService $eligibility) {}

    public function index(ListTelematicsRentalsRequest $request): JsonResponse
    {
        $rentals = $this->eligibility->paginateRentalsFor($request->user(), $request->integer('per_page', 10));
        $activeIds = $request->user()->hasRole('customer')
            ? app(SelfDriveBookingAvailabilityService::class)->activeHandoversForCustomer($request->user()->id)->pluck('id')
            : collect();
        $rentals->through(fn (Booking $booking) => new TelematicsRentalResource(
            $booking,
            ! $request->user()->hasRole('customer') || ! $activeIds->contains(fn ($id) => (int) $id !== $booking->id),
        ));

        return $this->paginated('Telematics rentals fetched successfully.', $rentals);
    }

    public function current(Request $request): JsonResponse
    {
        $booking = $this->eligibility->currentBookingFor($request->user());

        return $this->success(
            $booking ? 'Telematics setup fetched successfully.' : 'No assigned telematics setup is currently eligible.',
            $booking ? new TelematicsHandoverResource($booking) : null
        );
    }

    public function show(Request $request, string $booking): JsonResponse
    {
        $booking = $this->eligibleBookings($request, includeHistory: true)
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

    public function restart(RestartSetupRequest $request, string $booking): JsonResponse
    {
        $booking = $this->eligibleBookings($request)
            ->where(fn ($query) => $query->where('booking_code', $booking)->orWhere('id', $booking))
            ->firstOrFail();

        app(TelematicsSetupService::class)->restartMobileSetup($booking, $request->user(), $request->validated('context'));

        return $this->success('Telematics setup restarted.', new TelematicsHandoverResource($booking->fresh($this->handoverRelations())));
    }

    private function eligibleBookings(Request $request, bool $includeHistory = false)
    {
        return Booking::query()->with($this->handoverRelations())
            ->where(function ($query) use ($request) {
                if ($request->user()->hasRole('customer')) {
                    $query->where(fn ($nested) => $nested->where('user_id', $request->user()->id)
                        ->where('rental_type', RentalType::SelfDrive->value));
                }
                if ($request->user()->hasRole(DriverAssignmentService::DRIVER_ROLE)) {
                    $query->orWhere(fn ($nested) => $nested->where('rental_type', RentalType::OwnersDriver->value)
                        ->whereHas('assignment', fn ($assignment) => $assignment->where('driver_id', $request->user()->id)));
                }
                if (! $request->user()->hasRole('customer') && ! $request->user()->hasRole(DriverAssignmentService::DRIVER_ROLE)) {
                    $query->whereRaw('1 = 0');
                }
            })
            ->whereIn('status', $includeHistory
                ? [BookingStatus::Confirmed->value, BookingStatus::Ongoing->value, BookingStatus::Returned->value, BookingStatus::Completed->value]
                : [BookingStatus::Confirmed->value, BookingStatus::Ongoing->value]);
    }

    private function handoverRelations(): array
    {
        return [
            'telematicsSetupSession.steps',
            'telematicsTrips',
        ];
    }
}
