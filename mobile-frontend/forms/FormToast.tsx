import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FormToastVariant = 'success' | 'info' | 'warning' | 'error';

type ToastState = {
  message: string;
  title: string;
  variant: FormToastVariant;
};

const TOAST_CONFIG: Record<FormToastVariant, {
  backgroundColor: string;
  borderColor: string;
  icon: LucideIcon;
  iconBackgroundColor: string;
  iconColor: string;
  title: string;
}> = {
  success: {
    backgroundColor: '#F2FCF5',
    borderColor: '#9BE4AF',
    icon: CircleCheck,
    iconBackgroundColor: '#4ADE80',
    iconColor: '#FFFFFF',
    title: 'Success!',
  },
  info: {
    backgroundColor: '#F1F7FF',
    borderColor: '#93C5FD',
    icon: Info,
    iconBackgroundColor: '#3B82F6',
    iconColor: '#FFFFFF',
    title: 'Information',
  },
  warning: {
    backgroundColor: '#FFF9EB',
    borderColor: '#F7D77A',
    icon: TriangleAlert,
    iconBackgroundColor: '#FBBF24',
    iconColor: '#FFFFFF',
    title: 'Warning!',
  },
  error: {
    backgroundColor: '#FFF3F4',
    borderColor: '#FDA4AF',
    icon: CircleX,
    iconBackgroundColor: '#F43F5E',
    iconColor: '#FFFFFF',
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

  const showToast = useCallback((
    nextMessage: string,
    variant: FormToastVariant = 'error',
    title?: string,
  ) => {
    setToast({
      message: nextMessage,
      title: title ?? TOAST_CONFIG[variant].title,
      variant,
    });
  }, []);

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
  title,
  variant = 'error',
}: {
  message: string;
  onDismiss: () => void;
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
      style={{ top: Math.max(insets.top + 10, 22) }}>
      <View
        className="flex-row items-center gap-3 rounded-[18px] border px-4 py-3.5 shadow-lg shadow-[#17315F]/10"
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
          <Text className="text-[14px] font-black leading-5 text-[#1E293B]">
            {title ?? config.title}
          </Text>
          <Text className="mt-0.5 text-[12px] font-medium leading-[18px] text-[#64748B]">
            {message}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss notification"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
          className="h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <X size={18} color="#64748B" strokeWidth={2.35} />
        </Pressable>
      </View>
    </View>
  );
}
