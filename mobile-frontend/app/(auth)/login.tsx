import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { AuthScreenFrame, AuthSubmitButton, InputWithLabel } from '@/components/common';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const normalizedEmail = email.trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  const errors = useMemo(
    () => ({
      email: hasSubmitted && !isEmailValid ? 'Enter a valid email address.' : '',
      password: hasSubmitted && !password ? 'Enter your password.' : '',
    }),
    [hasSubmitted, isEmailValid, password],
  );

  const isSubmitDisabled = !normalizedEmail || !password;

  const handleSubmit = () => {
    setHasSubmitted(true);

    if (!isEmailValid || !password) {
      return;
    }

    Alert.alert('Welcome back', 'Login is ready to connect to the auth API.', [
      { text: 'Continue', onPress: () => router.replace('/(tabs)') },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthScreenFrame mode="login">
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
            autoComplete="password"
            error={errors.password}
            icon="lock-outline"
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter password"
            required
            secureTextEntry
            showPasswordToggle
            textContentType="password"
            value={password}
          />

          <AuthSubmitButton label="Continue" disabled={isSubmitDisabled} onPress={handleSubmit} />
        </View>
      </AuthScreenFrame>
    </>
  );
}
