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

  const isCompleted = resolvedBookingStatus === 'completed';
  const isActiveBooking = resolvedBookingStatus === 'active' || resolvedBookingStatus === 'ongoing';
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

    if (!isActiveBooking) {
      return <LockedTelematicsState onViewBookings={handleViewBookings} />;
    }

    if (!calibrationCompleted) {
      return renderCalibration();
    }

    if (tripStatus === 'not_started') {
      return (
        <ReadyToStartCard
          booking={booking}
          vehicle={mockTelematicsVehicle}
          onStartTrip={() => setTripStatus('started')}
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
          {renderContent()}
        </View>
      </ScrollView>
    </View>
  );
}
