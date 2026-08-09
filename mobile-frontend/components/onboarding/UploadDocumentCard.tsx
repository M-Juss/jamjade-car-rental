import { FileCheck2, ImagePlus, Trash2, Upload } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import {
  pickImageFromDevice,
  type DocumentImagePickError,
} from '@/lib/customer/image-picker';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function UploadDocumentCard({
  disabled = false,
  error,
  helperText,
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
  error?: string;
  disabled?: boolean;
  onPickError?: (error: DocumentImagePickError) => void;
}) {
  const hasPreview = Boolean(value);

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
        'rounded-[24px] border bg-surface p-4 shadow-md shadow-foreground/5',
        error ? 'border-destructive-border' : 'border-border',
        disabled && 'opacity-75',
      )}>
      <View className="flex-row items-start gap-3">
        <View className={cx('h-11 w-11 items-center justify-center rounded-full', hasPreview ? 'bg-success-surface' : 'bg-muted')}>
          {hasPreview ? (
            <FileCheck2 size={20} color="#047857" strokeWidth={2.45} />
          ) : (
            <ImagePlus size={20} color="#346EF6" strokeWidth={2.45} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-black leading-5 text-foreground">
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
          'mt-4 overflow-hidden rounded-[22px] border border-dashed',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-[#BFD1FF] bg-background',
        )}>
        {hasPreview ? (
          <Image source={{ uri: value }} resizeMode="cover" className="h-[170px] w-full bg-[#E9EFFA]" />
        ) : (
          <View className="min-h-[150px] items-center justify-center px-5 py-6">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
              <Upload size={22} color="#346EF6" strokeWidth={2.45} />
            </View>
            <Text className="mt-3 text-center text-[14px] font-black text-foreground">Choose image</Text>
            <Text className="mt-1 text-center text-[11px] font-semibold leading-4 text-muted-foreground">
              Tap here to open your gallery or photos.
            </Text>
          </View>
        )}
      </Pressable>

      <View className="mt-3 min-h-[22px] flex-row items-start gap-2">
        {hasPreview ? <FileCheck2 size={15} color="#047857" strokeWidth={2.45} /> : <ImagePlus size={15} color="#346EF6" strokeWidth={2.45} />}
        <Text className={cx('min-w-0 flex-1 text-[11px] font-bold leading-4', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error || helperText || 'Use a clear, well-lit image. Maximum file size is 5 MB.'}
        </Text>
        {hasPreview && !disabled ? (
          <Pressable
            accessibilityLabel={`Remove ${label}`}
            accessibilityRole="button"
            onPress={() => onChange('')}
            className="h-8 w-8 items-center justify-center rounded-full border border-destructive-border bg-destructive-surface">
            <Trash2 size={15} color="#DC2626" strokeWidth={2.45} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
