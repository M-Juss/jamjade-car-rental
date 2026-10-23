import { useCallback, useEffect, useMemo, useState } from 'react';

import { hasCalibrationConsent, rememberCalibrationConsent } from '@/services/telematics/calibration-consent';

export function useCalibrationConsent(userId: number | undefined, bookingCode: string | undefined, profileId: string | undefined) {
  const scope = useMemo(() => userId !== undefined && bookingCode && profileId ? { userId, bookingCode, profileId } : null,
    [userId, bookingCode, profileId]);
  const [result, setResult] = useState<{ scope: typeof scope; accepted: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    if (scope) void hasCalibrationConsent(scope).then((accepted) => { if (active) setResult({ scope, accepted }); });
    return () => { active = false; };
  }, [scope]);
  const accept = useCallback(() => {
    if (!scope) return;
    setResult({ scope, accepted: true });
    void rememberCalibrationConsent(scope);
  }, [scope]);
  return { accepted: Boolean(scope && result?.scope === scope && result.accepted), loading: Boolean(scope && result?.scope !== scope), accept };
}
