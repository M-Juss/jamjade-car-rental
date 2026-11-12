import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { type FieldErrors, useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { z } from 'zod';

import { AuthScreenFrame, AuthSubmitButton } from '@/components/common';
import { CredentialsFields } from '@/forms/auth/CredentialsFields';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { loginSchema } from '@/validation';
import { useAuth } from '@/providers/AuthProvider';
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

export function LoginForm() {
  const router = useRouter();
  const { passwordChanged } = useLocalSearchParams<{ passwordChanged?: string }>();
  const { signIn } = useAuth();
  const toast = useFormToast();
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
    setError,
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await signIn({
        email: values.email,
        password: values.password,
      });
      router.replace('/');
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        let mapped = false;
        for (const field of ['email', 'password'] as const) {
          const message = error.errors?.[field]?.[0]
            ?? (field === 'email' ? error.errors?.login?.[0] : undefined);
          if (message) {
            setError(field, { type: 'server', message });
            mapped = true;
          }
        }
        if (mapped) return;
      }
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
            <CredentialsFields control={control} />

            <Pressable accessibilityRole="button" onPress={() => router.push('/forgot-password')} className="min-h-11 items-end justify-center">
              <Text className="font-sans text-[14px] font-semibold text-primary">Forgot password?</Text>
            </Pressable>

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
