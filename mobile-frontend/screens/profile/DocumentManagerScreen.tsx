import { themeColors } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentTypeTabs, DocumentUploadPanel } from '@/components/profile';
import {
  removeRenterDocumentImage,
  storeRenterDocumentImage,
  useRenterDocuments,
} from '@/lib/profile/document-store';
import { pickImageFromDevice } from '@/lib/customer/image-picker';
import type { RenterDocument, RenterDocumentId } from '@/lib/profile/profile-data';

async function selectDocumentImage() {
  const result = await pickImageFromDevice();

  return result.uri;
}

function DocumentSummaryPill({
  iconColor,
  icon: Icon,
  label,
  value,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
}) {
  return (
    <View className="min-w-[80px] flex-1 gap-1">
      <View className="flex-row items-center gap-1.5">
        <Icon size={15} color={iconColor} strokeWidth={2} />
        <Text className="font-sans min-w-0 flex-1 text-caption text-secondary-foreground">{label}</Text>
      </View>
      <Text className="font-sans text-section font-semibold text-foreground">{value}</Text>
    </View>
  );
}

export function DocumentManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const renterDocuments = useRenterDocuments();
  const [selectedDocumentId, setSelectedDocumentId] = useState<RenterDocumentId>(
    renterDocuments[0]?.id ?? 'drivers-license',
  );
  const selectedDocument =
    renterDocuments.find((document) => document.id === selectedDocumentId) ?? renterDocuments[0];

  const summary = useMemo(
    () => ({
      verified: renterDocuments.filter((document) => document.status === 'Verified').length,
      pending: renterDocuments.filter((document) => document.status === 'Pending').length,
      missing: renterDocuments.filter((document) => document.status === 'Not Uploaded').length,
    }),
    [renterDocuments],
  );

  const handleUpload = async () => {
    if (!selectedDocument) {
      return;
    }

    const imageUri = await selectDocumentImage();
    if (!imageUri) {
      return;
    }

    storeRenterDocumentImage(selectedDocument.id, imageUri);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never">
        <View
          className="w-full max-w-[560px] self-center px-screen"
          style={{ paddingBottom: 34 + insets.bottom, paddingTop: insets.top + 10 }}>
          <View className="min-h-control flex-row items-center gap-2 border-b border-border pb-4">
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-11 w-11 shrink-0 items-center justify-center rounded-field border border-border bg-surface">
              <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2} />
            </Pressable>
            <Text
              className="font-sans min-w-0 flex-1 text-center text-[22px] font-semibold leading-[27px] text-foreground"
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              numberOfLines={1}>
              Documents
            </Text>
          </View>

          <View className="mt-section flex-row flex-wrap gap-3 rounded-card border border-border bg-surface p-card">
            <DocumentSummaryPill
              icon={CheckCircle2}
              iconColor={themeColors.success}
              label="Verified"
              value={summary.verified}
            />
            <DocumentSummaryPill
              icon={Clock3}
              iconColor={themeColors.warning}
              label="Pending"
              value={summary.pending}
            />
            <DocumentSummaryPill
              icon={CircleDashed}
              iconColor={themeColors.mutedForeground}
              label="Missing"
              value={summary.missing}
            />
          </View>

          <View className="mt-section">
            <DocumentTypeTabs
              documents={renterDocuments}
              selectedId={selectedDocumentId}
              onSelect={setSelectedDocumentId}
            />
          </View>

          {selectedDocument ? (
            <View className="mt-section">
              <DocumentUploadPanel
                document={selectedDocument}
                onRemove={() => removeRenterDocumentImage(selectedDocument.id)}
                onUpload={handleUpload}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
