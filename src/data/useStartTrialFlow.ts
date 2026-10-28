import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { startTrial } from '../trialLifecycle/sqlite';
import type { FoodWithStatus } from './queries';
import { foodLabel } from '../i18n';
import type { Food } from '../db/schema';
import { showAlert } from '../ui/alert';

// The one shared way to start a trial from UI: contextual notification ask,
// then startTrial; on the one-active-trial conflict, offer cancel-and-start.
// A food with a recorded reaction asks for confirmation first, whether it was
// started from its detail page or picked from the Foods picker.
// onStarted fires only when a trial actually began (used by the picker to
// bounce back to home; the detail page just stays put).
export function useStartTrialFlow(foods: FoodWithStatus[], windowDays: number) {
  const { t } = useTranslation();
  const starting = useRef(false);

  const begin = async (food: Food, onStarted?: () => void) => {
    if (starting.current) return;
    starting.current = true;
    try {
      const res = await startTrial({ food, windowDays });
      if (res.ok) {
        onStarted?.();
        return;
      }
      if (res.reason === 'persistence_failed') {
        showAlert(t('errors.generic'));
        return;
      }
      const active = foods.find((f) => f.status === 'testing');
      const activeTrialId = active?.latest?.id;
      if (!active || !activeTrialId) {
        showAlert(t('food.trialBlocked'));
        return;
      }
      const activeName = foodLabel(active.food);
      showAlert(t('food.blockedTitle', { food: activeName }), t('food.blockedBody'), [
        {
          text: t('food.blockedCancelStart', { food: activeName }),
          style: 'destructive',
          onPress: async () => {
            if (starting.current) return;
            starting.current = true;
            try {
              const retry = await startTrial({ food, windowDays, replaceActiveTrialId: activeTrialId });
              if (retry.ok) onStarted?.();
              else showAlert(t(retry.reason === 'persistence_failed' ? 'errors.generic' : 'food.trialBlocked'));
            } catch {
              showAlert(t('errors.generic'));
            } finally {
              starting.current = false;
            }
          },
        },
        { text: t('food.keepGoing'), style: 'cancel' },
      ]);
    } catch {
      showAlert(t('errors.generic'));
    } finally {
      starting.current = false;
    }
  };

  return async (food: Food, onStarted?: () => void) => {
    if (foods.find((f) => f.food.id === food.id)?.status !== 'reacted') return begin(food, onStarted);
    showAlert(t('food.retestReactedTitle'), t('food.retestReactedBody'), [
      { text: t('food.close'), style: 'cancel' },
      { text: t('food.retestReactedConfirm'), onPress: () => { void begin(food, onStarted); } },
    ]);
  };
}
