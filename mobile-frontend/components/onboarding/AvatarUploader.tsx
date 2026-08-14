import { Camera, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { pickImageFromDevice } from '@/lib/customer/image-picker';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function AvatarUploader({
  error,
  imageUri,
  initials,
  onChange,
}: {
  imageUri: string;
  initials: string;
  onChange: (imageUri: string) => void;
  error?: string;
}) {
  const [pickError, setPickError] = useState('');

  const handlePickImage = async () => {
    const result = await pickImageFromDevice({ allowsEditing: true });

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
      className={cx(
        'rounded-[26px] border bg-surface p-4 shadow-md shadow-foreground/5',
        error ? 'border-destructive-border bg-destructive-surface' : 'border-border',
      )}>
      <View className="flex-row items-center gap-4">
        <View className="h-[82px] w-[82px] items-center justify-center overflow-hidden rounded-[28px] bg-muted">
          {imageUri ? (
            <Image source={{ uri: imageUri }} resizeMode="cover" className="h-full w-full" />
          ) : initials ? (
            <Text className="text-[24px] font-black text-primary">{initials}</Text>
          ) : (
            <UserRound size={30} color="#346EF6" strokeWidth={2.45} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-black text-foreground">Profile picture</Text>
          <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
            Optional. Choose an image that is 5 MB or smaller.
          </Text>
          <View className="mt-3 self-start flex-row items-center gap-2 rounded-full bg-muted px-3 py-2">
            <Camera size={15} color="#346EF6" strokeWidth={2.45} />
            <Text className="text-[12px] font-black text-primary">{imageUri ? 'Change photo' : 'Choose photo'}</Text>
          </View>
        </View>
      </View>
      {pickError ? (
        <Text className="mt-3 text-[11px] font-bold leading-4 text-destructive">
          {pickError}
        </Text>
      ) : null}
      {error ? (
        <Text className="mt-3 text-[11px] font-bold leading-4 text-destructive">
          {error}
        </Text>
      ) : null}
    </Pressable>
  );
}
