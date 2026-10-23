import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

export function useRentalClock() {
  const [now, setNow] = useState(Date.now);

  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => setNow(Date.now());
    const stop = () => { clearInterval(timer); timer = undefined; };
    const start = () => {
      stop();
      update();
      timer = setInterval(update, 15_000);
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });
    return () => { stop(); subscription.remove(); };
  }, []));

  return now;
}
