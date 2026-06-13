import { Camera, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { pickImageFromDevice } from '@/lib/customer/image-picker';

export function AvatarUploader({
  imageUri,
  initials,
  onChange,
}: {
  imageUri: string;
  initials: string;
  onChange: (imageUri: string) => void;
}) {
  const [pickError, setPickError] = useState('');

  const handlePickImage = async () => {
    const result = await pickImageFromDevice();

    if (result.error === 'too-large') {
      setPickError('The selected image is larger than the 5 MB limit.');
      return;
    }

    if (result.error === 'permission-denied') {
      setPickError('Allow photo access to choose a profile picture.');
      return;
    }

    if (result.error) {
      setPickError('Unable to open your gallery. Please try again.');
      return;
    }

    if (result.uri) {
      setPickError('');
      onChange(result.uri);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePickImage}
      className="rounded-[26px] border border-[#E6EEFF] bg-white p-4 shadow-md shadow-[#17315F]/5">
      <View className="flex-row items-center gap-4">
        <View className="h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[28px] bg-[#EEF4FF]">
          {imageUri ? (
            <Image source={{ uri: imageUri }} resizeMode="cover" className="h-full w-full" />
          ) : initials ? (
            <Text className="text-[24px] font-black text-[#346EF6]">{initials}</Text>
          ) : (
            <UserRound size={30} color="#346EF6" strokeWidth={2.45} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-[#17315F]">Profile picture</Text>
          <Text className="mt-1 text-[12px] font-semibold leading-5 text-[#6C7A96]">
            Optional. Choose an image that is 5 MB or smaller.
          </Text>
          <View className="mt-3 self-start flex-row items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-2">
            <Camera size={15} color="#346EF6" strokeWidth={2.45} />
            <Text className="text-[12px] font-black text-[#346EF6]">{imageUri ? 'Change photo' : 'Choose photo'}</Text>
          </View>
        </View>
      </View>
      {pickError ? (
        <Text className="mt-3 text-[11px] font-bold leading-4 text-[#D92D20]">
          {pickError}
        </Text>
      ) : null}
    </Pressable>
  );
}
