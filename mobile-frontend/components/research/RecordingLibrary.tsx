import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { SelectWithLabel } from '@/components/common/SelectWithLabel';
import { recordingDisplay, recordingTitle, type CollectionStatus } from '@/lib/research/collection';
import type { NativeRecording } from '@/lib/research/native-recorder';
import { recordingLibraryStatus } from '@/lib/research/library';
import { formatRentalDate } from '@/lib/telematics/rental-card';
import { ResearchIconButton } from './ResearchControls';
import { RecordingMetadata } from './RecordingMetadata';

export function RecordingLibrary({ records, total, offset, filter, statuses, busy, blocked, progress, onFilter, onPage, onOpen, onUpload, onDelete }: {
  records: NativeRecording[]; total: number; offset: number; filter: 'all' | 'current' | 'pilot'; statuses: Record<string, CollectionStatus>;
  busy: boolean; blocked: boolean; progress: { id: string; label: string } | null;
  onFilter: (value: 'all' | 'current' | 'pilot') => void; onPage: (offset: number) => void; onOpen: (record: NativeRecording) => void;
  onUpload: (record: NativeRecording) => void; onDelete: (record: NativeRecording) => void;
}) {
  return <View className="gap-3">
    <SelectWithLabel label="Collection" hideLabel value={filter} onValueChange={v => onFilter(v as typeof filter)} disabled={busy}
      options={[{ value: 'all', label: 'All recordings' }, { value: 'current', label: 'Current collection' }, { value: 'pilot', label: 'Pilot history' }]} />
    {!records.length && <Text className="font-sans py-3 text-body text-secondary-foreground">No recordings.</Text>}
    {records.map(record => {
      const status = recordingLibraryStatus(record, statuses[record.recording_id]);
      return <View key={record.recording_id} className="gap-2 rounded-lg border border-border bg-surface p-3">
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${recordingTitle(record)}`} disabled={busy || blocked} onPress={() => onOpen(record)} className="gap-1">
        <Text className="font-sans text-body font-semibold text-primary">{recordingDisplay(record).title}</Text>
        <RecordingMetadata recording={record} />
        <View className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <Text className="font-sans shrink text-caption text-secondary-foreground">{record.started_at_utc ? formatRentalDate(record.started_at_utc) : 'Time unavailable'}</Text>
          <Text className="font-sans text-caption text-secondary-foreground">{((record.duration_ms ?? 0) / 1000).toFixed(1)} s</Text>
        </View>
        <Text className="font-sans text-caption font-medium text-foreground">{status.label}</Text>
        {status.note ? <Text className="font-sans text-caption text-secondary-foreground">{status.note}</Text> : null}
      </Pressable>
      <View className="flex-row items-center gap-2">
        <View className="flex-[3]"><ActionButton density="compact" label={progress?.id === record.recording_id ? progress.label : record.transfer_state === 'uploaded' ? 'Sync & verify' : record.transfer_state === 'upload_failed' ? 'Retry upload' : 'Upload'}
          disabled={busy || blocked || !['stopped', 'interrupted'].includes(record.state)} onPress={() => onUpload(record)} /></View>
        <View className="flex-1"><ResearchIconButton icon={Trash2} label={`Delete phone copy of ${recordingTitle(record)}`} destructive disabled={busy || blocked} onPress={() => onDelete(record)} /></View>
      </View>
    </View>; })}
    {total > 10 && <View accessibilityRole="summary" className="flex-row items-center justify-between py-1">
      <Text className="font-sans text-caption text-secondary-foreground">{total} recordings</Text>
      <View className="flex-row items-center gap-2">
        <ResearchIconButton icon={ChevronLeft} label="Previous page" disabled={busy || offset === 0} onPress={() => onPage(Math.max(0, offset - 10))} />
        <Text accessibilityLiveRegion="polite" className="font-sans text-caption text-foreground">{Math.floor(offset / 10) + 1} / {Math.ceil(total / 10)}</Text>
        <ResearchIconButton icon={ChevronRight} label="Next page" disabled={busy || offset + 10 >= total} onPress={() => onPage(offset + 10)} />
      </View>
    </View>}
  </View>;
}
