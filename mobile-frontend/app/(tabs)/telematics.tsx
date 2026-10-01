import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { CheckCircle2, CircleAlert, Clock3, MapPin, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerTabHeader } from '@/components/customer/CustomerTabHeader';
import { useAutoHideCustomerTabBar } from '@/components/navigation/CustomerTabBarVisibilityContext';
import { getBookingTelematicsSetup, getCurrentTelematicsSetup, submitTelematicsSetupAttempt, type MobileTelematicsHandover } from '@/services/api';
import { checkDeviceCapabilities, getFreshLocationFix, getNetworkReadiness, requestBackgroundLocationAccess, requestForegroundLocation, requestMotionAccess } from '@/services/telematics';

const IMPLEMENTED_STEPS = new Set(['device_check', 'motion_permission', 'location_permission', 'background_location', 'gps_check', 'geofence_check', 'phone_mount']);

function labelForStep(step: string) {
  return {
    device_check: 'Check device readiness',
    motion_permission: 'Allow motion access',
    location_permission: 'Allow location access',
    background_location: 'Allow background location',
    gps_check: 'Get fresh GPS fix',
    geofence_check: 'Verify rental area',
    phone_mount: 'Phone is securely mounted',
  }[step] ?? 'Next phase';
}

function guidanceForStep(step: string) {
  return {
    motion_permission: 'No motion data is collected now. This only verifies access needed for a future supervised calibration.',
    location_permission: 'JamJade needs location to verify setup and support an authorized active self-drive rental after you consent.',
    background_location: 'Android may open Settings. This verifies readiness only; it does not start location tracking.',
    gps_check: 'Stand in an open area for a fresh and accurate GPS fix. Exact setup coordinates are not retained.',
    geofence_check: 'JamJade compares a fresh device GPS fix with this booking’s immutable rental area.',
    phone_mount: 'Secure the phone upright in the vehicle mount with the screen facing the driver. Do not move it during future calibration or driving.',
  }[step];
}

function lockedStateCopy(handover: MobileTelematicsHandover): { title: string; description: string; action?: string } | undefined {
  if (handover.eligibility.state === 'handover_in_progress' || handover.eligibility.state === 'released') {
    return undefined;
  }

  const rentalStart = handover.rentalStartAt
    ? new Date(handover.rentalStartAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : 'the scheduled rental time';

  return {
    verification_required: {
      title: 'Verification Required',
      description: 'Complete and have your required self-drive documents approved before vehicle handover.',
      action: 'View documents',
    },
    waiting_for_confirmation: {
      title: 'Waiting for Booking Confirmation',
      description: 'Jamjade must confirm this self-drive booking before vehicle handover can proceed.',
    },
    rental_scheduled: {
      title: 'Rental Scheduled',
      description: `Telematics handover becomes available at ${rentalStart}.`,
    },
    inspection_required: {
      title: 'Waiting for Vehicle Inspection',
      description: 'Jamjade staff must complete the outgoing vehicle inspection before telematics setup.',
    },
    handover_preparation: {
      title: 'Preparing Vehicle Handover',
      description: handover.eligibility.geofenceAssigned
        ? 'Jamjade staff must start the handover before setup checks become available.'
        : 'Jamjade staff must assign this rental’s geofence and start the handover.',
    },
  }[handover.eligibility.state];
}

export default function TelematicsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const handleTabScroll = useAutoHideCustomerTabBar();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [handover, setHandover] = useState<MobileTelematicsHandover | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingStep, setActingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      setHandover(bookingId ? await getBookingTelematicsSetup(bookingId) : await getCurrentTelematicsSetup());
    } catch {
      setError('Telematics handover could not be refreshed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const attempt = async (step: string) => {
    if (!handover) return;
    try {
      setError(null);
      setActingStep(step);
      if (!await getNetworkReadiness()) throw new Error('No network connection. The setup result cannot be synchronized yet.');
      let evidence: Record<string, boolean | number | string | null>;
      if (step === 'device_check') {
        const result = await checkDeviceCapabilities();
        evidence = { accelerometer_available: result.accelerometerAvailable, gyroscope_available: result.gyroscopeAvailable, location_services_available: result.locationServicesAvailable, platform: result.platform, build_context: result.buildContext, checked_at: result.checkedAt };
      } else if (step === 'motion_permission') {
        const result = await requestMotionAccess();
        evidence = { permission_state: result.permissionState, can_ask_again: result.canAskAgain, platform: result.platform, checked_at: result.checkedAt };
      } else if (step === 'location_permission') {
        const result = await requestForegroundLocation();
        evidence = { permission_state: result.permissionState, can_ask_again: result.canAskAgain, platform: result.platform, checked_at: result.checkedAt };
      } else if (step === 'background_location') {
        const result = await requestBackgroundLocationAccess();
        evidence = { permission_state: result.permissionState, background_location_available: result.backgroundLocationAvailable, task_manager_available: result.taskManagerAvailable, task_defined: result.taskDefined, platform: result.platform, checked_at: result.checkedAt };
      } else if (step === 'gps_check' || step === 'geofence_check') {
        const fix = await getFreshLocationFix();
        evidence = { latitude: fix.latitude, longitude: fix.longitude, accuracy: fix.accuracy, speed: fix.speed, heading: fix.heading, captured_at: fix.capturedAt, location_services_enabled: fix.locationServicesEnabled };
      } else {
        evidence = { confirmed: true, checked_at: new Date().toISOString() };
      }
      setHandover(await submitTelematicsSetupAttempt(handover.bookingCode, step, evidence));
    } catch (attemptError) {
      setError(attemptError instanceof Error ? attemptError.message : 'The setup check could not be completed.');
    } finally {
      setActingStep(null);
    }
  };

  return <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
    <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 pb-32 pt-5" onScroll={handleTabScroll} scrollEventThrottle={16}>
      <CustomerTabHeader title="Telematics" className="-mb-2" />
      {loading ? <View className="items-center rounded-[26px] border border-border bg-surface px-5 py-10"><ActivityIndicator color="#346EF6" /><Text className="mt-3 text-[13px] font-bold text-muted-foreground">Loading handover status…</Text></View> : null}
      {error ? <View className="rounded-[26px] border border-destructive/20 bg-destructive/5 p-5"><CircleAlert size={23} color="#DC2626" /><Text className="mt-2 text-[14px] font-black text-foreground">Setup needs attention</Text><Text className="mt-1 text-[13px] leading-5 text-muted-foreground">{error}</Text><Pressable className="mt-3 self-start" accessibilityRole="button" onPress={() => void Linking.openSettings()}><Text className="text-[13px] font-black text-primary">Open device settings</Text></Pressable></View> : null}
      {!loading && !handover ? <View className="rounded-[26px] border border-border bg-surface p-5"><Text className="text-[17px] font-black text-foreground">No eligible self-drive rental</Text><Text className="mt-1 text-[13px] leading-5 text-muted-foreground">Telematics is used only for active self-drive rental handovers and trips.</Text></View> : null}
      {handover ? <>
        <View className="rounded-[26px] border border-border bg-surface p-5"><View className="flex-row gap-3"><View className="h-11 w-11 items-center justify-center rounded-full bg-muted"><ShieldCheck size={22} color="#346EF6" /></View><View className="min-w-0 flex-1"><Text className="text-[18px] font-black text-foreground">{handover.bookingCode}</Text><Text className="mt-1 text-[13px] leading-5 text-muted-foreground">{handover.eligibility.state === 'handover_in_progress' ? 'Staff handover is active. Complete each verified step in order.' : handover.eligibility.state === 'released' ? 'This rental is ongoing. Setup is read-only history.' : 'Telematics is locked until the server confirms this handover is ready.'}</Text></View></View>{handover.geofence ? <View className="mt-4 flex-row gap-3 rounded-2xl bg-muted p-3"><MapPin size={19} color="#346EF6" /><View><Text className="text-[13px] font-black text-foreground">{handover.geofence.name}</Text><Text className="mt-0.5 text-[12px] text-muted-foreground">Immutable rental area · {handover.geofence.geometryType === 'circle' ? `${handover.geofence.radiusMeters?.toLocaleString() ?? '—'} m radius` : `polygon · ${handover.geofence.polygonCoordinates?.length ?? 0} boundary points`}</Text></View></View> : null}</View>
        {lockedStateCopy(handover) ? <View className="rounded-[26px] border border-border bg-surface p-5"><Text className="text-[16px] font-black text-foreground">{lockedStateCopy(handover)?.title}</Text><Text className="mt-1 text-[13px] leading-5 text-muted-foreground">{lockedStateCopy(handover)?.description}</Text>{lockedStateCopy(handover)?.action ? <Pressable className="mt-3 self-start" accessibilityRole="button" onPress={() => router.push('/profile/documents' as Href)}><Text className="text-[13px] font-black text-primary">{lockedStateCopy(handover)?.action}</Text></Pressable> : null}</View> : null}
        {['handover_in_progress', 'released'].includes(handover.eligibility.state) ? <View className="rounded-[26px] border border-border bg-surface p-5"><Text className="text-[15px] font-black text-foreground">Telematics setup</Text><Text className="mt-1 text-[12px] leading-5 text-muted-foreground">Each result is confirmed by the JamJade server. Calibration remains locked until the next phase.</Text><View className="mt-4 gap-3">{handover.steps.map((step) => { const implemented = IMPLEMENTED_STEPS.has(step.type); const actionable = implemented && handover.eligibility.canWorkSetup; return <View key={step.type} className="rounded-2xl bg-muted p-3"><View className="flex-row items-center gap-2"><View className="h-6 w-6 items-center justify-center rounded-full bg-surface">{step.status === 'passed' ? <CheckCircle2 size={15} color="#047857" /> : <Clock3 size={15} color="#346EF6" />}</View><Text className="min-w-0 flex-1 text-[13px] font-black text-foreground">{step.label}</Text><Text className={step.status === 'passed' ? 'text-[11px] font-black text-success' : step.status === 'failed' ? 'text-[11px] font-black text-destructive' : 'text-[11px] font-black text-muted-foreground'}>{implemented ? step.status.replaceAll('_', ' ') : 'next phase'}</Text></View>{guidanceForStep(step.type) ? <Text className="mt-2 text-[12px] leading-5 text-muted-foreground">{guidanceForStep(step.type)}</Text> : null}{step.failureReason ? <Text className="mt-2 text-[12px] font-semibold leading-5 text-destructive">{step.failureReason}</Text> : null}{actionable ? <Pressable className="mt-3 items-center rounded-xl bg-primary px-3 py-3 disabled:opacity-60" accessibilityRole="button" disabled={actingStep !== null} onPress={() => void attempt(step.type)}><Text className="text-[13px] font-black text-white">{actingStep === step.type ? 'Checking…' : labelForStep(step.type)}</Text></Pressable> : null}</View>; })}</View>{handover.geofenceCheck?.inside !== null && handover.geofenceCheck?.inside !== undefined ? <View className="mt-4 rounded-2xl border border-border bg-surface p-3"><Text className="text-[12px] font-black text-foreground">Rental-area result: {handover.geofenceCheck.inside ? 'Inside' : 'Outside'}</Text><Text className="mt-1 text-[12px] text-muted-foreground">{handover.geofenceCheck.geometryType === 'polygon' ? 'Polygon boundary check' : `Distance ${Number(handover.geofenceCheck.distanceMeters).toLocaleString()} m · boundary ${Number(handover.geofenceCheck.radiusMeters).toLocaleString()} m`}</Text></View> : null}</View> : null}
      </> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="View bookings" className="items-center rounded-2xl border border-border bg-surface px-4 py-3" onPress={() => router.push('/(tabs)/bookings' as Href)}><Text className="text-[13px] font-black text-primary">View bookings</Text></Pressable>
    </ScrollView>
  </View>;
}
