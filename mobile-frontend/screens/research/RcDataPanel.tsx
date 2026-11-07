import { ArrowLeft, ChevronRight, Database, RefreshCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { floatingTabBarContentPadding } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { movementLabel, type RcResearchTrial } from '@/lib/research/rc-research';
import { formatRentalDate } from '@/lib/telematics/rental-card';
import { deleteRcResearchTrial, listRcResearchTrials } from '@/services/api/rc-research-records.service';

import { RcReadingSummary } from './RcReadingSummary';
import { RcSessionSummary } from './RcSessionSummary';

export function RcDataPanel({ active, revision }: { active: boolean; revision: number }) {
  const [trials, setTrials] = useState<RcResearchTrial[]>([]);
  const [selected, setSelected] = useState<RcResearchTrial | null>(null);
  const [page, setPage] = useState(1), [lastPage, setLastPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [deleting, setDeleting] = useState(false);
  const insets = useSafeAreaInsets(), toast = useFormToast();
  useEffect(() => {
    if (!active || !selected) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!deleting) setSelected(null);
      return true;
    });
    return () => subscription.remove();
  }, [active, deleting, selected]);
  useEffect(() => {
    if (!active) return;
    let current = true;
    setLoading(true); setError(false); setSelected(null);
    void listRcResearchTrials(page).then(result => {
      if (current) { setTrials(result.trials); setLastPage(result.lastPage); }
    }).catch(() => { if (current) { setError(true); setTrials([]); } }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [active, page, refresh, revision]);
  const remove = async (trial: RcResearchTrial) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteRcResearchTrial(trial.id); setSelected(null); setPage(1); setRefresh(value => value + 1);
      toast.showToast('Trial deleted.', 'success');
    } catch { toast.showToast('The trial could not be completely deleted. Try again.'); }
    finally { setDeleting(false); }
  };
  return <View className="flex-1">
    <View className="w-full max-w-[640px] flex-row items-center gap-2 self-center px-screen pb-3">
      {selected ? <Pressable accessibilityRole="button" accessibilityLabel="Back to research data" disabled={deleting} onPress={() => setSelected(null)} className="min-h-control min-w-control items-center justify-center rounded-full active:bg-muted">
        <ArrowLeft size={22} color={themeColors.foreground} /></Pressable> : null}
      <Text accessibilityRole="header" className="font-sans flex-1 text-section font-semibold text-foreground">{selected ? 'Trial details' : 'Uploaded trials (v1)'}</Text>
      {!selected ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh research data" disabled={loading} onPress={() => setRefresh(value => value + 1)}
        className="min-h-control min-w-control items-center justify-center"><RefreshCcw size={20} color={themeColors.primary} /></Pressable> : null}
    </View>
    <KeyboardFormScrollView scrollResetKey={selected?.id ?? String(page)} contentInsetAdjustmentBehavior="never" contentContainerClassName="w-full max-w-[640px] self-center px-screen pt-1"
      contentContainerStyle={{ paddingBottom: floatingTabBarContentPadding + insets.bottom }}>
      {loading ? <ActivityIndicator accessibilityLabel="Loading research trials" color={themeColors.primary} className="my-6" /> : error ? <SectionCard title="Data unavailable" icon={Database}>
        <Text accessibilityRole="alert" className="font-sans mb-4 text-body text-secondary-foreground">Research data could not be loaded.</Text>
        <ActionButton label="Retry" onPress={() => setRefresh(value => value + 1)} />
      </SectionCard> : selected ? <View className="gap-4">
        <RcSessionSummary session={selected.session} movement={selected.intended_movement} intensity={selected.intended_intensity} />
        <View className="rounded-card border border-border bg-surface p-card">
          <InfoRow label="Observed movement" value={movementLabel(selected.observed_movement, selected.observed_intensity)} />
          <InfoRow label="Label" value={selected.label_status} /><InfoRow label="Quality" value={selected.quality.replace('_', ' ')} />
          <InfoRow label="Event interval" value={`${selected.event_start_ms}–${selected.event_end_ms} ms`} />
          <InfoRow label="Saved" value={formatRentalDate(selected.created_at)} />
          {selected.notes ? <InfoRow label="Notes" value={selected.notes} /> : null}
        </View>
        <RcReadingSummary summary={selected.summary} />
        <ActionButton label={deleting ? 'Deleting trial…' : 'Delete trial'} variant="danger" disabled={deleting} onPress={() => Alert.alert('Delete trial?', 'This permanently deletes the recording and removes it from research data.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void remove(selected) }])} />
      </View> : trials.length === 0 ? <SectionCard title="No saved trials" icon={Database}>
        <Text className="font-sans text-body text-secondary-foreground">Saved recordings will appear here.</Text>
      </SectionCard> : <View className="gap-3">
        {trials.map(trial => <Pressable key={trial.id} accessibilityRole="button" accessibilityLabel={`View ${trial.session.name}, ${movementLabel(trial.observed_movement, trial.observed_intensity)}`}
          onPress={() => setSelected(trial)} className="flex-row items-center gap-3 rounded-card border border-border bg-surface p-card active:bg-muted">
          <View className="min-w-0 flex-1 gap-1"><Text className="font-sans text-section font-semibold text-foreground">{trial.session.name}</Text>
            <Text className="font-sans text-body text-secondary-foreground">{movementLabel(trial.observed_movement, trial.observed_intensity)}</Text>
            <View className="flex-row flex-wrap justify-between gap-x-4 gap-y-1"><Text className="font-sans shrink text-caption text-secondary-foreground">{formatRentalDate(trial.created_at)}</Text><Text className="font-sans text-caption text-secondary-foreground">{(trial.summary.duration_ms / 1000).toFixed(1)} s</Text></View>
          </View><ChevronRight size={20} color={themeColors.primary} />
        </Pressable>)}
        {lastPage > 1 ? <View className="gap-3">
          <Text className="font-sans text-center text-caption text-secondary-foreground">Page {page} of {lastPage}</Text>
          <View className="flex-row gap-3"><ActionButton label="Previous" disabled={page <= 1} className="flex-1" onPress={() => setPage(value => value - 1)} />
            <ActionButton label="Next" disabled={page >= lastPage} className="flex-1" onPress={() => setPage(value => value + 1)} /></View>
        </View> : null}
      </View>}
    </KeyboardFormScrollView>
    <FormToast message={toast.message} title={toast.title} variant={toast.variant} onDismiss={toast.clearToast} safeAreaTopHandled />
  </View>;
}
