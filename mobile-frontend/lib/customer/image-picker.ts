import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export type DocumentImagePickError =
  | 'permission-denied'
  | 'too-large'
  | 'picker-failed';

export type DocumentImagePickResult = {
  uri: string | null;
  error?: DocumentImagePickError;
};

export async function pickImageFromDevice(): Promise<DocumentImagePickResult> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        return { error: 'permission-denied', uri: null };
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (result.canceled) {
      return { uri: null };
    }

    const selectedImage = result.assets[0];

    if (!selectedImage?.uri) {
      return { error: 'picker-failed', uri: null };
    }

    const selectedFileSize = selectedImage.fileSize ?? selectedImage.file?.size;

    if (
      typeof selectedFileSize === 'number' &&
      selectedFileSize > MAX_IMAGE_UPLOAD_BYTES
    ) {
      return { error: 'too-large', uri: null };
    }

    return { uri: selectedImage.uri };
  } catch {
    return { error: 'picker-failed', uri: null };
  }
}
