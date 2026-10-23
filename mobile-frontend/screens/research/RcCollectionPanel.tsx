import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/bookings';
import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { floatingTabBarContentPadding, mobileLayout } from '@/constants/layout';
import { themeColors } from '@/constants/theme';
import { RcSessionSetupForm } from '@/forms/research/RcSessionSetupForm';
import { RcTrialReviewForm } from '@/forms/research/RcTrialReviewForm';
import { FormToast, useFormToast } from '@/forms/shared/FormToast';
import { useRcResearchCollection } from '@/hooks/research/useRcResearchCollection';

import { RcReadingSummary, RcRecordingDataCard } from './RcReadingSummary';
import { RcSessionSummary } from './RcSessionSummary';

export function RcCollectionPanel({ active, onSaved, onBusyChange, onUnsavedChange }: {
  active: boolean; onSaved: () => void; onBusyChange: (busy: boolean) => void; onUnsavedChange: (unsaved: boolean) => void;
}) {
  const flow = useRcResearchCollection(active, onSaved);
  const toast = useFormToast();
  const insets = useSafeAreaInsets();
  const [actionHeight, setActionHeight] = useState(0);
  useEffect(() => { onBusyChange(flow.busy !== null); }, [flow.busy, onBusyChange]);
  useEffect(() => { onUnsavedChange(flow.capture !== null); }, [flow.capture, onUnsavedChange]);
  const summary = flow.capture?.summary ?? flow.live?.summary;
  const title = flow.stage === 'setup' ? 'Session setup' : flow.stage === 'recording' ? 'Recording' : 'Trial review';

  return <View className="flex-1">
    <View className="w-full max-w-[640px] flex-row items-center gap-2 self-center px-screen pb-3">
      {flow.stage !== 'setup' ? <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={flow.busy === 'creating' || flow.busy === 'saving'}
        onPress={flow.back} className="min-h-control min-w-control items-center justify-center rounded-full active:bg-muted disabled:opacity-50">
        <ArrowLeft size={22} color={themeColors.foreground} />
      </Pressable> : null}
      <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">{title}</Text>
      <Text className="font-sans text-caption text-secondary-foreground">{flow.stage === 'setup' ? '1 / 3' : flow.stage === 'recording' ? '2 / 3' : '3 / 3'}</Text>
    </View>
    <KeyboardFormScrollView scrollResetKey={flow.stage} contentInsetAdjustmentBehavior="never" contentContainerClassName="w-full max-w-[640px] self-center px-screen pt-1"
      contentContainerStyle={{ paddingBottom: floatingTabBarContentPadding + insets.bottom + (flow.stage === 'recording' ? actionHeight : 0) }}>
      <View style={{ display: flow.stage === 'setup' ? 'flex' : 'none' }}>
        <RcSessionSetupForm onCreate={flow.create} hasSession={flow.session !== null} onFeedback={toast.showToast} />
      </View>
      {flow.session && flow.setup ? <View className="gap-4" style={{ display: flow.stage === 'setup' ? 'none' : 'flex' }}>
        <RcSessionSummary session={flow.session} movement={flow.setup.movement} intensity={flow.setup.intensity} />
        {flow.stage === 'recording' ? <>
          <View className="rounded-card border border-border bg-surface p-card">
            <View className="flex-row items-center justify-between gap-3">
              <Text accessibilityLiveRegion="polite" className="font-sans min-w-0 flex-1 text-body font-semibold text-foreground">
                {flow.live?.phase === 'preparing' ? 'Preparing sensors…' : flow.busy === 'reading' ? 'Reading motion' : flow.capture ? 'Recording complete' : 'Ready to record'}
              </Text>
              {flow.busy === 'reading' ? <ActivityIndicator color={themeColors.primary} /> : null}
            </View>
            <Text className="font-sans mt-2 text-caption text-secondary-foreground">{((summary?.duration_ms ?? 0) / 1000).toFixed(1)} s elapsed</Text>
            {(flow.live?.capacity_used ?? 0) >= 0.8 ? <Text accessibilityRole="alert" className="font-sans mt-2 text-caption text-warning">Recording capacity is nearly full. Stop reading to keep this trial.</Text> : null}
          </View>
          <RcReadingSummary summary={summary} sample={flow.live?.sample} />
          {flow.error ? <Text accessibilityRole="alert" className="font-sans text-body text-destructive">{flow.error}</Text> : null}
          {flow.capture && flow.busy !== 'reading' ? <ActionButton label="Record again" onPress={() => void flow.start()} /> : null}
        </> : null}
        {flow.stage === 'review' && flow.capture ? <RcRecordingDataCard summary={flow.capture.summary} /> : null}
        {flow.capture ? <View style={{ display: flow.stage === 'review' ? 'flex' : 'none' }}>
          <Text className="font-sans mb-3 text-caption text-secondary-foreground">Keep the app open until this trial is saved.</Text>
          <RcTrialReviewForm key={flow.capture.client_trial_id} capture={flow.capture} intended={flow.setup} onSave={flow.save} onFeedback={toast.showToast} />
        </View> : null}
      </View> : null}
    </KeyboardFormScrollView>
    {flow.stage === 'recording' ? <View onLayout={event => setActionHeight(event.nativeEvent.layout.height)}
      className="absolute left-0 right-0 border-t border-border bg-background"
      style={{ bottom: mobileLayout.tabBarHeight + mobileLayout.tabBarLift + mobileLayout.floatingGap + insets.bottom }}>
      <View className="w-full max-w-[640px] self-center px-screen py-3">
        {flow.busy === 'reading' ? <ActionButton label="Stop reading" variant="primary" onPress={flow.stop} />
          : flow.capture ? <ActionButton label="Review" variant="primary" onPress={flow.review} />
            : <ActionButton label="Start reading" variant="primary" onPress={() => void flow.start()} />}
      </View>
    </View> : null}
    <FormToast message={toast.message} title={toast.title} variant={toast.variant} onDismiss={toast.clearToast} safeAreaTopHandled />
  </View>;
}
