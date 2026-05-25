import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AuthScreenFrame, AuthSubmitButton, InputWithLabel } from '@/components/common';

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const normalizedEmail = email.trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const isPasswordValid = password.length >= 8;
  const doPasswordsMatch = password === confirmPassword;

  const errors = useMemo(
    () => ({
      email: hasSubmitted && !isEmailValid ? 'Enter a valid email address.' : '',
      password: hasSubmitted && !isPasswordValid ? 'Use at least 8 characters.' : '',
      confirmPassword:
        hasSubmitted && !doPasswordsMatch ? 'Password and confirm password must match.' : '',
    }),
    [doPasswordsMatch, hasSubmitted, isEmailValid, isPasswordValid],
  );

  const isSubmitDisabled = !normalizedEmail || !password || !confirmPassword;

  const handleSubmit = () => {
    setHasSubmitted(true);

    if (!isEmailValid || !isPasswordValid || !doPasswordsMatch) {
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthScreenFrame mode="register">
        <View className="gap-3.5">
          <InputWithLabel
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            error={errors.email}
            icon="mail-outline"
            keyboardType="email-address"
            label="Email address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            required
            textContentType="emailAddress"
            value={email}
          />

          <InputWithLabel
            autoCapitalize="none"
            autoComplete="new-password"
            error={errors.password}
            helperText="Minimum 8 characters."
            icon="lock-outline"
            label="Password"
            onChangeText={setPassword}
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
            onChangeText={setConfirmPassword}
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

          <AuthSubmitButton label="Register" disabled={isSubmitDisabled} onPress={handleSubmit} />
        </View>
      </AuthScreenFrame>
    </>
  );
}
