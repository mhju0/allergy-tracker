import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FoodStatus } from '../domain/status';
import { Icon } from './Icon';
import { colors, radii } from './tokens';

export function StatusChip({ status }: { status: FoodStatus }) {
  const { t } = useTranslation();
  const fg = colors.status[status].fg;
  const label = t(`status.${status}`);
  const backgroundColor = status === 'testing'
    ? colors.amberTint
    : status === 'safe'
      ? colors.greenTint
      : status === 'reacted'
        ? colors.redTint
        : '#F5EEE9';

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor }}
    >
      {status === 'untried' ? (
        <View style={{ width: 11, height: 11, borderRadius: radii.pill, borderWidth: 1.5, borderColor: fg }} />
      ) : (
        <Icon name={status === 'testing' ? 'clock' : status === 'safe' ? 'check' : 'warning'} size={13} color={fg} strokeWidth={2.3} />
      )}
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}
