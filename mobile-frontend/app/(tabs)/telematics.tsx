import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Gauge } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import {
  BookingInfoCard,
  CalibrationActionButton,
  CalibrationChecklistItem,
  CalibrationInstructionCard,
  CalibrationResultCard,
  CalibrationStepsCard,
  CompletedTripSummaryCard,
  CountdownTimerCard,
  FlaggedEventsSection,
  GeofenceStatusCard,
  LockedTelematicsState,
  MapPreviewCard,
  PauseNoticeCard,
  PenaltyCard,
  ReadyToStartCard,
  StatusHeaderCard,
  TripControlPanel,
  VehicleInfoCard,
} from '@/components/telematics/TelematicsCards';
import { useCustomer } from '@/lib/customer/customer-store';
import {
  endTelematicsTrip,
  getBooking,
  recordBookingCalibration,
  startTelematicsTrip,
} from '@/services/api';
import type { Booking } from '@/types/booking';
import {
  calibrationTestSteps,
  createMockActiveBooking,
  initialCalibrationSteps,
  mockCompletedBooking,
  mockFlaggedEvents,
  mockGeofenceStatus,
  mockMapData,
  mockTelematicsVehicle,
} from '@/lib/telematics/mock-data';
import {
  calculatePenalty,
  formatDuration,
  getTimerState,
} from '@/lib/telematics/timer';
import type {
  CalibrationStep,
  TelematicsBookingStatus,
  TripStatus,
} from '@/types/telematics';

const hourlyPenaltyRate = 500;

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function getInitialTripStatus(value?: string | string[]) {
  const firstValue = Array.isArray(value) ? value[0] : value;

  if (firstValue === 'started' || firstValue === 'paused' || firstValue === 'not_started') {
    return firstValue;
  }

  return 'not_started';
}

function getForcedBookingStatus(value?: string | string[]) {
  const firstValue = Array.isArray(value) ? value[0] : value;

  if (
    firstValue === 'active' ||
    firstValue === 'ongoing' ||
    firstValue === 'returned' ||
    firstValue === 'completed' ||
    firstValue === 'pending'
  ) {
    return firstValue;
  }

  return null;
}

function getInitialCalibrationSteps(calibrationState?: string | string[]) {
  const firstValue = Array.isArray(calibrationState) ? calibrationState[0] : calibrationState;

  if (firstValue === 'failed') {
    return initialCalibrationSteps.map((step, index) => ({
      ...step,
      status: index === initialCalibrationSteps.length - 1 ? 'failed' : 'passed',
    })) satisfies CalibrationStep[];
  }

  if (firstValue === 'passed') {
    return initialCalibrationSteps.map((step) => ({ ...step, status: 'passed' })) satisfies CalibrationStep[];
  }

  return initialCalibrationSteps;
}

export default function TelematicsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mockStatus?: string;
    calibration?: string;
    trip?: string;
    bookingId?: string;
  }>();
  const customer = useCustomer();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const activeBookingMock = useMemo(() => createMockActiveBooking(), []);
  const forcedBookingStatus = getForcedBookingStatus(params.mockStatus);
  const resolvedBookingStatus = forcedBookingStatus ?? customer.bookingStatus;
  const initialTripStatus = getInitialTripStatus(params.trip);
  const [tripStatus, setTripStatus] = useState<TripStatus>(initialTripStatus);
  const [calibrationSteps, setCalibrationSteps] = useState<CalibrationStep[]>(() =>
    getInitialCalibrationSteps(params.calibration),
  );
  const [calibrationAttempts, setCalibrationAttempts] = useState(0);
  const [isCheckingCalibration, setIsCheckingCalibration] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [lifecycleBooking, setLifecycleBooking] = useState<Booking | null>(null);
  const [tripId, setTripId] = useState<number | null>(null);
  const [lifecycleMessage, setLifecycleMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!params.bookingId) {
      return;
    }

    void getBooking(params.bookingId).then((nextBooking) => {
      setLifecycleBooking(nextBooking);
      setTripId(nextBooking.rentalProgress.latestTripId ?? null);
      if (nextBooking.calibrationStatus === 'passed') {
        setCalibrationSteps(initialCalibrationSteps.map((step) => ({ ...step, status: 'passed' })));
      }
      if (nextBooking.rentalProgress.latestTripStatus === 'started') {
        setTripStatus('started');
      } else if (nextBooking.rentalProgress.latestTripStatus === 'paused') {
        setTripStatus('paused');
      } else if (nextBooking.rentalProgress.latestTripStatus === 'ended') {
        setTripStatus('ended');
      }
    }).catch(() => setLifecycleMessage('This booking could not be refreshed.'));
  }, [params.bookingId]);

  const actualStatus = lifecycleBooking?.status;
  const isCompleted = actualStatus
    ? actualStatus === 'Completed'
    : resolvedBookingStatus === 'completed';
  const isReturned = actualStatus ? actualStatus === 'Returned' : resolvedBookingStatus === 'returned';
  const isActiveBooking = actualStatus
    ? actualStatus === 'Confirmed' || actualStatus === 'Active' || actualStatus === 'Ongoing'
    : resolvedBookingStatus === 'active' || resolvedBookingStatus === 'ongoing';
  const calibrationCompleted = calibrationSteps.every((step) => step.status === 'passed');
  const hasFailedCalibration = calibrationSteps.some((step) => step.status === 'failed');
  const activeBooking = useMemo(
    () => ({
      ...activeBookingMock,
      status: (resolvedBookingStatus === 'ongoing' ? 'ongoing' : 'active') as TelematicsBookingStatus,
      tripStatus,
    }),
    [activeBookingMock, resolvedBookingStatus, tripStatus],
  );
  const booking = isCompleted ? mockCompletedBooking : activeBooking;
  const timerState = getTimerState(booking.returnDateTime, currentTime);
  const penalty = calculatePenalty({
    currentTime,
    hourlyPenaltyRate,
    returnDateTime: booking.returnDateTime,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  const runCalibration = async () => {
    setIsCheckingCalibration(true);
    setCalibrationSteps(initialCalibrationSteps.map((step) => ({ ...step, status: 'pending' })));

    for (let index = 0; index < initialCalibrationSteps.length; index += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 420);
      });

      setCalibrationSteps((currentSteps) =>
        currentSteps.map((step, stepIndex) => {
          if (stepIndex < index) {
            return { ...step, status: 'passed' };
          }

          if (stepIndex === index) {
            return { ...step, status: 'checking' };
          }

          return step;
        }),
      );
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 520);
    });

    const shouldFailThisRun = params.calibration === 'failed' && calibrationAttempts === 0;
    setCalibrationSteps(
      initialCalibrationSteps.map((step, index) => ({
        ...step,
        status: shouldFailThisRun && index === initialCalibrationSteps.length - 1 ? 'failed' : 'passed',
      })),
    );
    setCalibrationAttempts((currentAttempts) => currentAttempts + 1);
    setIsCheckingCalibration(false);

    if (!shouldFailThisRun && lifecycleBooking) {
      try {
        const updated = await recordBookingCalibration(lifecycleBooking.id);
        setLifecycleBooking(updated);
        setLifecycleMessage('Calibration complete. Waiting for Jamjade to start the rental.');
      } catch {
        setLifecycleMessage('Calibration passed locally but could not be recorded. Please try again.');
      }
    }
  };

  const startTrip = async () => {
    if (!lifecycleBooking) {
      setTripStatus('started');
      return;
    }

    try {
      const trip = await startTelematicsTrip(lifecycleBooking.backendId);
      setTripId(trip.id);
      setTripStatus('started');
      setLifecycleMessage(null);
    } catch {
      setLifecycleMessage('Jamjade has not enabled this trip yet. Confirm that the rental is active.');
    }
  };

  const endTrip = async () => {
    if (!tripId) {
      return;
    }

    try {
      await endTelematicsTrip(tripId);
      setTripStatus('ended');
      setLifecycleMessage('Trip ended. The booking remains ongoing until Jamjade completes the return inspection.');
    } catch {
      setLifecycleMessage('The trip could not be ended. Please try again.');
    }
  };

  const handleViewBookings = () => {
    router.push('/bookings' as Href);
  };

  const renderActiveTrip = () => (
    <View className="mt-7 gap-5">
      <StatusHeaderCard booking={booking} tripStatus={tripStatus} vehicle={mockTelematicsVehicle} />
      {tripStatus === 'paused' ? <PauseNoticeCard /> : null}
      <CountdownTimerCard
        isEndingSoon={timerState.isEndingSoon}
        isOverdue={timerState.isOverdue}
        remainingLabel={timerState.remainingLabel}
        returnDateTime={booking.returnDateTime}
      />
      <PenaltyCard
        hourlyPenaltyRate={hourlyPenaltyRate}
        isOverdue={timerState.isOverdue}
        overdueLabel={penalty.overdueLabel}
        penaltyCharge={penalty.penaltyCharge}
        penaltyLogs={penalty.penaltyLogs}
      />
      <MapPreviewCard geofenceStatus={mockGeofenceStatus.status} mapData={mockMapData} />
      <GeofenceStatusCard geofence={mockGeofenceStatus} />
      <FlaggedEventsSection events={mockFlaggedEvents} />
      <BookingInfoCard booking={booking} />
      <VehicleInfoCard vehicle={mockTelematicsVehicle} />
      <TripControlPanel
        tripStatus={tripStatus}
        onEnd={() => void endTrip()}
        onPause={() => setTripStatus('paused')}
        onResume={() => setTripStatus('started')}
      />
    </View>
  );

  const renderCalibration = () => (
    <View className="mt-7 gap-5">
      <CalibrationInstructionCard />
      <View className="rounded-[28px] border border-border bg-surface p-5 shadow-md shadow-foreground/5">
        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Gauge size={20} color="#346EF6" strokeWidth={2.45} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[18px] font-black text-foreground">Sensor checklist</Text>
            <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
              GPS, accelerometer, gyroscope, and device stability checks.
            </Text>
          </View>
        </View>
        <View className="gap-3">
          {calibrationSteps.map((step) => (
            <CalibrationChecklistItem key={step.id} item={step} />
          ))}
        </View>

        {hasFailedCalibration ? (
          <View className="mt-4">
            <CalibrationResultCard status="failed" />
          </View>
        ) : null}
        {calibrationCompleted ? (
          <View className="mt-4">
            <CalibrationResultCard status="success" />
          </View>
        ) : null}

        <CalibrationActionButton
          calibrationCompleted={calibrationCompleted}
          hasFailed={hasFailedCalibration}
          isChecking={isCheckingCalibration}
          onContinue={() => setTripStatus('not_started')}
          onStart={runCalibration}
        />
      </View>
      <CalibrationStepsCard steps={calibrationTestSteps} />
    </View>
  );

  const renderContent = () => {
    if (isCompleted) {
      const pickupTime = new Date(mockCompletedBooking.pickupDateTime).getTime();
      const returnTime = new Date(mockCompletedBooking.returnDateTime).getTime();

      return (
        <CompletedTripSummaryCard
          flaggedEventsCount={mockFlaggedEvents.length}
          geofenceSummary="Inside geofence for final return"
          onViewBookings={handleViewBookings}
          overdueLabel="00h 00m"
          penaltyCharge={0}
          rentalDuration={formatDuration(returnTime - pickupTime, false)}
        />
      );
    }

    if (isReturned) {
      return (
        <View className="mt-7 rounded-[28px] border border-warning-border bg-warning-surface p-5">
          <Text className="text-[18px] font-black text-warning">Vehicle returned</Text>
          <Text className="mt-2 text-[13px] font-bold leading-5 text-warning">
            Driving has ended. Review your booking or Notifications for any outstanding return charges while Jamjade completes settlement.
          </Text>
        </View>
      );
    }

    if (!isActiveBooking) {
      return <LockedTelematicsState onViewBookings={handleViewBookings} />;
    }

    if (lifecycleBooking?.calibrationStatus === 'locked') {
      return (
        <View className="mt-7 rounded-[28px] border border-border bg-surface p-5">
          <Text className="text-[18px] font-black text-foreground">Calibration locked</Text>
          <Text className="mt-2 text-[13px] font-bold leading-5 text-muted-foreground">
            Jamjade must finalize the Outgoing Inspection and required signatures before calibration becomes available.
          </Text>
        </View>
      );
    }

    if (tripStatus === 'ended') {
      return (
        <View className="mt-7 rounded-[28px] border border-warning-border bg-warning-surface p-5">
          <Text className="text-[18px] font-black text-warning">Trip ended</Text>
          <Text className="mt-2 text-[13px] font-bold leading-5 text-warning">
            The booking and vehicle remain active until Jamjade performs the Incoming Inspection and return processing.
          </Text>
        </View>
      );
    }

    if (!calibrationCompleted) {
      return renderCalibration();
    }

    if (lifecycleBooking?.status === 'Confirmed') {
      return (
        <View className="mt-7 rounded-[28px] border border-success-border bg-success-surface p-5">
          <Text className="text-[18px] font-black text-success">Calibration complete</Text>
          <Text className="mt-2 text-[13px] font-bold leading-5 text-success">
            Your device is ready. Waiting for Jamjade to start the rental.
          </Text>
        </View>
      );
    }

    if (tripStatus === 'not_started') {
      return (
        <ReadyToStartCard
          booking={booking}
          vehicle={mockTelematicsVehicle}
          onStartTrip={() => void startTrip()}
        />
      );
    }

    return renderActiveTrip();
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        onScroll={handleTabScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View
          className={cx('w-full max-w-[460px] self-center px-5')}
          style={{ paddingBottom: 112 + insets.bottom, paddingTop: insets.top + 10 }}>
          <CustomerTabHeader description="Monitor your active rental, GPS status, geofence, and trip events." />
          {lifecycleMessage ? (
            <Text className="mt-4 rounded-[18px] border border-border bg-surface p-3 text-[12px] font-bold leading-5 text-foreground">
              {lifecycleMessage}
            </Text>
          ) : null}
          {renderContent()}
        </View>
      </ScrollView>
    </View>
  );
}
