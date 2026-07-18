import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FoodStatus } from '../domain/status';
import { colors, radii } from './tokens';

export function StatusChip({ status }: { status: FoodStatus }) {
  const { t } = useTranslation();
  const fg = colors.status[status].fg;
  const label = t(`status.${status}`);
  const outlined = status === 'untried';

  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: radii.pill,
          backgroundColor: outlined ? 'transparent' : fg,
          borderWidth: outlined ? 1.5 : 0,
          borderColor: fg,
        }}
      />
      <Text style={{ color: fg, fontSize: 12, fontWeight: outlined ? '500' : '800' }}>{label}</Text>
    </View>
  );
}
