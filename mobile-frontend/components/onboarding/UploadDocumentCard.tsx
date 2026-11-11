import { themeColors } from '@/constants/theme';
import { FileCheck2, ImagePlus, Trash2, Upload } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { pickImageFromDevice, type DocumentImagePickError } from '@/lib/customer/image-picker';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function UploadDocumentCard({
  disabled = false,
  error,
  helperText,
  isUploading = false,
  label,
  onChange,
  onPickError,
  required = false,
  value,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  helperText?: string;
  isUploading?: boolean;
  error?: string;
  disabled?: boolean;
  onPickError?: (error: DocumentImagePickError) => void;
}) {
  const hasPreview = Boolean(value);
  const [failedValue, setFailedValue] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const imageFailed = hasPreview && failedValue === value;

  const handlePickImage = async () => {
    if (disabled) {
      return;
    }

    const result = await pickImageFromDevice();

    if (result.error) {
      onPickError?.(result.error);
      return;
    }

    if (result.uri) {
      onChange(result.uri);
    }
  };

  return (
    <View
      className={cx(
        'rounded-card border bg-surface p-card',
        error ? 'border-destructive-border' : 'border-border',
      )}>
      <View className="flex-row items-start gap-3">
        <View
          className={cx(
            'h-8 w-8 items-center justify-center rounded-field',
            hasPreview ? 'bg-success-surface' : 'bg-muted',
          )}>
          {hasPreview ? (
            <FileCheck2 size={20} color={themeColors.success} strokeWidth={2.45} />
          ) : (
            <ImagePlus size={20} color={themeColors.primary} strokeWidth={2.45} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[15px] font-semibold leading-5 text-foreground">
            {label}
            {required ? <Text className="text-destructive"> *</Text> : null}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePickImage}
        className={cx(
          'mt-3 overflow-hidden rounded-field border border-dashed',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-border bg-background',
        )}>
        {hasPreview && isUploading ? (
          <View className="h-[170px] w-full items-center justify-center bg-muted">
            <ActivityIndicator accessibilityLabel={`Uploading ${label}`} color={themeColors.primary} />
          </View>
        ) : imageFailed ? (
          <View className="h-[170px] w-full items-center justify-center px-4">
            <Text accessibilityRole="alert" className="font-sans text-center text-body text-secondary-foreground">Image could not be loaded.</Text>
          </View>
        ) : hasPreview ? (
          <Image
            key={`${value}-${retryCount}`}
            accessibilityLabel={label}
            source={{ uri: value, ...(/^https?:\/\//i.test(value) ? { headers: { 'ngrok-skip-browser-warning': 'true' } } : {}) }}
            onError={() => setFailedValue(value)}
            resizeMethod="resize"
            resizeMode="contain"
            className="h-[170px] w-full bg-muted"
          />
        ) : (
          <View className="min-h-[104px] items-center justify-center px-4 py-4">
            <Upload size={22} color={themeColors.primary} strokeWidth={2} />
            <Text className="font-sans mt-3 text-center text-[14px] font-semibold text-foreground">
              Choose image
            </Text>
          </View>
        )}
      </Pressable>

      {imageFailed ? <Pressable accessibilityRole="button" accessibilityLabel={`Retry loading ${label}`}
        className="min-h-11 justify-center self-start"
        onPress={() => { setFailedValue(null); setRetryCount((count) => count + 1); }}>
        <Text className="font-sans text-caption font-medium text-primary">Try again</Text>
      </Pressable> : null}

      {!disabled ? <View className="mt-3 min-h-[22px] flex-row items-start gap-2">
        {hasPreview ? (
          <FileCheck2 size={15} color={themeColors.success} strokeWidth={2.45} />
        ) : (
          <ImagePlus size={15} color={themeColors.primary} strokeWidth={2.45} />
        )}
        <Text
          className={cx(
            'font-sans',
            'min-w-0 flex-1 text-caption',
            error ? 'text-destructive' : 'text-secondary-foreground',
          )}>
          {error || helperText || 'Use a clear, well-lit image. Maximum file size is 5 MB.'}
        </Text>
        {hasPreview && !disabled ? (
          <Pressable
            accessibilityLabel={`Remove ${label}`}
            accessibilityRole="button"
            onPress={() => onChange('')}
            className="h-11 w-11 items-center justify-center rounded-field border border-destructive-border bg-destructive-surface">
            <Trash2 size={15} color={themeColors.destructive} strokeWidth={2.45} />
          </Pressable>
        ) : null}
      </View> : null}
    </View>
  );
}
