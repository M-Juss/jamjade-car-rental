import { useFocusEffect } from '@react-navigation/native';
import { Settings } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { DEVICE_SETUP_STEPS, deviceSetupProgress, SETUP_CHECK_ORDER, type DeviceSetupStep } from '@/lib/telematics/setup';
import type { MobileTelematicsHandover } from '@/services/api';
import type { LocationConsentInput, LocationMonitoringPolicy } from '@/validation/telematics/location-monitoring';

import { DeviceSetupDisclosureDialog } from './DeviceSetupDisclosureDialog';

export function TelematicsSetupChecklist({
  handover,
  actingStep,
  disabled,
  onCheckSetup,
  monitoringPolicy,
  consentLoading = false,
  isDriver = false,
}: {
  handover: MobileTelematicsHandover;
  actingStep: DeviceSetupStep | null;
  disabled: boolean;
  onCheckSetup: (consent: LocationConsentInput | null, includeMotion: boolean) => void;
  monitoringPolicy?: LocationMonitoringPolicy;
  rememberedConsent?: LocationConsentInput | null;
  consentLoading?: boolean;
  isDriver?: boolean;
}) {
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const continueRequested = useRef(false);
  const offerMotion = handover.calibration.profile.id === 'rc_demo';
  const canStart = !disabled && !actingStep && handover.eligibility.canWorkSetup;
  useFocusEffect(useCallback(() => () => {
    continueRequested.current = false;
    setDisclosureOpen(false);
  }, []));
  const cancelDisclosure = () => {
    continueRequested.current = false;
    setDisclosureOpen(false);
  };
  const continueSetup = (consent: LocationConsentInput | null, includeMotion: boolean) => {
    if (!disclosureOpen || !canStart || continueRequested.current) return;
    continueRequested.current = true;
    setDisclosureOpen(false);
    onCheckSetup(consent, includeMotion);
  };
  const progress = deviceSetupProgress(handover);
  const resetsCalibration = handover.steps.some((step) => step.type.endsWith('_calibration') && step.status === 'passed');
  const currentType = actingStep ?? progress.nextStep;
  const current = handover.steps.find((step) => step.type === currentType);
  const stepNumber = currentType ? SETUP_CHECK_ORDER.indexOf(currentType) + 1 : progress.total;
  const requiresSettings = current?.status === 'failed' && currentType &&
    ['motion_permission', 'location_permission', 'background_location', 'device_check'].includes(currentType);

  return (
    <View>
      <Text className="font-sans text-caption font-medium text-secondary-foreground">
        Step {stepNumber} of {progress.total}
      </Text>
      <View className="mt-3 flex-row gap-1.5" accessible accessibilityLabel={`${progress.passedCount} of ${progress.total} checks passed`}>
        {SETUP_CHECK_ORDER.map((type) => (
          <View
            key={type}
            className={`h-1.5 flex-1 rounded-full ${handover.steps.some((step) => step.type === type && step.status === 'passed') ? 'bg-primary' : 'bg-border'}`}
          />
        ))}
      </View>
      <View className="my-5 gap-2" accessibilityLiveRegion="polite">
        <View className="flex-row items-center gap-3">
          {actingStep ? <ActivityIndicator color={themeColors.primary} /> : null}
          <Text className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">
            {current?.label ?? 'Check this phone'}
          </Text>
        </View>
        <Text className="font-sans text-body leading-6 text-secondary-foreground">
          {currentType ? DEVICE_SETUP_STEPS[currentType].guidance : 'Your device checks have passed.'}
        </Text>
        {current?.failureReason && !actingStep ? (
          <Text accessibilityLiveRegion="polite" className="font-sans text-body leading-6 text-secondary-foreground">
            {current.failureReason}
          </Text>
        ) : null}
      </View>
      <ActionButton
        label={actingStep === 'phone_mount' ? 'Confirm your phone mount…' : actingStep ? 'Checking setup…' : current?.status === 'failed' ? 'Retry setup' : 'Check setup'}
        variant="primary"
        disabled={!canStart || consentLoading}
        onPress={() => {
          if (!canStart || consentLoading) return;
          continueRequested.current = false;
          setDisclosureOpen(true);
        }}
      />
      {requiresSettings && !actingStep ? (
        <ActionButton
          className="mt-3"
          label="Open device settings"
          icon={Settings}
          disabled={disabled}
          onPress={() => { void Linking.openSettings(); }}
        />
      ) : null}
      {disclosureOpen ? <DeviceSetupDisclosureDialog
        visible={disclosureOpen && canStart}
        monitoringPolicy={monitoringPolicy}
        offerMotion={offerMotion}
        isDriver={isDriver}
        resetsCalibration={resetsCalibration}
        onCancel={cancelDisclosure}
        onContinue={continueSetup}
       /> : null}
    </View>
  );
}
