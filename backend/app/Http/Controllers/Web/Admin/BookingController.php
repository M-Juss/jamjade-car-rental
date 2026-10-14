<?php

namespace App\Http\Controllers\Web\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Booking\AssignDriverRequest;
use App\Http\Requests\Admin\Booking\ListBookingsRequest;
use App\Http\Requests\Admin\Booking\StoreAdditionalChargesRequest;
use App\Http\Requests\Admin\Booking\StoreBookingInspectionRequest;
use App\Http\Requests\Admin\BookingStatusRequest;
use App\Http\Resources\AdditionalChargeResource;
use App\Http\Resources\BookingResource;
use App\Http\Resources\VehicleInspectionResource;
use App\Models\Booking;
use App\Models\BookingAssignment;
use App\Models\User;
use App\Services\AdditionalChargeService;
use App\Services\BookingEmailService;
use App\Services\BookingInspectionService;
use App\Services\BookingService;
use App\Services\DriverAssignmentService;
use App\Services\RentalReadinessService;
use App\Services\TelematicsSetupService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class BookingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        private readonly BookingService $bookingService,
        private readonly BookingEmailService $bookingEmailService,
        private readonly DriverAssignmentService $driverAssignmentService,
        private readonly BookingInspectionService $inspectionService,
        private readonly AdditionalChargeService $additionalChargeService,
        private readonly RentalReadinessService $readinessService,
        private readonly TelematicsSetupService $telematicsSetupService
    ) {}

    public function index(ListBookingsRequest $request): JsonResponse
    {
        $bookings = $this->bookingService->paginateForAdmin(
            $request->safe()->only(['search', 'status', 'payment_status', 'group']),
            $request->integer('per_page', 15)
        );

        return $this->paginated('Bookings fetched successfully.', $bookings, BookingResource::class, [
            'status_counts' => $this->bookingService->adminStatusCounts(),
        ]);
    }

    public function show(Booking $booking): JsonResponse
    {
        return $this->success(
            'Booking fetched successfully.',
            new BookingResource($booking->load($this->detailRelations()))
        );
    }

    public function drivers(): JsonResponse
    {
        $drivers = $this->driverAssignmentService->driverCandidates();

        $assignmentCounts = BookingAssignment::query()
            ->whereIn('driver_id', $drivers->pluck('id'))
            ->whereHas('booking', fn ($query) => $query->whereIn('status', [
                BookingStatus::Pending->value,
                BookingStatus::Confirmed->value,
                BookingStatus::Ongoing->value,
            ]))
            ->selectRaw('driver_id, count(*) as total')
            ->groupBy('driver_id')
            ->pluck('total', 'driver_id');

        return $this->success('Drivers fetched successfully.', [
            'drivers' => $drivers->map(fn (User $driver) => [
                'id' => $driver->id,
                'name' => $driver->name,
                'phoneNumber' => $driver->phone_number,
                'activeAssignments' => (int) ($assignmentCounts[$driver->id] ?? 0),
                'hasOutstandingBalance' => $this->driverAssignmentService->hasOutstandingBalance($driver),
            ])->values(),
        ]);
    }

    public function assignDriver(AssignDriverRequest $request, Booking $booking): JsonResponse
    {
        $driver = User::query()->findOrFail($request->integer('driver_id'));

        $this->driverAssignmentService->assign($booking, $driver, $request->user());

        return $this->success(
            'Driver assigned successfully.',
            new BookingResource($booking->load([
                'vehicle.images',
                'vehicle.features',
                'payments',
                'user.documents',
                'user.customerProfile',
                'assignedDriver',
                'assignment',
                'terms',
                'confirmationEmail',
                'events',
            ]))
        );
    }

    public function confirm(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Confirmed, 'Booking confirmed successfully.');
    }

    public function reject(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Rejected, 'Booking rejected successfully.');
    }

    public function cancel(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Cancelled, 'Booking cancelled successfully.');
    }

    public function start(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Ongoing, 'Rental started successfully.');
    }

    public function startTelematicsHandover(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        $this->telematicsSetupService->startHandover($booking, $request->user());

        return $this->success(
            'Telematics handover started successfully.',
            new BookingResource($booking->fresh()->load($this->detailRelations()))
        );
    }

    public function complete(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Completed, 'Rental completed successfully.');
    }

    public function returned(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        return $this->statusAction($request, $booking, BookingStatus::Returned, 'Booking marked as returned successfully.');
    }

    public function outgoing(StoreBookingInspectionRequest $request, Booking $booking): JsonResponse
    {
        $inspection = $this->inspectionService->finalizeOutgoing(
            $booking, $request->validated('condition'), $request->validated('operator_signature_data'), $request->user()
        );

        return $this->created('Outgoing Inspection finalized successfully.', new VehicleInspectionResource($inspection));
    }

    public function incoming(StoreBookingInspectionRequest $request, Booking $booking): JsonResponse
    {
        $inspection = $this->inspectionService->finalizeIncoming(
            $booking, $request->validated('condition'), $request->validated('operator_signature_data'), $request->user()
        );

        return $this->created('Incoming Inspection finalized successfully.', new VehicleInspectionResource($inspection));
    }

    public function charges(StoreAdditionalChargesRequest $request, Booking $booking): JsonResponse
    {
        $charges = $this->additionalChargeService->create($booking, $request->validated('charges'), $request->user());

        return $this->created('Additional charges added successfully.', AdditionalChargeResource::collection(collect($charges)->map->load('responsibleUser')));
    }

    public function finalizeCharges(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        $booking = $this->additionalChargeService->finalizeReview($booking, $request->user());

        return $this->success('Return charges finalized successfully.', new BookingResource($booking->load($this->detailRelations())));
    }

    public function readiness(Booking $booking): JsonResponse
    {
        return $this->success('Rental readiness fetched successfully.', $this->readinessService->evaluate($booking));
    }

    public function resendConfirmationEmail(Booking $booking): JsonResponse
    {
        if ($booking->status->isTerminal()) {
            return $this->error('A finalized booking is view only.', [], 422);
        }

        if (! in_array($booking->payment_status, [PaymentStatus::Partial, PaymentStatus::Paid], true)) {
            return $this->error(
                'A booking confirmation email can only be sent after a successful payment.',
                [],
                422
            );
        }

        if (! $this->bookingEmailService->sendBookingConfirmation($booking, force: true)) {
            return $this->error(
                'The booking confirmation email could not be queued. Check the application logs.',
                [],
                500
            );
        }

        return $this->success('Booking confirmation email resent successfully.', [
            'bookingReference' => $booking->booking_code,
            'emailStatus' => BookingEmailService::STATUS_QUEUED,
        ]);
    }

    private function statusAction(BookingStatusRequest $request, Booking $booking, BookingStatus $status, string $message): JsonResponse
    {
        $booking = $this->bookingService->transition(
            $booking,
            $status,
            $request->user(),
            $request->validated('reason'),
            $request->validated()
        );

        return $this->success($message, new BookingResource($booking->load($this->detailRelations())));
    }

    private function detailRelations(): array
    {
        return [
            'vehicle.images', 'vehicle.features', 'payments', 'user.documents', 'user.customerProfile',
            'vehicle.currentCondition.items', 'vehicle.currentCondition.markers', 'vehicle.currentCondition.signatures.user:id,name',
            'vehicle.currentCondition.creator:id,name', 'vehicle.currentCondition.basedOnInspection',
            'assignedDriver', 'assignment', 'terms', 'confirmationEmail', 'events', 'additionalCharges.responsibleUser',
            'vehicleInspections.items', 'vehicleInspections.markers', 'vehicleInspections.signatures.user:id,name',
            'vehicleInspections.creator:id,name', 'vehicleInspections.basedOnInspection',
            'telematicsTrips', 'bookingGeofences', 'telematicsSetupSession.steps',
        ];
    }
}
