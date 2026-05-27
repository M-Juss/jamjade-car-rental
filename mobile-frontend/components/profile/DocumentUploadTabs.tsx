import {
  FileCheck2,
  ImagePlus,
  Trash2,
  Upload,
} from 'lucide-react-native';
import { Image, Pressable, Text, View } from 'react-native';

import { cx, profileColors } from '@/components/profile/ProfileCards';
import { ProfileStatusBadge } from '@/components/profile/ProfileStatusBadge';
import type {
  RenterDocument,
  RenterDocumentId,
} from '@/lib/profile/profile-data';

export function DocumentTypeTabs({
  documents,
  onSelect,
  selectedId,
}: {
  documents: RenterDocument[];
  selectedId: RenterDocumentId;
  onSelect: (documentId: RenterDocumentId) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {documents.map((document) => {
        const isSelected = document.id === selectedId;

        return (
          <Pressable
            key={document.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(document.id)}
            className={cx(
              'min-h-[58px] flex-1 basis-[47%] rounded-[20px] border px-3.5 py-3',
              isSelected ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-white',
            )}>
            <Text
              className={cx('text-[13px] font-black leading-5', isSelected ? 'text-[#346EF6]' : 'text-[#17315F]')}
              numberOfLines={1}>
              {document.shortName}
            </Text>
            <Text className="mt-0.5 text-[10px] font-bold text-[#91A0B8]" numberOfLines={1}>
              {document.status}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DocumentUploadPanel({
  document,
  onRemove,
  onUpload,
}: {
  document: RenterDocument;
  onUpload: () => void;
  onRemove: () => void;
}) {
  const hasImage = Boolean(document.imageUri);

  return (
    <View className="rounded-[28px] border border-[#E6EEFF] bg-white p-5 shadow-md shadow-[#17315F]/5">
      <View className="flex-row items-start gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-[#EEF4FF]">
          {hasImage ? (
            <FileCheck2 size={20} color={profileColors.brand} strokeWidth={2.45} />
          ) : (
            <ImagePlus size={20} color="#64748B" strokeWidth={2.45} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[20px] font-black leading-6 text-[#17315F]">{document.name}</Text>
          <Text className="mt-1 text-[12px] font-semibold leading-5 text-[#6C7A96]">{document.description}</Text>
          <View className="mt-2 self-start">
            <ProfileStatusBadge status={document.status} />
          </View>
        </View>
      </View>

      <View className="mt-5 overflow-hidden rounded-[24px] border border-dashed border-[#BFD1FF] bg-[#F8FAFF]">
        {hasImage ? (
          <Image source={{ uri: document.imageUri }} resizeMode="cover" className="h-[210px] w-full bg-[#E9EFFA]" />
        ) : (
          <View className="min-h-[210px] items-center justify-center px-5 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-white">
              <Upload size={25} color={profileColors.brand} strokeWidth={2.45} />
            </View>
            <Text className="mt-4 text-center text-[16px] font-black text-[#17315F]">Upload document image</Text>
            <Text className="mt-2 text-center text-[12px] font-semibold leading-5 text-[#6C7A96]">
              Store a clear image here while the backend document storage is not connected yet.
            </Text>
          </View>
        )}
      </View>

      {document.updatedAt ? (
        <Text className="mt-3 text-[11px] font-bold text-[#91A0B8]">
          Stored locally {new Date(document.updatedAt).toLocaleString()}
        </Text>
      ) : null}

      <View className="mt-5 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={onUpload}
          className="min-h-[50px] flex-1 flex-row items-center justify-center gap-2 rounded-full bg-[#346EF6] px-4 shadow-md shadow-[#346EF6]/20">
          <Upload size={16} color="#FFFFFF" strokeWidth={2.45} />
          <Text className="text-[13px] font-black text-white">{hasImage ? 'Replace Image' : 'Upload Image'}</Text>
        </Pressable>
        {hasImage ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRemove}
            className="min-h-[50px] w-[54px] items-center justify-center rounded-full border border-[#FECACA] bg-[#FEF2F2]">
            <Trash2 size={17} color="#DC2626" strokeWidth={2.45} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
