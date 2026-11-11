<?php

namespace App\Http\Controllers\Web\Admin;

use App\Enums\BookingStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Booking\AssignDriverRequest;
use App\Http\Requests\Admin\Booking\ListBookingsRequest;
use App\Http\Requests\Admin\Booking\ListDrivingAnalysisRequest;
use App\Http\Requests\Admin\Booking\ReceiveVehicleRequest;
use App\Http\Requests\Admin\Booking\RecordCancellationRefundRequest;
use App\Http\Requests\Admin\Booking\RecordNoShowRequest;
use App\Http\Requests\Admin\Booking\ReturnFollowUpRequest;
use App\Http\Requests\Admin\Booking\ReviewCancellationRefundRequest;
use App\Http\Requests\Admin\Booking\ReviewLateChargeRequest;
use App\Http\Requests\Admin\Booking\StoreAdditionalChargesRequest;
use App\Http\Requests\Admin\Booking\StoreBookingInspectionRequest;
use App\Http\Requests\Admin\Booking\UpdateAdditionalChargeRequest;
use App\Http\Requests\Admin\BookingStatusRequest;
use App\Http\Resources\AdditionalChargeResource;
use App\Http\Resources\BookingResource;
use App\Http\Resources\DrivingOperatorResource;
use App\Http\Resources\RentalDrivingAnalysisResource;
use App\Http\Resources\VehicleInspectionResource;
use App\Models\Booking;
use App\Models\BookingAssignment;
use App\Models\User;
use App\Services\AdditionalChargeService;
use App\Services\BookingAttentionService;
use App\Services\BookingCancellationService;
use App\Services\BookingEmailService;
use App\Services\BookingInspectionService;
use App\Services\BookingReturnService;
use App\Services\BookingService;
use App\Services\DriverAssignmentService;
use App\Services\OwnerVerificationService;
use App\Services\RentalDrivingAnalysisService;
use App\Services\RentalDrivingOverviewService;
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
            $request->safe()->only(['search', 'status', 'payment_status', 'group', 'attention']),
            $request->integer('per_page', 15)
        );

        return $this->paginated('Bookings fetched successfully.', $bookings, BookingResource::class, [
            'status_counts' => $this->bookingService->adminStatusCounts(),
            'attention_counts' => app(BookingAttentionService::class)->counts(),
        ]);
    }

    public function show(Booking $booking): JsonResponse
    {
        return $this->success(
            'Booking fetched successfully.',
            new BookingResource($booking->load($this->detailRelations()))
        );
    }

    public function drivingAnalysis(Booking $booking, RentalDrivingAnalysisService $analysis): JsonResponse
    {
        abort_unless($booking->status === BookingStatus::Completed, 404);

        return $this->success('Driving analysis fetched.', new RentalDrivingAnalysisResource($analysis->forBooking($booking)))
            ->header('Cache-Control', 'private, no-store');
    }

    public function drivingAnalysisIndex(ListDrivingAnalysisRequest $request, RentalDrivingAnalysisService $analysis, RentalDrivingOverviewService $overview): JsonResponse
    {
        $scope = $overview->rentals($request->validated());
        $bookings = $this->bookingService->paginateForAdmin([
            'booking_ids' => (clone $scope)->select('booking.id'),
        ], $request->integer('per_page', 10));

        return $this->paginated('Driving analysis fetched.', $bookings, BookingResource::class, [
            'driving_grades' => $analysis->gradesForBookings($bookings->getCollection()),
            'recorded_operators' => $overview->recordedOperators($bookings->getCollection()),
            'summary' => $overview->summary($scope),
            'vehicle_options' => $overview->vehicleOptions(),
            'operator_filter' => $request->filled('operator_id')
                ? $overview->operatorFilter($request->integer('operator_id')) : null,
        ])->header('Cache-Control', 'private, no-store');
    }

    public function drivingOperators(ListDrivingAnalysisRequest $request, RentalDrivingOverviewService $overview): JsonResponse
    {
        $scope = $overview->rentals($request->validated(), operatorSearch: true)->whereNotNull('trip.operator_user_id');

        return $this->paginated('Driving operators fetched.', $overview->operators($scope, $request->integer('per_page', 10)), DrivingOperatorResource::class, [
            'summary' => $overview->summary($scope),
            'vehicle_options' => $overview->vehicleOptions(),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function receiveVehicle(ReceiveVehicleRequest $request, Booking $booking, BookingReturnService $service): JsonResponse
    {
        $booking = $service->receive($booking, $request->user(), $request->validated('vehicle_received_at'));

        return $this->success('Physical receipt recorded.', new BookingResource($booking->load($this->detailRelations())));
    }

    public function returnFollowUp(ReturnFollowUpRequest $request, Booking $booking, BookingReturnService $service): JsonResponse
    {
        $booking = $service->followUp($booking, $request->user(), $request->validated());

        return $this->success('Return follow-up recorded.', new BookingResource($booking->load($this->detailRelations())));
    }

    public function reviewLateCharge(ReviewLateChargeRequest $request, Booking $booking, BookingReturnService $service): JsonResponse
    {
        $data = $request->validated();

        return app(OwnerVerificationService::class)->run($request, 'Review late return charge', $booking->booking_code, $data,
            fn () => Booking::query()->lockForUpdate()->findOrFail($booking->id),
            function ($locked) use ($service, $request, $data) {
                $updated = $service->review($locked, $request->user(), $data);

                return $this->success('Late return charge reviewed.', new BookingResource($updated->load($this->detailRelations())));
            },
            function ($locked) use ($service, $data) {
                $estimate = $service->estimate($locked)['estimatedAmount'];

                return $estimate === null || abs((float) $data['amount'] - $estimate) >= 0.005;
            });
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

    public function noShow(RecordNoShowRequest $request, Booking $booking, BookingCancellationService $service): JsonResponse
    {
        $booking = $service->noShow($booking, $request->user(), $request->validated('reason'));

        return $this->success('No-show recorded. Rental payments are retained.', new BookingResource($booking->load($this->detailRelations())));
    }

    public function reviewRefund(ReviewCancellationRefundRequest $request, Booking $booking, BookingCancellationService $service): JsonResponse
    {
        $data = $request->validated();

        return app(OwnerVerificationService::class)->run($request, 'Review refund', $booking->booking_code, $data,
            fn () => Booking::query()->lockForUpdate()->findOrFail($booking->id),
            function ($locked) use ($service, $request, $data) {
                $updated = $service->review($locked, $request->user(), $data);

                return $this->success('Refund decision saved.', new BookingResource($updated->load($this->detailRelations())));
            });
    }

    public function recordRefund(RecordCancellationRefundRequest $request, Booking $booking, BookingCancellationService $service): JsonResponse
    {
        return app(OwnerVerificationService::class)->run($request, 'Record refund', $booking->booking_code, $request->validated(),
            fn () => Booking::query()->lockForUpdate()->findOrFail($booking->id),
            function ($locked) use ($service, $request) {
                $updated = $service->recordRefund($locked, $request->user());

                return $this->success('External refund recorded.', new BookingResource($updated->load($this->detailRelations())));
            });
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

    public function outgoingAndHandover(StoreBookingInspectionRequest $request, Booking $booking): JsonResponse
    {
        $inspection = $this->inspectionService->finalizeOutgoingAndStartHandover(
            $booking, $request->validated('condition'), $request->validated('operator_signature_data'), $request->user()
        );

        return $this->created('Outgoing Inspection finalized and handover started.', new VehicleInspectionResource($inspection));
    }

    public function charges(StoreAdditionalChargesRequest $request, Booking $booking): JsonResponse
    {
        $charges = $this->additionalChargeService->create($booking, $request->validated('charges'), $request->user());

        return $this->created('Additional charges added successfully.', AdditionalChargeResource::collection(collect($charges)->map->load('responsibleUser')));
    }

    public function finalizeReturn(BookingStatusRequest $request, Booking $booking): JsonResponse
    {
        $booking = $this->bookingService->finalizeReturn(
            $booking, $request->user(), $request->validated('reason'), $request->validated()
        );

        return $this->success('Charges finalized and vehicle marked Returned.', new BookingResource($booking->load($this->detailRelations())));
    }

    public function updateCharge(UpdateAdditionalChargeRequest $request, Booking $booking, int $charge): JsonResponse
    {
        $data = $request->validated();

        return app(OwnerVerificationService::class)->run($request, 'Edit return charge', $booking->booking_code.' charge '.$charge, $data,
            fn () => Booking::query()->lockForUpdate()->findOrFail($booking->id),
            function ($locked) use ($charge, $data, $request) {
                $updated = $this->additionalChargeService->update($locked, $charge, $data['charges'][0], $request->user());

                return $this->success('Return charge updated.', new AdditionalChargeResource($updated));
            });
    }

    public function deleteCharge(BookingStatusRequest $request, Booking $booking, int $charge): JsonResponse
    {
        return app(OwnerVerificationService::class)->run($request, 'Delete return charge', $booking->booking_code.' charge '.$charge, [],
            fn () => Booking::query()->lockForUpdate()->findOrFail($booking->id),
            function ($locked) use ($charge, $request) {
                $this->additionalChargeService->delete($locked, $charge, $request->user());

                return $this->success('Return charge deleted.', ['id' => (string) $charge]);
            });
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

        if (! $booking->successfulCustomerPayments()->exists()) {
            return $this->error('A receipt requires a recorded completed customer payment.', [], 422);
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
