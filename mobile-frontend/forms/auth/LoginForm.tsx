import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, type FieldErrors, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { AuthScreenFrame, AuthSubmitButton, InputWithLabel } from '@/components/common';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { loginSchema } from '@/validation';
import { useAuth } from '@/providers/AuthProvider';
import type { MobileUser } from '@/services/api';
import { ApiError } from '@/services/http';

function withLoginFailedPrefix(message: string) {
  const trimmed = message.trim();

  if (trimmed.toLowerCase().startsWith('login failed')) {
    return trimmed;
  }

  return `Login failed. ${trimmed}`;
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Login failed. Check your connection and try again.';
    }

    if (error.status === 401 || error.status === 422) {
      return 'Login failed. Please check your email and password, then try again.';
    }
  }

  return 'Login failed. Please try again.';
}

type LoginFormValues = z.input<typeof loginSchema>;

function getValidationErrorMessage(errors: FieldErrors<LoginFormValues>) {
  const message = errors.email?.message || errors.password?.message;

  return message ? withLoginFailedPrefix(message) : 'Login failed. Please check your login details.';
}

function needsBasicProfileSetup(user: MobileUser) {
  const profile = user.profile;
  const contactNumber = user.phoneNumber ?? profile?.phoneNumber;

  return !(
    profile?.firstName?.trim() &&
    profile.lastName?.trim() &&
    contactNumber?.trim() &&
    profile.birthdate &&
    profile.address?.trim()
  );
}

export function LoginForm() {
  const router = useRouter();
  const { passwordChanged } = useLocalSearchParams<{ passwordChanged?: string }>();
  const { signIn } = useAuth();
  const toast = useFormToast();
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const user = await signIn({
        email: values.email,
        password: values.password,
      });
      if (user.roles?.includes('driver')) {
        router.replace('/(driver)/services');
        return;
      }
      router.replace(needsBasicProfileSetup(user) ? '/onboarding/basic-info' : '/(tabs)');
    } catch (error) {
      toast.showToast(getLoginErrorMessage(error));
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1">
        <AuthScreenFrame mode="login">
          <View className="gap-4">
            {passwordChanged === '1' ? (
              <View
                accessibilityRole="alert"
                className="rounded-field border border-success-border bg-success-surface p-3">
                <Text className="font-sans text-caption text-success">
                  Password updated. Sign in with your new password.
                </Text>
              </View>
            ) : null}
            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <InputWithLabel
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  error={fieldState.error?.message}
                  icon="mail-outline"
                  keyboardType="email-address"
                  label="Email address"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="you@example.com"
                  required
                  textContentType="emailAddress"
                  value={field.value}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <InputWithLabel
                  autoCapitalize="none"
                  autoComplete="password"
                  error={fieldState.error?.message}
                  icon="lock-outline"
                  label="Password"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Enter password"
                  required
                  secureTextEntry
                  showPasswordToggle
                  textContentType="password"
                  value={field.value}
                />
              )}
            />

            <AuthSubmitButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Logging in...' : 'Sign In'}
              onPress={handleSubmit(onSubmit, (errors) => {
                toast.showToast(getValidationErrorMessage(errors));
              })}
            />
          </View>
        </AuthScreenFrame>
        <FormToast
          message={toast.message}
          onDismiss={toast.clearToast}
          title={toast.title}
          variant={toast.variant}
        />
      </View>
    </>
  );
}
