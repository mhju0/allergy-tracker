import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { confirmSafe } from '../data/mutations';
import type { RecordedTrial } from '../domain/records';
import { coverage } from '../domain/status';
import { Button } from './Button';

// 안전으로 표시, with the one guard the action needs: a window with nothing
// recorded has no observation behind it, so one tap must not turn into 안전 in
// the doctor's report. It still can — the parent's memory is evidence, and the
// app is not in a position to overrule it — but it is asked for rather than
// assumed. Both screens that offer this used to call confirmSafe directly.
export function MarkSafeButton({ trial }: { trial: RecordedTrial }) {
  const { t } = useTranslation();
  const { observed, of } = coverage(trial);

  const onPress = () => {
    const mark = () => confirmSafe(trial.id, new Date());
    if (observed > 0) return void mark();
    Alert.alert(t('home.markSafeNoRecordTitle'), t('home.markSafeNoRecordBody', { total: of }), [
      { text: t('home.markSafeAnyway'), onPress: () => void mark() },
      { text: t('home.markSafeLater'), style: 'cancel' },
    ]);
  };

  return <Button label={t('home.markSafe')} onPress={onPress} />;
}
