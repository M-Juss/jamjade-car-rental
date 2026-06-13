import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthScreenFrame, AuthSubmitButton, InputWithLabel } from '@/components/common';
import { FormToast, useFormToast } from '@/forms/FormToast';
import {
  validateRegister,
  type FieldErrors,
  type RegisterField,
} from '@/forms/validation';
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

function getValidationErrorMessage(errors: FieldErrors<RegisterField>) {
  return errors.email
    || errors.password
    || errors.confirmPassword
    || 'Check your registration details.';
}

export function RegisterForm() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<RegisterField>>({});
  const toast = useFormToast();

  const updateField = (key: RegisterField, value: string) => {
    if (key === 'email') {
      setEmail(value);
    } else if (key === 'password') {
      setPassword(value);
    } else {
      setConfirmPassword(value);
    }

    setErrors((currentErrors) => ({ ...currentErrors, [key]: '' }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const validation = validateRegister({ email, password, confirmPassword });
    setErrors(validation.errors);

    if (!validation.data) {
      toast.showToast(getValidationErrorMessage(validation.errors));
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp({
        email: validation.data.email,
        password: validation.data.password,
        password_confirmation: validation.data.confirmPassword,
      });
      updateRegisteredEmail(validation.data.email);
      router.replace({
        pathname: '/register-success',
        params: { email: validation.data.email },
      });
    } catch (error) {
      toast.showToast(getRegistrationErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1">
        <AuthScreenFrame mode="register">
          <View className="gap-4">
            <InputWithLabel
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              error={errors.email}
              icon="mail-outline"
              keyboardType="email-address"
              label="Email address"
              onChangeText={(value) => updateField('email', value)}
              placeholder="you@example.com"
              required
              textContentType="emailAddress"
              value={email}
            />

            <InputWithLabel
              autoCapitalize="none"
              autoComplete="new-password"
              error={errors.password}
              helperText="Use at least 8 characters with 1 uppercase letter and 1 special character."
              icon="lock-outline"
              label="Password"
              onChangeText={(value) => updateField('password', value)}
              placeholder="Create password"
              required
              secureTextEntry
              showPasswordToggle
              textContentType="newPassword"
              value={password}
            />

            <InputWithLabel
              autoCapitalize="none"
              autoComplete="new-password"
              error={errors.confirmPassword}
              icon="lock-outline"
              label="Confirm password"
              onChangeText={(value) => updateField('confirmPassword', value)}
              placeholder="Confirm password"
              required
              secureTextEntry
              showPasswordToggle
              textContentType="newPassword"
              value={confirmPassword}
            />

            <View className="rounded-3xl border border-[#DDE8FF] bg-[#F8FAFF] px-4 py-3">
              <Text className="text-[13px] font-bold leading-5 text-[#17315F]">
                Start your JamJade account.
              </Text>
              <Text className="mt-1 text-[12px] font-medium leading-[18px] text-[#6C7A96]">
                Register once to make future reservations faster and easier.
              </Text>
            </View>

            <AuthSubmitButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Creating account...' : 'Continue'}
              onPress={handleSubmit}
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
