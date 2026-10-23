import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard } from 'react-native';

import type { RcCaptureResult, RcLiveReading, RcResearchSession } from '@/lib/research/rc-research';
import { checkRcResearchAccess } from '@/services/api/rc-research.service';
import { createRcResearchSession, saveRcResearchTrial } from '@/services/api/rc-research-records.service';
import { captureRcResearch, RcResearchCaptureError } from '@/services/telematics/rc-research-capture';
import type { RcSessionSetupInput, RcTrialReviewInput } from '@/validation/research/rc-research';

export type RcCollectionStage = 'setup' | 'recording' | 'review';
const confirmDiscard = () => new Promise<boolean>(resolve => Alert.alert('Discard recording?', 'The current unsaved recording will be discarded.',
  [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Discard', style: 'destructive', onPress: () => resolve(true) }],
  { cancelable: true, onDismiss: () => resolve(false) }));

export function useRcResearchCollection(active: boolean, onSaved: () => void) {
  const [stage, setStage] = useState<RcCollectionStage>('setup');
  const [session, setSession] = useState<RcResearchSession | null>(null);
  const [setup, setSetup] = useState<RcSessionSetupInput | null>(null);
  const [capture, setCapture] = useState<RcCaptureResult | null>(null);
  const [live, setLive] = useState<RcLiveReading | null>(null);
  const [busy, setBusy] = useState<'creating' | 'reading' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllers = useRef<{ cancel: AbortController; stop: AbortController } | null>(null);
  const working = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controllers.current?.cancel.abort(); }; }, []);
  useEffect(() => { if (!active) controllers.current?.cancel.abort(); }, [active]);

  const back = useCallback(() => {
    if (controllers.current) {
      Alert.alert('Stop recording?', 'Stop reading and return to session setup?', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Stop and go back', onPress: () => { controllers.current?.cancel.abort(); setStage('setup'); } },
      ]);
      return;
    }
    if (working.current) return;
    Keyboard.dismiss(); setError(null);
    setStage(current => current === 'review' ? 'recording' : 'setup');
  }, []);
  useEffect(() => {
    if (!active || stage === 'setup') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [active, back, stage]);

  const create = async (values: RcSessionSetupInput) => {
    if (working.current) return false;
    if (capture && !await confirmDiscard()) return false;
    working.current = true; setBusy('creating'); setError(null);
    try {
      // A movement-only edit can reuse the same physical test session.
      const metadata = ({ movement: _movement, intensity: _intensity, consent: _consent, ...details }: RcSessionSetupInput) => JSON.stringify(details);
      const next = session && setup && metadata(setup) === metadata(values) ? session : await createRcResearchSession(values);
      if (!mounted.current) return false;
      Keyboard.dismiss(); setSession(next); setSetup(values); setCapture(null); setLive(null); setStage('recording');
      return true;
    } finally { working.current = false; if (mounted.current) setBusy(null); }
  };
  const start = async () => {
    if (!active || !session || working.current) return;
    if (capture && !await confirmDiscard()) return;
    working.current = true; setBusy('reading'); setError(null); setCapture(null); setLive({ phase: 'preparing' });
    const current = { cancel: new AbortController(), stop: new AbortController() };
    controllers.current = current;
    try {
      await checkRcResearchAccess();
      const result = await captureRcResearch(session.protocol, current.cancel.signal, current.stop.signal,
        reading => { if (mounted.current && !current.cancel.signal.aborted) setLive(reading); });
      if (mounted.current && !current.cancel.signal.aborted) { setCapture(result); setLive(null); }
    } catch (failure) {
      if (mounted.current) { setLive(null); setError(failure instanceof RcResearchCaptureError
        ? failure.message : 'Recording could not be completed. Try again.'); }
    } finally { controllers.current = null; working.current = false; if (mounted.current) setBusy(null); }
  };
  const save = async (review: RcTrialReviewInput) => {
    if (!session || !setup || !capture || working.current) return false;
    working.current = true; setBusy('saving');
    try {
      const result = await saveRcResearchTrial(session, setup, capture, review);
      if (mounted.current) { setCapture(null); setLive(null); setError(null); setStage('setup'); onSaved(); return true; }
      return false;
    } finally { working.current = false; if (mounted.current) setBusy(null); }
  };
  return { stage, session, setup, capture, live, busy, error, create, start, save, back,
    stop: () => controllers.current?.stop.abort(), review: () => { if (capture) setStage('review'); } };
}
