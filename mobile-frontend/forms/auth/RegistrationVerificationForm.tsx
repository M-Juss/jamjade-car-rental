import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { AppState, BackHandler, Pressable, Text, TextInput, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthScreenFrame, AuthSubmitButton } from '@/components/common';
import type { useFormToast } from '@/forms/shared/FormToast';
import { ApiError } from '@/services/http';
import type { MobileRegistrationPending, MobileUser } from '@/services/api';
import { registrationResendSchema, registrationVerificationSchema } from '@/validation';

type VerificationFormValues = z.input<typeof registrationVerificationSchema>;
type ToastController = ReturnType<typeof useFormToast>;

function getVerificationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Could not connect. Check your connection and try again.';
    if (error.status === 408) return 'Email delivery is taking longer than expected. Check your inbox before requesting another code.';
    if (error.status === 429) return 'Too many attempts. Wait a moment and try again.';
    if (error.status === 422) return 'Code could not be verified. Check the message below or restart registration.';
    if (error.status === 503) return 'Email verification is temporarily unavailable. Try again shortly.';
  }
  return 'Could not verify your email. Please try again.';
}

function getResendErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Could not connect. Check your connection and try again.';
    if (error.status === 429) return 'Too many requests. Wait a moment before requesting another code.';
    if (error.status === 503) return 'Email delivery is temporarily unavailable. Try again shortly.';
    if (error.status === 422) return 'This registration can no longer receive a code. Go back and register again.';
  }
  return 'Could not send a new code. Please try again.';
}

export function RegistrationVerificationForm({
  pending,
  onBack,
  onVerified,
  toast,
  verifyRegistration,
  resendRegistrationCode,
  setPending,
}: {
  pending: MobileRegistrationPending;
  onBack: () => void;
  onVerified: (email: string) => void;
  toast: ToastController;
  verifyRegistration: (payload: { registration_id: string; code: string }) => Promise<MobileUser>;
  resendRegistrationCode: (payload: { registration_id: string }) => Promise<MobileRegistrationPending>;
  setPending: (value: MobileRegistrationPending) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [isResending, setIsResending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [formError, setFormError] = useState('');
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
    setError,
    setValue,
  } = useForm<VerificationFormValues>({
    defaultValues: { registrationId: pending.registrationId, code: '' },
    resolver: zodResolver(registrationVerificationSchema),
  });
  const busy = isSubmitting || isResending;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(Date.now());
    const start = () => { if (!timer) timer = setInterval(tick, 1000); };
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { tick(); start(); } else stop();
    });
    return () => { stop(); subscription.remove(); };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [busy, onBack]);

  const secondsLeft = (isoDate: string) => Math.max(0, Math.ceil((Date.parse(isoDate) - now) / 1000));
  const resendSeconds = secondsLeft(pending.resendAvailableAt);
  const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const submit = async (values: VerificationFormValues) => {
    setFormError('');
    try {
      await verifyRegistration({ registration_id: values.registrationId, code: values.code });
      onVerified(pending.email);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const codeMessage = error.errors.code?.[0];
        const sessionMessage = error.errors.registration_id?.[0]
          ?? error.errors.email?.[0]
          ?? error.errors.phone_number?.[0]
          ?? Object.values(error.errors).flat()[0];
        if (codeMessage) setError('code', { message: codeMessage, type: 'server' });
        if (sessionMessage && sessionMessage !== codeMessage) setFormError(sessionMessage);
      }
      toast.showToast(getVerificationErrorMessage(error));
    }
  };

  const resend = async () => {
    const parsed = registrationResendSchema.safeParse({ registrationId: pending.registrationId });
    if (!parsed.success) {
      setFormError('This registration session is invalid. Go back and register again.');
      return;
    }
    setIsResending(true);
    setFormError('');
    try {
      const refreshed = await resendRegistrationCode({ registration_id: parsed.data.registrationId });
      setPending(refreshed);
      setValue('registrationId', refreshed.registrationId);
      setValue('code', '');
      toast.clearToast();
    } catch (error) {
      if (error instanceof ApiError && error.errors?.registration_id?.[0]) {
        setFormError(error.errors.registration_id[0]);
      }
      toast.showToast(getResendErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <AuthScreenFrame
        mode="verification"
        description={`Enter the six-digit code sent to ${pending.email}.`}
        onBack={onBack}
        disableBack={busy}
        hideFooter
      >
        <View className="gap-4">
          <Controller control={control} name="code" render={({ field, fieldState }) => {
            const digits = Array.from({ length: 6 }, (_, index) => field.value[index] ?? '');
            return (
              <View>
                <Text className="mb-2 font-sans text-caption font-medium text-foreground">Verification code</Text>
                <View className="relative min-h-14 flex-row justify-between gap-2">
                  {digits.map((digit, index) => (
                    <View
                      key={index}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      className={`min-h-14 flex-1 items-center justify-center rounded-field border bg-surface ${fieldState.error ? 'border-destructive-border' : focused && Math.min(field.value.length, 5) === index ? 'border-primary' : 'border-border'}`}>
                      <Text className="font-sans text-[22px] font-semibold text-foreground">{digit || ' '}</Text>
                    </View>
                  ))}
                  <TextInput
                    accessibilityLabel="6-digit verification code"
                    accessibilityHint="Enter the code sent to your email address."
                    autoComplete="one-time-code"
                    autoFocus
                    caretHidden
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!busy}
                    underlineColorAndroid="transparent"
                    onBlur={() => { field.onBlur(); setFocused(false); }}
                    onChangeText={(value) => field.onChange(value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setFocused(true)}
                    selection={{ start: field.value.length, end: field.value.length }}
                    selectionColor="transparent"
                    value={field.value}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, minHeight: 56, color: 'transparent', backgroundColor: 'transparent', opacity: 0, textAlign: 'center', fontSize: 22 }}
                  />
                </View>
                {fieldState.error?.message ? <Text className="mt-1 font-sans text-[13px] text-destructive">{fieldState.error.message}</Text> : null}
              </View>
            );
          }} />

          {formError ? <Text accessibilityRole="alert" className="font-sans text-[13px] text-destructive">{formError}</Text> : null}

          <AuthSubmitButton
            disabled={busy}
            label={isSubmitting ? 'Verifying...' : 'Verify email'}
            onPress={handleSubmit(submit, () => toast.showToast('Enter the six-digit code.'))}
          />

          <View className="flex-row flex-wrap items-center justify-center">
            <Text className="font-sans text-[14px] text-secondary-foreground">Didn’t receive a code?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: resendSeconds > 0 || busy }}
              disabled={resendSeconds > 0 || busy}
              onPress={() => void resend()}
              className="min-h-11 justify-center px-2">
              <Text className={`font-sans text-[14px] font-semibold ${resendSeconds > 0 || busy ? 'text-muted-foreground' : 'text-primary'}`}>
                {isResending ? 'Sending...' : resendSeconds > 0 ? `Resend in ${formatCountdown(resendSeconds)}` : 'Resend code'}
              </Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
            onPress={onBack} className="min-h-11 flex-row items-center justify-center gap-1">
            <Text className={`font-sans text-[14px] font-medium ${busy ? 'text-muted-foreground' : 'text-primary'}`}>Change email</Text>
          </Pressable>
        </View>
      </AuthScreenFrame>
    </>
  );
}
