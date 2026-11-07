import { MetadataList } from '@/components/common/MetadataList';
import { recordingDisplay } from '@/lib/research/collection';
import type { NativeRecording } from '@/lib/research/native-recorder';
import { View } from 'react-native';

export function RecordingMetadata({ recording, className }: { recording: Pick<NativeRecording, 'context' | 'collection'>; className?: string }) {
  const { metadata } = recordingDisplay(recording);
  return metadata.length ? <View className={className}><MetadataList items={metadata} /></View> : null;
}
