import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import { Controller, type FieldErrors, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { AuthScreenFrame, AuthSubmitButton, InputWithLabel } from '@/components/common';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { registerSchema } from '@/validation';
import { updateRegisteredEmail } from '@/lib/customer/customer-store';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/services/http';

function getRegistrationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Registration failed. Check your connection and try again.';
    }

    if (error.status === 422) {
      return 'Registration failed. Please check your information and try again.';
    }
  }

  return 'Registration failed. Please try again.';
}

type RegisterFormValues = z.input<typeof registerSchema>;

function getValidationErrorMessage(errors: FieldErrors<RegisterFormValues>) {
  return (
    errors.email?.message ||
    errors.password?.message ||
    errors.confirmPassword?.message ||
    'Check your registration details.'
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { signUp } = useAuth();
  const toast = useFormToast();
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
    setError,
  } = useForm<RegisterFormValues>({
    defaultValues: {
      confirmPassword: '',
      email: '',
      password: '',
    },
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await signUp({
        email: values.email,
        password: values.password,
        password_confirmation: values.confirmPassword,
      });
      updateRegisteredEmail(values.email);
      router.replace('/onboarding/get-started');
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const fieldMap: Record<string, keyof RegisterFormValues> = {
          email: 'email',
          password: 'password',
          password_confirmation: 'confirmPassword',
        };

        Object.entries(error.errors).forEach(([serverField, messages]) => {
          const field = fieldMap[serverField];
          const message = messages[0];

          if (field && message) {
            setError(field, { message, type: 'server' });
          }
        });
      }

      toast.showToast(getRegistrationErrorMessage(error));
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1">
        <AuthScreenFrame mode="register">
          <View className="gap-4">
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
                  autoComplete="new-password"
                  error={fieldState.error?.message}
                  helperText="Use at least 8 characters."
                  icon="lock-outline"
                  label="Password"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Create password"
                  required
                  secureTextEntry
                  showPasswordToggle
                  textContentType="newPassword"
                  value={field.value}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field, fieldState }) => (
                <InputWithLabel
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={fieldState.error?.message}
                  icon="lock-outline"
                  label="Confirm password"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder="Confirm password"
                  required
                  secureTextEntry
                  showPasswordToggle
                  textContentType="newPassword"
                  value={field.value}
                />
              )}
            />

            <AuthSubmitButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Creating account...' : 'Create Account'}
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
