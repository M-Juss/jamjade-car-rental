import { FileCheck2, ImagePlus, Trash2, Upload } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import { pickImageOrMock } from '@/lib/customer/mock-upload';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function UploadDocumentCard({
  error,
  helperText,
  label,
  onChange,
  required = false,
  value,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  helperText?: string;
  error?: string;
}) {
  const hasPreview = Boolean(value);

  const handlePickImage = async () => {
    const selectedImage = await pickImageOrMock(label);

    if (selectedImage) {
      onChange(selectedImage);
    }
  };

  return (
    <View className={cx('rounded-[24px] border bg-white p-4 shadow-md shadow-[#17315F]/5', error ? 'border-[#F4A6A6]' : 'border-[#E6EEFF]')}>
      <View className="flex-row items-start gap-3">
        <View className={cx('h-11 w-11 items-center justify-center rounded-full', hasPreview ? 'bg-[#ECFDF5]' : 'bg-[#EEF4FF]')}>
          {hasPreview ? (
            <FileCheck2 size={20} color="#047857" strokeWidth={2.45} />
          ) : (
            <ImagePlus size={20} color="#346EF6" strokeWidth={2.45} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-black leading-5 text-[#17315F]">
            {label}
            {required ? <Text className="text-[#E5484D]"> *</Text> : null}
          </Text>
          {helperText ? <Text className="mt-1 text-[12px] font-semibold leading-5 text-[#6C7A96]">{helperText}</Text> : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={handlePickImage}
        className={cx(
          'mt-4 overflow-hidden rounded-[22px] border border-dashed',
          error ? 'border-[#F4A6A6] bg-[#FFF8F8]' : 'border-[#BFD1FF] bg-[#F8FAFF]',
        )}>
        {hasPreview ? (
          <Image source={{ uri: value }} resizeMode="cover" className="h-[170px] w-full bg-[#E9EFFA]" />
        ) : (
          <View className="min-h-[150px] items-center justify-center px-5 py-6">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-white">
              <Upload size={22} color="#346EF6" strokeWidth={2.45} />
            </View>
            <Text className="mt-3 text-center text-[14px] font-black text-[#17315F]">Upload image</Text>
            <Text className="mt-1 text-center text-[11px] font-semibold leading-4 text-[#6C7A96]">
              A preview appears here after upload.
            </Text>
          </View>
        )}
      </Pressable>

      {error ? <Text className="mt-2 px-1 text-[11px] font-bold leading-4 text-[#D92D20]">{error}</Text> : null}

      <View className="mt-4 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={handlePickImage}
          className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-full bg-[#346EF6] px-4">
          <Upload size={16} color="#FFFFFF" strokeWidth={2.45} />
          <Text className="text-[13px] font-black text-white">{hasPreview ? 'Replace' : 'Upload'}</Text>
        </Pressable>
        {hasPreview ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onChange('')}
            className="min-h-[48px] w-[52px] items-center justify-center rounded-full border border-[#FECACA] bg-[#FEF2F2]">
            <Trash2 size={17} color="#DC2626" strokeWidth={2.45} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
