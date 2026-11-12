import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

import { AuthScreenFrame, AuthSubmitButton, InputWithLabel } from '@/components/common';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { completePasswordReset, requestPasswordReset, verifyPasswordReset, type PasswordResetPending } from '@/services/api/auth.service';
import { ApiError } from '@/services/http';
import { passwordResetCodeSchema, passwordResetEmailSchema, passwordResetPasswordSchema } from '@/validation/auth/schemas';

type EmailValues = z.input<typeof passwordResetEmailSchema>;
type CodeValues = z.input<typeof passwordResetCodeSchema>;
type PasswordValues = z.input<typeof passwordResetPasswordSchema>;

export function ForgotPasswordForm() {
  const router = useRouter();
  const toast = useFormToast();
  const [stage, setStage] = useState<'email' | 'code' | 'password'>('email');
  const [pending, setPending] = useState<PasswordResetPending | null>(null);
  const [resetToken, setResetToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(Date.now());
  const emailForm = useForm<EmailValues>({ resolver: zodResolver(passwordResetEmailSchema), defaultValues: { email: '' } });
  const codeForm = useForm<CodeValues>({ resolver: zodResolver(passwordResetCodeSchema), defaultValues: { code: '' } });
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordResetPasswordSchema), defaultValues: { password: '', confirmPassword: '' } });

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const back = () => {
    if (stage === 'email') router.replace('/login');
    else { setStage('email'); setPending(null); setResetToken(''); codeForm.reset(); passwordForm.reset(); }
  };
  const showError = (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.status === 429) return toast.showToast('Too many requests. Please wait before trying again.');
      if (error.status === 0) return toast.showToast('Could not connect. Check your connection and try again.');
      if (error.status === 408) return toast.showToast('Email delivery is taking longer than expected. Check your inbox before requesting another code.');
      const message = error.errors && Object.values(error.errors).flat()[0];
      if (message) return toast.showToast(message);
    }
    toast.showToast('Something went wrong. Please try again.');
  };
  const send = async (values: EmailValues) => {
    setBusy(true);
    try { const result = await requestPasswordReset(values.email); setPending(result); codeForm.reset(); setStage('code'); toast.clearToast(); }
    catch (error) { if (error instanceof ApiError && error.errors?.email?.[0]) emailForm.setError('email', { type: 'server', message: error.errors.email[0] }); else showError(error); }
    finally { setBusy(false); }
  };
  const verify = async (values: CodeValues) => {
    if (!pending) return;
    setBusy(true);
    try { setResetToken(await verifyPasswordReset(pending.resetId, values.code)); setStage('password'); toast.clearToast(); }
    catch (error) { if (error instanceof ApiError && error.errors?.code?.[0]) codeForm.setError('code', { type: 'server', message: error.errors.code[0] }); else showError(error); }
    finally { setBusy(false); }
  };
  const complete = async (values: PasswordValues) => {
    if (!pending || !resetToken) return;
    setBusy(true);
    try { await completePasswordReset(pending.resetId, resetToken, values.password, values.confirmPassword); setResetToken(''); router.replace({ pathname: '/login', params: { passwordChanged: '1' } }); }
    catch (error) {
      if (error instanceof ApiError && error.errors) {
        if (error.errors.password?.[0]) passwordForm.setError('password', { type: 'server', message: error.errors.password[0] });
        if (error.errors.password_confirmation?.[0]) passwordForm.setError('confirmPassword', { type: 'server', message: error.errors.password_confirmation[0] });
        if (!error.errors.password && !error.errors.password_confirmation) showError(error);
      } else showError(error);
    } finally { setBusy(false); }
  };
  const resendSeconds = pending ? Math.max(0, Math.ceil((Date.parse(pending.resendAvailableAt) - now) / 1000)) : 0;
  const title = stage === 'email' ? 'Forgot password?' : stage === 'code' ? 'Verify your email' : 'Create a new password';
  const description = stage === 'email' ? 'Enter your email address to receive a verification code.' : stage === 'code' ? `If an eligible account exists, a code was sent to ${emailForm.getValues('email')}.` : 'Enter and confirm your new password.';

  return <>
    <AuthScreenFrame mode="verification" title={title} description={description} onBack={back} backLabel="Back to sign in" disableBack={busy} hideFooter>
      <View className="gap-4">
        {stage === 'email' && <>
          <Controller control={emailForm.control} name="email" render={({field, fieldState}) => <InputWithLabel label="Email address" icon="mail-outline" autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" placeholder="you@example.com" required value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} disabled={busy} />} />
          <AuthSubmitButton label={busy ? 'Sending...' : 'Send code'} disabled={busy} onPress={emailForm.handleSubmit(send)} />
        </>}
        {stage === 'code' && <>
          <Controller control={codeForm.control} name="code" render={({field, fieldState}) => <View>
            <Text className="mb-2 font-sans text-caption font-medium text-foreground">Verification code</Text>
            <View className="relative min-h-14 flex-row justify-between gap-2">
              {Array.from({length: 6}, (_, index) => <View key={index} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className={`min-h-14 flex-1 items-center justify-center rounded-field border bg-surface ${fieldState.error ? 'border-destructive-border' : focused && Math.min(field.value.length, 5) === index ? 'border-primary' : 'border-border'}`}><Text className="font-sans text-[22px] font-semibold text-foreground">{field.value[index] || ' '}</Text></View>)}
              <TextInput accessibilityLabel="6-digit verification code" accessibilityHint="Enter the code sent to your email address." autoComplete="one-time-code" autoFocus caretHidden keyboardType="number-pad" maxLength={6} editable={!busy} underlineColorAndroid="transparent" onBlur={() => { field.onBlur(); setFocused(false); }} onFocus={() => setFocused(true)} onChangeText={(value) => field.onChange(value.replace(/\D/g, '').slice(0, 6))} selection={{start: field.value.length, end: field.value.length}} selectionColor="transparent" value={field.value} style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, minHeight: 56, color: 'transparent', backgroundColor: 'transparent', opacity: 0, textAlign: 'center', fontSize: 22}} />
            </View>
            {fieldState.error?.message && <Text className="mt-1 font-sans text-[13px] text-destructive">{fieldState.error.message}</Text>}
          </View>} />
          <AuthSubmitButton label={busy ? 'Verifying...' : 'Verify code'} disabled={busy} onPress={codeForm.handleSubmit(verify)} />
          <Pressable accessibilityRole="button" accessibilityState={{disabled: busy || resendSeconds > 0}} disabled={busy || resendSeconds > 0} onPress={() => void send(emailForm.getValues())} className="min-h-11 items-center justify-center"><Text className={`font-sans text-[14px] font-semibold ${busy || resendSeconds > 0 ? 'text-muted-foreground' : 'text-primary'}`}>{resendSeconds > 0 ? `Resend in ${Math.floor(resendSeconds / 60)}:${String(resendSeconds % 60).padStart(2, '0')}` : 'Resend code'}</Text></Pressable>
        </>}
        {stage === 'password' && <>
          {(['password', 'confirmPassword'] as const).map((name) => <Controller key={name} control={passwordForm.control} name={name} render={({field, fieldState}) => <InputWithLabel label={name === 'password' ? 'New password' : 'Confirm password'} icon="lock-outline" autoCapitalize="none" autoComplete="new-password" placeholder={name === 'password' ? 'Create password' : 'Confirm password'} required secureTextEntry showPasswordToggle value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} disabled={busy} />} />)}
          <AuthSubmitButton label={busy ? 'Saving...' : 'Reset password'} disabled={busy} onPress={passwordForm.handleSubmit(complete)} />
        </>}
      </View>
    </AuthScreenFrame>
    <FormToast message={toast.message} onDismiss={toast.clearToast} title={toast.title} variant={toast.variant} />
  </>;
}
