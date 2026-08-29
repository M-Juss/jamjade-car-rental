import {
  AlertTriangle,
  Car,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  Gauge,
  LockKeyhole,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  Satellite,
  ShieldAlert,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import type {
  CalibrationStep,
  CalibrationStatus,
  FlaggedEvent,
  GeofenceStatus,
  PenaltyLog,
  TelematicsBooking,
  TelematicsGeofence,
  TelematicsMapData,
  TelematicsVehicle,
  TripStatus,
} from '@/types/telematics';
import { formatDateTime, formatPeso } from '@/lib/telematics/timer';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cx('rounded-[28px] border border-border bg-surface p-5 shadow-md shadow-foreground/5', className)}>
      {children}
    </View>
  );
}

function IconBubble({
  bgClassName = 'bg-muted',
  color = '#346EF6',
  icon: Icon,
}: {
  icon: LucideIcon;
  color?: string;
  bgClassName?: string;
}) {
  return (
    <View className={cx('h-11 w-11 items-center justify-center rounded-full', bgClassName)}>
      <Icon size={20} color={color} strokeWidth={2.45} />
    </View>
  );
}

function Pill({
  label,
  tone = 'blue',
}: {
  label: string;
  tone?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}) {
  const style = {
    blue: { container: 'border-[#BFD1FF] bg-muted', text: 'text-primary' },
    gray: { container: 'border-border bg-[#F1F5F9]', text: 'text-[#475569]' },
    green: { container: 'border-success-border bg-success-surface', text: 'text-success' },
    red: { container: 'border-destructive-border bg-destructive-surface', text: 'text-destructive' },
    yellow: { container: 'border-warning-border bg-warning-surface', text: 'text-warning' },
  }[tone];

  return (
    <View className={cx('self-start rounded-full border px-3 py-1.5', style.container)}>
      <Text className={cx('text-[10px] font-black uppercase', style.text)}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-[48px] flex-row items-center justify-between gap-3 border-b border-[#EEF2FF] py-2.5">
      <Text className="min-w-0 flex-1 text-[12px] font-bold leading-4 text-muted-foreground">{label}</Text>
      <Text className="max-w-[58%] text-right text-[13px] font-black leading-5 text-foreground">{value}</Text>
    </View>
  );
}

export function SectionHeader({
  action,
  icon: Icon,
  title,
}: {
  title: string;
  icon?: LucideIcon;
  action?: string;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-2.5">
      {Icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Icon size={17} color="#346EF6" strokeWidth={2.45} />
        </View>
      ) : null}
      <Text className="min-w-0 flex-1 text-[18px] font-black text-foreground">{title}</Text>
      {action ? <Text className="text-[12px] font-black text-primary">{action}</Text> : null}
    </View>
  );
}

export function LockedTelematicsState({ onViewBookings }: { onViewBookings: () => void }) {
  return (
    <View className="mt-7">
      <Card className="items-center">
        <View className="h-[92px] w-[92px] items-center justify-center rounded-full bg-[#F1F5F9]">
          <LockKeyhole size={42} color="#64748B" strokeWidth={2.35} />
        </View>
        <Text className="mt-6 text-center text-[26px] font-black leading-[31px] text-foreground">Telematics Locked</Text>
        <Text className="mt-2 text-center text-[14px] font-semibold leading-6 text-muted-foreground">
          Telematics will be available once your booking becomes active.
        </Text>
        <Text className="mt-2 text-center text-[12px] font-bold leading-5 text-subtle-foreground">
          Please wait for Jamjade admin to start your rental.
        </Text>

        <View className="mt-6 w-full rounded-[24px] border border-dashed border-border bg-background p-5">
          <View className="flex-row items-center gap-3">
            <IconBubble icon={Satellite} color="#64748B" bgClassName="bg-surface" />
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-black text-foreground">Waiting for active rental</Text>
              <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
                Map, calibration, sensor checks, and trip controls stay hidden until an active booking is available.
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onViewBookings}
          className="mt-6 min-h-[54px] w-full items-center justify-center rounded-full bg-primary px-5 shadow-lg shadow-primary/20">
          <Text className="text-[14px] font-black text-surface">View My Bookings</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function getCalibrationTone(status: CalibrationStatus) {
  if (status === 'passed') {
    return { bg: 'bg-success-surface', color: '#047857', icon: CheckCircle2, label: 'Passed' };
  }

  if (status === 'failed') {
    return { bg: 'bg-destructive-surface', color: '#DC2626', icon: AlertTriangle, label: 'Failed' };
  }

  if (status === 'checking') {
    return { bg: 'bg-muted', color: '#346EF6', icon: Gauge, label: 'Checking' };
  }

  return { bg: 'bg-[#F1F5F9]', color: '#64748B', icon: CircleDashed, label: 'Pending' };
}

export function CalibrationChecklistItem({ item }: { item: CalibrationStep }) {
  const tone = getCalibrationTone(item.status);
  const StatusIcon = tone.icon;

  return (
    <View className="flex-row items-center gap-3 rounded-[20px] border border-[#EDF2FF] bg-[#FBFCFF] p-3.5">
      <View className={cx('h-10 w-10 items-center justify-center rounded-full', tone.bg)}>
        <StatusIcon size={18} color={tone.color} strokeWidth={2.45} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-black text-foreground">{item.label}</Text>
        <Text className="mt-0.5 text-[11px] font-semibold leading-4 text-muted-foreground">{item.description}</Text>
      </View>
      <Text className="text-[11px] font-black uppercase" style={{ color: tone.color }}>
        {tone.label}
      </Text>
    </View>
  );
}

export function CalibrationInstructionCard() {
  const instructions = [
    'Place your phone on a stable flat surface inside the vehicle.',
    'Keep the phone still for a few seconds.',
    'Slowly tilt or rotate the phone when asked.',
  ];

  return (
    <Card>
      <SectionHeader icon={ShieldCheck} title="Safe calibration guide" />
      <View className="gap-3">
        {instructions.map((instruction, index) => (
          <View key={instruction} className="flex-row gap-3">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
              <Text className="text-[12px] font-black text-primary">{index + 1}</Text>
            </View>
            <Text className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-foreground">{instruction}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function CalibrationStepsCard({ steps }: { steps: string[] }) {
  return (
    <Card>
      <SectionHeader icon={RotateCcw} title="Calibration test steps" />
      <View className="gap-2.5">
        {steps.map((step, index) => (
          <View key={step} className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Text className="text-[11px] font-black text-primary">{index + 1}</Text>
            </View>
            <Text className="min-w-0 flex-1 text-[13px] font-bold text-foreground">{step}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function CalibrationResultCard({ status }: { status: 'success' | 'failed' }) {
  const isSuccess = status === 'success';

  return (
    <View
      className={cx(
        'rounded-[24px] border p-4',
        isSuccess ? 'border-success-border bg-success-surface' : 'border-destructive-border bg-destructive-surface',
      )}>
      <View className="flex-row gap-3">
        {isSuccess ? (
          <CheckCircle2 size={22} color="#047857" strokeWidth={2.45} />
        ) : (
          <AlertTriangle size={22} color="#DC2626" strokeWidth={2.45} />
        )}
        <View className="min-w-0 flex-1">
          <Text className={cx('text-[15px] font-black', isSuccess ? 'text-success' : 'text-destructive')}>
            {isSuccess ? 'Calibration completed.' : 'Calibration failed.'}
          </Text>
          <Text className={cx('mt-1 text-[12px] font-semibold leading-5', isSuccess ? 'text-success' : 'text-destructive')}>
            {isSuccess
              ? 'Your device sensors are working properly.'
              : 'Please place your phone on a stable surface and try again.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function CalibrationActionButton({
  calibrationCompleted,
  hasFailed,
  isChecking,
  onContinue,
  onStart,
}: {
  isChecking: boolean;
  hasFailed: boolean;
  calibrationCompleted: boolean;
  onStart: () => void;
  onContinue: () => void;
}) {
  const label = calibrationCompleted ? 'Continue' : hasFailed ? 'Retry Calibration' : isChecking ? 'Checking Sensors...' : 'Start Calibration';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isChecking}
      onPress={calibrationCompleted ? onContinue : onStart}
      className={cx(
        'mt-5 min-h-[56px] items-center justify-center rounded-full px-5 shadow-lg shadow-primary/20',
        isChecking ? 'bg-[#AFC5FF] shadow-none' : 'bg-primary',
      )}>
      <Text className="text-[15px] font-black text-surface">{label}</Text>
    </Pressable>
  );
}

export function ReadyToStartCard({
  booking,
  onStartTrip,
  vehicle,
}: {
  booking: TelematicsBooking;
  vehicle: TelematicsVehicle;
  onStartTrip: () => void;
}) {
  return (
    <Card className="mt-7">
      <View className="items-center">
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-success-surface">
          <CheckCircle2 size={44} color="#047857" strokeWidth={2.4} />
        </View>
        <Text className="mt-5 text-center text-[25px] font-black leading-[30px] text-foreground">Ready to Start Trip</Text>
        <Text className="mt-2 text-center text-[13px] font-semibold leading-5 text-muted-foreground">
          Your sensors are calibrated. You can now start trip monitoring.
        </Text>
      </View>

      <View className="mt-6 rounded-[24px] bg-background p-4">
        <InfoRow label="Booking ID" value={booking.id} />
        <InfoRow label="Vehicle" value={vehicle.name} />
        <InfoRow label="Rental Type" value={booking.rentalType} />
        <View className="min-h-[48px] flex-row items-center justify-between gap-3 py-2.5">
          <Text className="min-w-0 flex-1 text-[12px] font-bold leading-4 text-muted-foreground">Return Date/Time</Text>
          <Text className="max-w-[58%] text-right text-[13px] font-black leading-5 text-foreground">
            {formatDateTime(booking.returnDateTime)}
          </Text>
        </View>
      </View>

      <TripControlButton label="Start Trip" icon={Play} onPress={onStartTrip} />
    </Card>
  );
}

export function StatusHeaderCard({
  booking,
  tripStatus,
  vehicle,
}: {
  booking: TelematicsBooking;
  tripStatus: TripStatus;
  vehicle: TelematicsVehicle;
}) {
  const tripLabel = tripStatus === 'paused' ? 'Paused' : 'Monitoring Active';

  return (
    <Card>
      <View className="flex-row items-start gap-3">
        <IconBubble icon={Car} />
        <View className="min-w-0 flex-1">
          <Text className="text-[22px] font-black leading-[26px] text-foreground">Active Rental</Text>
          <Text className="mt-1 text-[12px] font-bold text-muted-foreground">Booking ID: {booking.id}</Text>
        </View>
      </View>
      <Text className="mt-4 text-[19px] font-black leading-6 text-foreground">{vehicle.name}</Text>
      <View className="mt-4 flex-row flex-wrap gap-2">
        <Pill label={booking.status === 'ongoing' ? 'Ongoing' : 'Active'} tone="green" />
        <Pill label={tripLabel} tone={tripStatus === 'paused' ? 'gray' : 'blue'} />
        <Pill label={booking.rentalType} tone="gray" />
      </View>
    </Card>
  );
}

export function CountdownTimerCard({
  isEndingSoon,
  isOverdue,
  remainingLabel,
  returnDateTime,
}: {
  remainingLabel: string;
  returnDateTime: string;
  isEndingSoon: boolean;
  isOverdue: boolean;
}) {
  const toneClass = isOverdue
    ? 'border-destructive-border bg-destructive-surface'
    : isEndingSoon
      ? 'border-warning-border bg-warning-surface'
      : 'border-border bg-surface';
  const helper = isOverdue
    ? 'Rental is overdue.'
    : isEndingSoon
      ? 'Rental ending soon.'
      : 'Please return the vehicle on or before the scheduled time.';

  return (
    <View className={cx('rounded-[28px] border p-5 shadow-md shadow-foreground/5', toneClass)}>
      <SectionHeader icon={Timer} title="Rental Ends In" />
      <Text className={cx('text-[34px] font-black leading-[40px]', isOverdue ? 'text-destructive' : 'text-foreground')}>
        {remainingLabel}
      </Text>
      <Text className="mt-2 text-[12px] font-bold text-muted-foreground">Return: {formatDateTime(returnDateTime)}</Text>
      <Text className={cx('mt-3 text-[13px] font-bold leading-5', isOverdue ? 'text-destructive' : isEndingSoon ? 'text-warning' : 'text-muted-foreground')}>
        {helper}
      </Text>
    </View>
  );
}

export function PenaltyCard({
  hourlyPenaltyRate,
  isOverdue,
  overdueLabel,
  penaltyCharge,
  penaltyLogs,
}: {
  isOverdue: boolean;
  overdueLabel: string;
  hourlyPenaltyRate: number;
  penaltyCharge: number;
  penaltyLogs: PenaltyLog[];
}) {
  if (!isOverdue) {
    return (
      <Card>
        <View className="flex-row gap-3">
          <IconBubble icon={ShieldCheck} bgClassName="bg-success-surface" color="#047857" />
          <View className="min-w-0 flex-1">
            <Text className="text-[16px] font-black text-foreground">No penalty charges</Text>
            <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
              Penalty will only apply if the rental exceeds the return time.
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card className="border-destructive-border bg-destructive-surface">
      <SectionHeader icon={AlertTriangle} title="Penalty / Overdue" />
      <View className="rounded-[22px] bg-surface/80 p-4">
        <InfoRow label="Overdue Time" value={overdueLabel} />
        <InfoRow label="Penalty Rate" value={`${formatPeso(hourlyPenaltyRate)}/hour`} />
        <View className="min-h-[48px] flex-row items-center justify-between gap-3 py-2.5">
          <Text className="min-w-0 flex-1 text-[12px] font-bold leading-4 text-muted-foreground">Estimated Penalty</Text>
          <Text className="max-w-[58%] text-right text-[16px] font-black leading-5 text-destructive">
            {formatPeso(penaltyCharge)}
          </Text>
        </View>
      </View>
      <Text className="mt-4 text-[14px] font-black text-foreground">Penalty logs</Text>
      <View className="mt-2 gap-2">
        {penaltyLogs.map((log) => (
          <View key={log.id} className="flex-row items-center gap-3 rounded-[18px] bg-surface/80 px-3 py-3">
            <Clock3 size={17} color="#DC2626" strokeWidth={2.45} />
            <Text className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-foreground">{log.description}</Text>
            <Text className="text-[12px] font-black text-destructive">{formatPeso(log.charge)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function MapPreviewCard({
  geofenceStatus,
  mapData,
}: {
  mapData: TelematicsMapData;
  geofenceStatus: GeofenceStatus;
}) {
  const statusLabel = {
    gps_unavailable: 'GPS Weak',
    inside: 'Inside Geofence',
    near_boundary: 'Near Boundary',
    outside: 'Outside Geofence',
  }[geofenceStatus];
  const statusTone = geofenceStatus === 'inside' ? 'green' : geofenceStatus === 'near_boundary' ? 'yellow' : geofenceStatus === 'outside' ? 'red' : 'gray';

  return (
    <Card className="overflow-hidden p-0">
      <View className="p-5 pb-3">
        <SectionHeader icon={MapPin} title="Live Map" action="Mock GPS" />
      </View>
      <View className="mx-5 mb-5 h-[260px] overflow-hidden rounded-[26px] border border-[#D6E5FF] bg-[#EAF1FF]">
        <View className="absolute inset-0">
          {Array.from({ length: 8 }).map((_, index) => (
            <View
              key={`horizontal-${index}`}
              className="absolute left-0 right-0 h-px bg-surface/80"
              style={{ top: `${(index + 1) * 12}%` }}
            />
          ))}
          {Array.from({ length: 6 }).map((_, index) => (
            <View
              key={`vertical-${index}`}
              className="absolute bottom-0 top-0 w-px bg-surface/80"
              style={{ left: `${(index + 1) * 15}%` }}
            />
          ))}
          <View className="absolute left-[-24px] top-[98px] h-9 w-[360px] rotate-[-16deg] rounded-full bg-surface/80" />
          <View className="absolute left-[84px] top-[-18px] h-[320px] w-9 rotate-[22deg] rounded-full bg-surface/70" />
        </View>

        <View className="absolute left-[14%] top-[48%] h-[132px] w-[132px] rounded-full border-2 border-primary/35 bg-primary/10" />
        <View className="absolute left-[50%] top-[33%] h-[94px] w-[94px] rounded-full border border-primary/25 bg-surface/20" />

        <View className="absolute left-[20%] top-[66%] items-center">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-success">
            <MapPin size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.45} />
          </View>
          <Text className="mt-1 rounded-full bg-surface px-2 py-1 text-[9px] font-black text-success">Pickup</Text>
        </View>

        <View className="absolute left-[62%] top-[18%] items-center">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
            <Car size={20} color="#FFFFFF" strokeWidth={2.55} />
          </View>
          <Text className="mt-1 rounded-full bg-surface px-2 py-1 text-[9px] font-black text-primary">Vehicle</Text>
        </View>

        <View className="absolute bottom-3 left-3 right-3 flex-row flex-wrap gap-2">
          <Pill label="Live GPS" tone="blue" />
          <Pill label={statusLabel} tone={statusTone} />
          <Pill label={`${mapData.geofenceRadiusKm} km area`} tone="gray" />
        </View>
      </View>
      <View className="border-t border-[#EEF2FF] px-5 py-4">
        <View className="flex-row items-center gap-3">
          <Route size={18} color="#346EF6" strokeWidth={2.45} />
          <Text className="min-w-0 flex-1 text-[12px] font-bold leading-5 text-muted-foreground">
            {mapData.pickupLocation.area} to {mapData.vehicleLocation.area}; return at {mapData.returnLocation.area}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export function GeofenceStatusCard({ geofence }: { geofence: TelematicsGeofence }) {
  const statusMeta = {
    gps_unavailable: {
      color: '#64748B',
      icon: Satellite,
      label: 'GPS Unavailable',
      text: 'GPS signal is unavailable. Monitoring will continue when signal returns.',
      tone: 'gray' as const,
    },
    inside: {
      color: '#047857',
      icon: ShieldCheck,
      label: 'Inside Geofence',
      text: 'Vehicle is inside the allowed area.',
      tone: 'green' as const,
    },
    near_boundary: {
      color: '#806128',
      icon: ShieldAlert,
      label: 'Near Boundary',
      text: 'Vehicle is near the allowed boundary.',
      tone: 'yellow' as const,
    },
    outside: {
      color: '#DC2626',
      icon: AlertTriangle,
      label: 'Outside Geofence',
      text: 'Vehicle is outside the allowed area. This event has been logged.',
      tone: 'red' as const,
    },
  }[geofence.status];

  return (
    <Card>
      <View className="flex-row gap-3">
        <IconBubble icon={statusMeta.icon} color={statusMeta.color} bgClassName={statusMeta.tone === 'green' ? 'bg-success-surface' : statusMeta.tone === 'yellow' ? 'bg-warning-surface' : statusMeta.tone === 'red' ? 'bg-destructive-surface' : 'bg-[#F1F5F9]'} />
        <View className="min-w-0 flex-1">
          <Pill label={statusMeta.label} tone={statusMeta.tone} />
          <Text className="mt-3 text-[14px] font-bold leading-5 text-foreground">{statusMeta.text}</Text>
        </View>
      </View>
      <View className="mt-4 rounded-[22px] bg-background p-4">
        <InfoRow label="Last checked" value={geofence.lastCheckedTime} />
        <InfoRow label="Current area" value={geofence.currentArea} />
        <View className="min-h-[48px] flex-row items-center justify-between gap-3 py-2.5">
          <Text className="min-w-0 flex-1 text-[12px] font-bold leading-4 text-muted-foreground">Distance from boundary</Text>
          <Text className="max-w-[58%] text-right text-[13px] font-black leading-5 text-foreground">
            {geofence.distanceFromBoundary}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function getSeverityTone(severity: FlaggedEvent['severity']) {
  if (severity === 'High') {
    return 'red';
  }

  if (severity === 'Medium') {
    return 'yellow';
  }

  return 'blue';
}

export function FlaggedEventCard({ event }: { event: FlaggedEvent }) {
  return (
    <View className="rounded-[22px] border border-border bg-surface p-4 shadow-md shadow-foreground/5">
      <View className="flex-row items-start gap-3">
        <IconBubble
          icon={event.severity === 'High' ? AlertTriangle : Gauge}
          color={event.severity === 'High' ? '#DC2626' : '#346EF6'}
          bgClassName={event.severity === 'High' ? 'bg-destructive-surface' : 'bg-muted'}
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="min-w-0 flex-1 text-[15px] font-black text-foreground">{event.type}</Text>
            <Pill label={event.severity} tone={getSeverityTone(event.severity)} />
          </View>
          <Text className="mt-1 text-[12px] font-bold text-muted-foreground">{event.time} | {event.location}</Text>
          <Text className="mt-2 text-[12px] font-semibold leading-5 text-foreground">{event.description}</Text>
        </View>
      </View>
    </View>
  );
}

export function FlaggedEventsSection({ events }: { events: FlaggedEvent[] }) {
  return (
    <View>
      <SectionHeader icon={AlertTriangle} title="Flagged Events" />
      {events.length === 0 ? (
        <Card className="items-center">
          <IconBubble icon={CheckCircle2} bgClassName="bg-success-surface" color="#047857" />
          <Text className="mt-3 text-center text-[16px] font-black text-foreground">No flagged events recorded.</Text>
          <Text className="mt-1 text-center text-[12px] font-semibold leading-5 text-muted-foreground">
            Safe driving and geofence events will appear here during active monitoring.
          </Text>
        </Card>
      ) : (
        <View className="gap-3">
          {events.map((event) => (
            <FlaggedEventCard key={event.id} event={event} />
          ))}
        </View>
      )}
    </View>
  );
}

export function BookingInfoCard({ booking }: { booking: TelematicsBooking }) {
  return (
    <Card>
      <SectionHeader icon={FileText} title="Booking Information" />
      <InfoRow label="Booking ID" value={booking.id} />
      <InfoRow label="Customer" value={booking.customerName} />
      <InfoRow label="Rental Type" value={booking.rentalType} />
      <InfoRow label="Pickup" value={formatDateTime(booking.pickupDateTime)} />
      <InfoRow label="Return" value={formatDateTime(booking.returnDateTime)} />
      <InfoRow label="Pickup Location" value={booking.pickupLocation} />
      <InfoRow label="Return Location" value={booking.returnLocation} />
      <InfoRow label="Payment Status" value={booking.paymentStatus} />
      <View className="min-h-[48px] flex-row items-center justify-between gap-3 py-2.5">
        <Text className="min-w-0 flex-1 text-[12px] font-bold leading-4 text-muted-foreground">Booking Status</Text>
        <Text className="max-w-[58%] text-right text-[13px] font-black leading-5 text-foreground">
          {booking.status[0].toUpperCase() + booking.status.slice(1)}
        </Text>
      </View>
    </Card>
  );
}

export function VehicleInfoCard({ vehicle }: { vehicle: TelematicsVehicle }) {
  return (
    <Card>
      <SectionHeader icon={Car} title="Car Information" />
      <View className="mb-4 overflow-hidden rounded-[22px] border border-[#DCE8FF] bg-muted">
        <Image source={{ uri: vehicle.image }} resizeMode="cover" className="h-[168px] w-full" />
      </View>
      <Text className="text-[20px] font-black leading-6 text-foreground">{vehicle.name}</Text>
      <View className="mt-4">
        <InfoRow label="Brand" value={vehicle.brand} />
        <InfoRow label="Model Year" value={vehicle.modelYear} />
        <InfoRow label="Transmission" value={vehicle.transmission} />
        <InfoRow label="Fuel Type" value={vehicle.fuelType} />
        <InfoRow label="Seats" value={`${vehicle.seats} Seats`} />
        <InfoRow label="Color" value={vehicle.color} />
        <InfoRow label="Starting Odometer" value={vehicle.startingOdometer} />
        <InfoRow label="Fuel Level Before Release" value={vehicle.fuelLevel} />
        <View className="min-h-[48px] flex-row items-center justify-between gap-3 py-2.5">
          <Text className="min-w-0 flex-1 text-[12px] font-bold leading-4 text-muted-foreground">Condition Before Release</Text>
          <Text className="max-w-[58%] text-right text-[13px] font-black leading-5 text-foreground">{vehicle.condition}</Text>
        </View>
      </View>
    </Card>
  );
}

export function PauseNoticeCard() {
  return (
    <View className="rounded-[24px] border border-border bg-[#F1F5F9] p-4">
      <View className="flex-row gap-3">
        <Pause size={20} color="#475569" strokeWidth={2.45} />
        <Text className="min-w-0 flex-1 text-[13px] font-bold leading-5 text-[#475569]">
          Trip monitoring is paused. Rental timer and penalty monitoring are still running.
        </Text>
      </View>
    </View>
  );
}

export function TripControlButton({
  icon: Icon,
  label,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mt-5 min-h-[58px] flex-row items-center justify-center gap-2 rounded-full bg-primary px-5 shadow-lg shadow-primary/25">
      <Icon size={18} color="#FFFFFF" strokeWidth={2.6} />
      <Text className="text-[15px] font-black text-surface">{label}</Text>
    </Pressable>
  );
}

export function TripControlPanel({
  onEnd,
  onPause,
  onResume,
  tripStatus,
}: {
  tripStatus: TripStatus;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  const isPaused = tripStatus === 'paused';

  return (
    <Card>
      <TripControlButton
        icon={isPaused ? Play : Pause}
        label={isPaused ? 'Resume Trip' : 'Pause Trip'}
        onPress={isPaused ? onResume : onPause}
      />
      <View className="mt-3">
        <TripControlButton icon={CheckCircle2} label="End Trip" onPress={onEnd} />
      </View>
      <Text className="mt-3 text-center text-[11px] font-bold leading-4 text-subtle-foreground">
        End Trip stops this driving session only. Jamjade must still receive and inspect the vehicle.
      </Text>
    </Card>
  );
}

export function CompletedTripSummaryCard({
  flaggedEventsCount,
  geofenceSummary,
  onViewBookings,
  overdueLabel,
  penaltyCharge,
  rentalDuration,
}: {
  rentalDuration: string;
  overdueLabel: string;
  penaltyCharge: number;
  flaggedEventsCount: number;
  geofenceSummary: string;
  onViewBookings: () => void;
}) {
  const summary = [
    { label: 'Total rental duration', value: rentalDuration },
    { label: 'Total overdue time', value: overdueLabel },
    { label: 'Total penalty charge', value: formatPeso(penaltyCharge) },
    { label: 'Total flagged events', value: flaggedEventsCount.toString() },
    { label: 'Geofence status summary', value: geofenceSummary },
    { label: 'Final booking status', value: 'Completed' },
  ];

  return (
    <Card className="mt-7">
      <View className="items-center">
        <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-success-surface">
          <CheckCircle2 size={44} color="#047857" strokeWidth={2.4} />
        </View>
        <Text className="mt-5 text-center text-[26px] font-black leading-[31px] text-foreground">Trip Completed</Text>
        <Text className="mt-2 text-center text-[13px] font-semibold leading-5 text-muted-foreground">
          This rental has been completed by Jamjade admin.
        </Text>
        <View className="mt-4">
          <Pill label="Monitoring Stopped" tone="gray" />
        </View>
      </View>

      <View className="mt-6 rounded-[24px] bg-background p-4">
        {summary.map((item, index) => {
          const isLast = index === summary.length - 1;

          return (
            <View
              key={item.label}
              className={cx('min-h-[48px] flex-row items-center justify-between gap-3 py-2.5', !isLast && 'border-b border-[#EEF2FF]')}>
              <Text className="min-w-0 flex-1 text-[12px] font-bold leading-4 text-muted-foreground">{item.label}</Text>
              <Text className="max-w-[58%] text-right text-[13px] font-black leading-5 text-foreground">{item.value}</Text>
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onViewBookings}
        className="mt-5 min-h-[56px] items-center justify-center rounded-full bg-primary px-5 shadow-lg shadow-primary/20">
        <Text className="text-[14px] font-black text-surface">Back to Bookings</Text>
      </Pressable>
    </Card>
  );
}
