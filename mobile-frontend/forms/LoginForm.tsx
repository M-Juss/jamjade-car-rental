import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthScreenFrame, AuthSubmitButton, InputWithLabel } from '@/components/common';
import { FormToast, useFormToast } from '@/forms/FormToast';
import {
  validateLogin,
  type FieldErrors,
  type LoginField,
} from '@/forms/validation';
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

function getValidationErrorMessage(errors: FieldErrors<LoginField>) {
  const message = errors.email || errors.password;

  return message ? withLoginFailedPrefix(message) : 'Login failed. Please check your login details.';
}

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useFormToast();

  const updateEmail = (value: string) => {
    setEmail(value);
  };

  const updatePassword = (value: string) => {
    setPassword(value);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const validation = validateLogin({ email, password });

    if (!validation.data) {
      toast.showToast(getValidationErrorMessage(validation.errors));
      return;
    }

    setIsSubmitting(true);

    try {
      await signIn({
        email: validation.data.email,
        password: validation.data.password,
      });
      router.replace('/(tabs)');
    } catch (error) {
      toast.showToast(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1">
        <AuthScreenFrame mode="login">
          <View className="gap-4">
            <InputWithLabel
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              icon="mail-outline"
              keyboardType="email-address"
              label="Email address"
              onChangeText={updateEmail}
              placeholder="you@example.com"
              required
              textContentType="emailAddress"
              value={email}
            />

            <InputWithLabel
              autoCapitalize="none"
              autoComplete="password"
              icon="lock-outline"
              label="Password"
              onChangeText={updatePassword}
              placeholder="Enter password"
              required
              secureTextEntry
              showPasswordToggle
              textContentType="password"
              value={password}
            />

            <View className="rounded-3xl border border-[#DDE8FF] bg-[#F8FAFF] px-4 py-3">
              <Text className="text-[13px] font-bold leading-5 text-[#17315F]">
                Continue with your JamJade account.
              </Text>
              <Text className="mt-1 text-[12px] font-medium leading-[18px] text-[#6C7A96]">
                Sign in to manage reservations, document verification, and trip updates.
              </Text>
            </View>

            <AuthSubmitButton
              disabled={isSubmitting}
              label={isSubmitting ? 'Logging in...' : 'Continue'}
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
