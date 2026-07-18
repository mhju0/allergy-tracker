import { useRef } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { logCheckin } from '../data/mutations';
import { useCheckins } from '../data/queries';
import { isSameLocalDay } from '../domain/status';
import { colors, radii } from './tokens';

// One-tap "이상 없음" observation for an active trial. Never touches trial
// outcome — just logs a checkin row. Collapses to a done-state line once one
// exists for today (local calendar date).
export function CheckinPill({ foodId, trialId }: { foodId: string; trialId: string }) {
  const { t } = useTranslation();
  const checkins = useCheckins();
  const checkingIn = useRef(false);
  const doneToday = checkins.find((c) => c.trialId === trialId && isSameLocalDay(c.occurredAt, new Date()));

  if (doneToday) {
    const time = doneToday.occurredAt.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    return (
      <View style={{ alignItems: 'center', gap: 3 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted, textAlign: 'center' }}>
          ✓ {t('food.checkinDone', { time })}
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center' }}>
          {t('food.checkinHint')}
        </Text>
      </View>
    );
  }

  const onPress = async () => {
    if (checkingIn.current) return;
    checkingIn.current = true;
    try {
      await logCheckin(foodId, new Date());
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      checkingIn.current = false;
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        borderWidth: 1.5, borderColor: colors.green, borderRadius: radii.pill,
        paddingVertical: 12.5, alignItems: 'center',
      }}
    >
      <Text style={{ color: colors.green, fontSize: 15, fontWeight: '700' }}>{t('food.checkinClear')}</Text>
    </Pressable>
  );
}
