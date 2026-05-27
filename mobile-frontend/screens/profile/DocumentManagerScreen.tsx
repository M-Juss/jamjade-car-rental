import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Clock3,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DocumentTypeTabs,
  DocumentUploadPanel,
} from '@/components/profile';
import {
  removeRenterDocumentImage,
  storeRenterDocumentImage,
  useRenterDocuments,
} from '@/lib/profile/document-store';
import type {
  RenterDocument,
  RenterDocumentId,
} from '@/lib/profile/profile-data';

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

function createMockDocumentImage(document: RenterDocument) {
  const label = document.shortName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
      <rect width="900" height="560" rx="42" fill="#EEF4FF"/>
      <rect x="54" y="60" width="792" height="440" rx="32" fill="#FFFFFF"/>
      <text x="450" y="270" text-anchor="middle" font-family="Arial" font-size="54" font-weight="800" fill="#17315F">${label}</text>
      <text x="450" y="330" text-anchor="middle" font-family="Arial" font-size="26" font-weight="700" fill="#346EF6">Stored image preview</text>
    </svg>`,
  );

  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

async function selectDocumentImage(document: RenterDocument) {
  if (Platform.OS === 'web') {
    return pickImageFromWeb();
  }

  return createMockDocumentImage(document);
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
    <View className="min-h-[82px] flex-1 rounded-[20px] border border-[#E6EEFF] bg-white p-3.5">
      <View className={`${iconBgClassName} h-9 w-9 items-center justify-center rounded-full`}>
        <Icon size={18} color={iconColor} strokeWidth={2.45} />
      </View>
      <Text className="mt-2 text-[20px] font-black text-[#17315F]">{value}</Text>
      <Text className="mt-0.5 text-[10px] font-black uppercase text-[#91A0B8]">{label}</Text>
    </View>
  );
}

export function DocumentManagerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const renterDocuments = useRenterDocuments();
  const [selectedDocumentId, setSelectedDocumentId] = useState<RenterDocumentId>(renterDocuments[0]?.id ?? 'drivers-license');
  const selectedDocument = renterDocuments.find((document) => document.id === selectedDocumentId) ?? renterDocuments[0];

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

    const imageUri = await selectDocumentImage(selectedDocument);
    if (!imageUri) {
      return;
    }

    storeRenterDocumentImage(selectedDocument.id, imageUri);
  };

  return (
    <View className="flex-1 bg-[#F8FAFF]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never">
        <View className="px-5" style={{ paddingBottom: 34 + insets.bottom, paddingTop: insets.top + 10 }}>
          <View className="relative min-h-[48px] flex-row items-center justify-center border-b border-[#E6EEFF] pb-4">
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              className="absolute left-0 h-12 w-12 items-center justify-center rounded-full border border-[#E6EEFF] bg-white">
              <ArrowLeft size={21} color="#17315F" strokeWidth={2.45} />
            </Pressable>
            <Text className="px-16 text-center text-[22px] font-black leading-[27px] text-[#17315F]" numberOfLines={1}>
              Manage Document
            </Text>
          </View>

          <View className="mt-6 flex-row gap-2.5">
            <DocumentSummaryPill
              icon={CheckCircle2}
              iconBgClassName="bg-[#ECFDF5]"
              iconColor="#047857"
              label="Verified"
              value={summary.verified}
            />
            <DocumentSummaryPill
              icon={Clock3}
              iconBgClassName="bg-[#FFF7ED]"
              iconColor="#C2410C"
              label="Pending"
              value={summary.pending}
            />
            <DocumentSummaryPill
              icon={CircleDashed}
              iconBgClassName="bg-[#F1F5F9]"
              iconColor="#64748B"
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
