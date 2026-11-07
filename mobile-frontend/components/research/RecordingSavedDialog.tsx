import { Text, View } from 'react-native';
import { ActionButton } from '@/components/bookings';
import { recordingDisplay } from '@/lib/research/collection';
import type { NativeRecording } from '@/lib/research/native-recorder';
import { ResearchDialog } from './ResearchControls';

export function RecordingSavedDialog({ record, uploaded, busy, progress, error, onUpload, onAnother, onClose }: {
  record: NativeRecording | null; uploaded: boolean; busy: boolean; progress?: string;
  error?: string | null; onUpload: () => void; onAnother: () => void; onClose: () => void;
}) {
  return <ResearchDialog visible={record !== null} title={uploaded ? 'Upload complete' : 'Saved on phone'} onClose={() => { if (!busy) onClose(); }}
    footer={<View className="gap-2">
      {!uploaded && <ActionButton density="compact" label={busy ? progress ?? 'Uploading…' : 'Upload now'} variant="primary" disabled={busy} onPress={onUpload} />}
      <ActionButton density="compact" label="Record another" variant={uploaded ? 'primary' : 'secondary'} disabled={busy} onPress={onAnother} />
      <ActionButton density="compact" label="Stay here" disabled={busy} onPress={onClose} />
    </View>}>
    {record && <Text className="font-sans text-body font-semibold text-foreground">{recordingDisplay(record).title}</Text>}
    <Text className="font-sans text-body text-secondary-foreground">{uploaded
      ? 'Recording and saved observations uploaded and synced. The phone original stays.'
      : 'The recording and observations are saved. Upload sends motion readings, setup checks, phone diagnostics and saved observations to your private Admin inspector. The phone original stays.'}</Text>
    {error && <Text accessibilityRole="alert" className="font-sans text-caption text-destructive">{error}</Text>}
    {busy && <Text accessibilityLiveRegion="polite" className="font-sans text-caption text-primary">{progress ?? 'Uploading…'}</Text>}
  </ResearchDialog>;
}
