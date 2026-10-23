import { Controller, type Control } from 'react-hook-form';
import type { z } from 'zod';

import { InputWithLabel } from '@/components/common';
import type { loginSchema } from '@/validation/auth/schemas';

export function CredentialsFields({ control }: { control: Control<z.input<typeof loginSchema>> }) {
  return (
    <>
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
    </>
  );
}
