import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';

export type FormToastVariant = 'success' | 'info' | 'warning' | 'error';

type ToastState = {
  message: string;
  title: string;
  variant: FormToastVariant;
};

const TOAST_CONFIG: Record<
  FormToastVariant,
  {
    backgroundColor: string;
    borderColor: string;
    icon: LucideIcon;
    iconBackgroundColor: string;
    iconColor: string;
    title: string;
  }
> = {
  success: {
    backgroundColor: themeColors.successSurface,
    borderColor: themeColors.successBorder,
    icon: CircleCheck,
    iconBackgroundColor: themeColors.success,
    iconColor: themeColors.surface,
    title: 'Success!',
  },
  info: {
    backgroundColor: themeColors.muted,
    borderColor: themeColors.border,
    icon: Info,
    iconBackgroundColor: themeColors.primary,
    iconColor: themeColors.surface,
    title: 'Information',
  },
  warning: {
    backgroundColor: themeColors.warningSurface,
    borderColor: themeColors.warningBorder,
    icon: TriangleAlert,
    iconBackgroundColor: themeColors.warning,
    iconColor: themeColors.surface,
    title: 'Warning!',
  },
  error: {
    backgroundColor: themeColors.destructiveSurface,
    borderColor: themeColors.destructiveBorder,
    icon: CircleX,
    iconBackgroundColor: themeColors.destructive,
    iconColor: themeColors.surface,
    title: 'Something went wrong!',
  },
};

export function useFormToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = setTimeout(() => setToast(null), 4200);

    return () => clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback(
    (nextMessage: string, variant: FormToastVariant = 'error', title?: string) => {
      setToast({
        message: nextMessage,
        title: title ?? TOAST_CONFIG[variant].title,
        variant,
      });
    },
    [],
  );

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    clearToast,
    message: toast?.message ?? '',
    showToast,
    title: toast?.title,
    variant: toast?.variant,
  };
}

export function FormToast({
  message,
  onDismiss,
  safeAreaTopHandled = false,
  title,
  variant = 'error',
}: {
  message: string;
  onDismiss: () => void;
  safeAreaTopHandled?: boolean;
  title?: string;
  variant?: FormToastVariant;
}) {
  const insets = useSafeAreaInsets();

  if (!message) {
    return null;
  }

  const config = TOAST_CONFIG[variant];
  const Icon = config.icon;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-50 px-5"
      style={{ top: safeAreaTopHandled ? 10 : Math.max(insets.top + 10, 22) }}>
      <View
        className="flex-row items-center gap-3 rounded-[18px] border px-4 py-3.5 "
        style={{
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        }}>
        <View
          className="h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: config.iconBackgroundColor }}>
          <Icon size={22} color={config.iconColor} strokeWidth={2.6} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[14px] font-semibold leading-5 text-foreground">
            {title ?? config.title}
          </Text>
          <Text className="font-sans mt-0.5 text-[12px] font-medium leading-[18px] text-secondary-foreground">
            {message}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
          className="h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <X size={18} color={themeColors.mutedForeground} strokeWidth={2.35} />
        </Pressable>
      </View>
    </View>
  );
}
