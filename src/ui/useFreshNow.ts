import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MS_PER_DAY } from '../domain/status';

type TimedTrial = { startedAt: Date; windowDays: number };

function nextTrialDeadline(trial: TimedTrial | undefined, now: Date): Date | undefined {
  if (!trial) return undefined;
  for (let day = 1; day <= trial.windowDays; day++) {
    const at = new Date(trial.startedAt.getTime() + day * MS_PER_DAY);
    if (at.getTime() > now.getTime()) return at;
  }
  return undefined;
}

function nextLocalMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

export function useFreshNow(trial?: TimedTrial): Date {
  const [now, setNow] = useState(() => new Date());
  const [focused, setFocused] = useState(false);
  const refresh = useCallback(() => setNow(new Date()), []);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    refresh();
    return () => setFocused(false);
  }, [refresh]));

  useEffect(() => {
    if (!focused) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [focused, refresh]);

  useEffect(() => {
    if (!focused) return;
    const trialDeadline = nextTrialDeadline(trial, now);
    const midnight = nextLocalMidnight(now);
    const deadline = trialDeadline && trialDeadline.getTime() < midnight.getTime()
      ? trialDeadline
      : midnight;
    const timer = setTimeout(refresh, deadline.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [focused, now, refresh, trial]);

  return now;
}
