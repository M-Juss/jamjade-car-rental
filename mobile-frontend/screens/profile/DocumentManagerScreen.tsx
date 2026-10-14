import { themeColors } from '@/constants/theme';
import { LogoutHeaderButton } from '@/components/auth/LogoutHeaderButton';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, type LucideIcon } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentTypeTabs, DocumentUploadPanel } from '@/components/profile';
import {
  removeRenterDocumentImage,
  storeRenterDocumentImage,
  useRenterDocuments,
} from '@/lib/profile/document-store';
import { pickImageFromDevice } from '@/lib/customer/image-picker';
import type { RenterDocument, RenterDocumentId } from '@/lib/profile/profile-data';

type WebFileInput = {
  accept: string;
  click: () => void;
  files?: { [index: number]: Blob | undefined; length: number } | null;
  onchange: (() => void) | null;
  type: string;
};

type WebDocument = {
  createElement: (tagName: 'input') => WebFileInput;
};

type WebFileReader = {
  onerror: (() => void) | null;
  onload: (() => void) | null;
  readAsDataURL: (file: unknown) => void;
  result: ArrayBuffer | string | null;
};

type WebFileReaderConstructor = new () => WebFileReader;

function pickImageFromWeb() {
  const webGlobals = globalThis as typeof globalThis & {
    document?: WebDocument;
    FileReader?: WebFileReaderConstructor;
  };

  if (!webGlobals.document || !webGlobals.FileReader) {
    return Promise.resolve<string | null>(null);
  }

  return new Promise<string | null>((resolve) => {
    const input = webGlobals.document?.createElement('input');
    const FileReaderConstructor = webGlobals.FileReader;

    if (!input || !FileReaderConstructor) {
      resolve(null);
      return;
    }

    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const selectedFile = input.files?.[0];

      if (!selectedFile) {
        resolve(null);
        return;
      }

      const reader = new FileReaderConstructor();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(selectedFile);
    };
    input.click();
  });
}

async function selectDocumentImage() {
  if (Platform.OS === 'web') {
    return pickImageFromWeb();
  }

  const result = await pickImageFromDevice();

  return result.uri;
}

function DocumentSummaryPill({
  iconBgClassName,
  iconColor,
  icon: Icon,
  label,
  value,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  iconBgClassName: string;
  iconColor: string;
}) {
  return (
    <View className="min-h-[82px] flex-1 rounded-[20px] border border-border bg-surface p-3.5">
      <View className={`${iconBgClassName} h-9 w-9 items-center justify-center rounded-full`}>
        <Icon size={18} color={iconColor} strokeWidth={2.45} />
      </View>
      <Text className="font-sans mt-2 text-[20px] font-semibold text-foreground">{value}</Text>
      <Text className="font-sans mt-0.5 text-[11px] font-normal text-secondary-foreground">{label}</Text>
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
          <View className="min-h-[48px] flex-row items-center gap-2 border-b border-border pb-4">
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              className="h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
              <ArrowLeft size={21} color={themeColors.foreground} strokeWidth={2.45} />
            </Pressable>
            <Text
              className="font-sans min-w-0 flex-1 text-center text-[22px] font-semibold leading-[27px] text-foreground"
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              numberOfLines={1}>
              Manage Document
            </Text>
            <LogoutHeaderButton />
          </View>

          <View className="mt-6 flex-row gap-2.5">
            <DocumentSummaryPill
              icon={CheckCircle2}
              iconBgClassName="bg-success-surface"
              iconColor={themeColors.success}
              label="Verified"
              value={summary.verified}
            />
            <DocumentSummaryPill
              icon={Clock3}
              iconBgClassName="bg-warning-surface"
              iconColor={themeColors.warning}
              label="Pending"
              value={summary.pending}
            />
            <DocumentSummaryPill
              icon={CircleDashed}
              iconBgClassName="bg-muted"
              iconColor={themeColors.mutedForeground}
              label="Missing"
              value={summary.missing}
            />
          </View>

          <View className="mt-5">
            <DocumentTypeTabs
              documents={renterDocuments}
              selectedId={selectedDocumentId}
              onSelect={setSelectedDocumentId}
            />
          </View>

          {selectedDocument ? (
            <View className="mt-5">
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
