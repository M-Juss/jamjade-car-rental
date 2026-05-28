import { Camera, UserRound } from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import { pickImageOrMock } from '@/lib/customer/mock-upload';

export function AvatarUploader({
  imageUri,
  initials,
  onChange,
}: {
  imageUri: string;
  initials: string;
  onChange: (imageUri: string) => void;
}) {
  const handlePickImage = async () => {
    const selectedImage = await pickImageOrMock('Profile Photo', 'Mock avatar preview');

    if (selectedImage) {
      onChange(selectedImage);
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
            Optional, but it helps owners recognize you faster.
          </Text>
          <View className="mt-3 self-start flex-row items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-2">
            <Camera size={15} color="#346EF6" strokeWidth={2.45} />
            <Text className="text-[12px] font-black text-[#346EF6]">{imageUri ? 'Change photo' : 'Choose photo'}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
