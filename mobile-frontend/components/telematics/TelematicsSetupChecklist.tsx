import { CheckCircle2, CircleAlert, Clock3, Settings, ShieldCheck } from 'lucide-react-native';
import { Linking, Text, View } from 'react-native';

import { ActionButton, SectionCard } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { DEVICE_SETUP_STEPS, isDeviceSetupStep, type DeviceSetupStep } from '@/lib/telematics/setup';
import type { MobileTelematicsHandover } from '@/services/api';

export function TelematicsSetupChecklist({
  handover,
  actingStep,
  disabled,
  onCheckSetup,
}: {
  handover: MobileTelematicsHandover;
  actingStep: DeviceSetupStep | null;
  disabled: boolean;
  onCheckSetup: () => void;
}) {
  const steps = handover.steps.filter((step) => isDeviceSetupStep(step.type));
  const passedCount = steps.filter((step) => step.status === 'passed').length;

  return (
    <SectionCard title="Telematics setup" icon={ShieldCheck}>
      <Text className="font-sans text-[13px] font-medium leading-5 text-secondary-foreground">
        {passedCount} of {steps.length} checks passed. Each result is confirmed by JamJade.
      </Text>
      <Text className="font-sans mt-2 text-[12px] font-normal leading-5 text-secondary-foreground">
        One action checks device readiness, motion and location permissions, GPS, and your rental area in
        order. Allow the system permission prompts, then confirm your phone mount. Checks use fresh setup
        locations without starting tracking.
      </Text>
      {handover.eligibility.canWorkSetup ? (
        <View className="mt-4">
          <ActionButton
            label={
              actingStep === 'phone_mount'
                ? 'Waiting for mount confirmation…'
                : actingStep
                  ? 'Checking setup…'
                  : 'Check setup'
            }
            variant="primary"
            disabled={disabled || actingStep !== null}
            onPress={onCheckSetup}
          />
          {actingStep ? (
            <Text
              accessibilityLiveRegion="polite"
              className="font-sans mt-2 text-center text-[12px] font-medium text-primary">
              {handover.steps.find((step) => step.type === actingStep)?.label ?? 'Checking setup'}
            </Text>
          ) : null}
        </View>
      ) : null}
      {!handover.eligibility.canWorkSetup ? (
        <Text className="font-sans mt-2 text-[12px] font-normal leading-5 text-secondary-foreground">
          {handover.setup?.status === 'released'
            ? 'Setup history is read-only after rental release.'
            : handover.setup?.status === 'ready_for_release'
              ? 'Setup is ready. Wait for staff to release the vehicle.'
              : 'Checks unlock when staff starts your handover.'}
        </Text>
      ) : null}
      <View className="mt-4 gap-3">
        {steps.map((step) => {
          if (!isDeviceSetupStep(step.type)) return null;
          const type = step.type;
          const definition = DEVICE_SETUP_STEPS[type];
          const Icon =
            step.status === 'passed' ? CheckCircle2 : step.status === 'failed' ? CircleAlert : Clock3;
          const color =
            step.status === 'passed'
              ? themeColors.success
              : step.status === 'failed'
                ? themeColors.destructive
                : themeColors.primary;
          const statusClass =
            step.status === 'passed'
              ? 'text-success'
              : step.status === 'failed'
                ? 'text-destructive'
                : 'text-secondary-foreground';
          const requiresSettings =
            step.status === 'failed' &&
            ['motion_permission', 'location_permission', 'background_location', 'device_check'].includes(
              type,
            );

          return (
            <View key={type} className="rounded-[18px] border border-border bg-background p-4">
              <View className="flex-row items-start gap-2.5">
                <Icon size={19} color={color} />
                <View className="min-w-0 flex-1">
                  <Text className="font-sans text-[13px] font-semibold leading-5 text-foreground">
                    {step.label}
                  </Text>
                  <Text
                    className={`font-sans mt-0.5 text-[11px] font-medium capitalize ${actingStep === type ? 'text-primary' : statusClass}`}>
                    {actingStep === type
                      ? type === 'phone_mount'
                        ? 'Awaiting your confirmation'
                        : 'Checking…'
                      : step.status.replaceAll('_', ' ')}
                  </Text>
                </View>
              </View>
              <Text className="font-sans mt-2 text-[12px] font-normal leading-5 text-secondary-foreground">
                {definition.guidance}
              </Text>
              {type === 'phone_mount' ? (
                <Text className="font-sans mt-2 text-[12px] font-normal leading-5 text-secondary-foreground">
                  This is your manual confirmation. The app cannot detect a physical phone holder or verify
                  mounting automatically.
                </Text>
              ) : null}
              {step.failureReason ? (
                <Text className="font-sans mt-2 text-[12px] font-medium leading-5 text-destructive">
                  {step.failureReason}
                </Text>
              ) : null}
              {handover.eligibility.canWorkSetup && requiresSettings ? (
                <ActionButton
                  className="mt-3"
                  label="Open device settings"
                  icon={Settings}
                  disabled={actingStep !== null}
                  onPress={() => {
                    void Linking.openSettings();
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}
