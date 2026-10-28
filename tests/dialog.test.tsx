import { Alert, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { dismissDialog, getDialogSnapshot, showAlert } from '../src/ui/alert';
import { DialogHost, ScreenDialogHost } from '../src/ui/DialogHost';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let view: ReactTestRenderer | undefined;

function texts(root: ReactTestRenderer) {
  // The app's Text swaps in no-break spaces and word joiners; compare plain copy.
  return root.root.findAllByType(Text).map((node) => [node.props.children].flat().join('').replace(/\u00a0/g, ' ').replace(/\u2060/g, ''));
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => getDialogSnapshot().dialogs.forEach((dialog) => dismissDialog(dialog.id)));
  act(() => view?.unmount());
  view = undefined;
  jest.restoreAllMocks();
});

test('without a host the native alert is the fallback', () => {
  showAlert('제목', '본문');
  expect(Alert.alert).toHaveBeenCalledWith('제목', '본문', undefined);
});

test('a mounted host shows the dialog in the app with the app Text', () => {
  act(() => { view = create(<DialogHost />); });
  act(() => showAlert('쌀 반응이 기록됐어요', '소아청소년과 의사와 상담해 주세요.'));
  expect(Alert.alert).not.toHaveBeenCalled();
  const shown = texts(view!);
  expect(shown[0]).toBe('쌀 반응이 기록됐어요');
  expect(shown[1]).toContain('소아청소년과 의사와');
  expect(shown).toContain('dialog.ok');
});

test('a button runs its handler and closes the dialog; queued dialogs follow one at a time', () => {
  const onDelete = jest.fn();
  act(() => { view = create(<DialogHost />); });
  act(() => {
    showAlert('첫째', '본문', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: onDelete }]);
    showAlert('둘째');
  });
  expect(texts(view!)).not.toContain('둘째');
  const destructive = view!.root.find((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
    && node.findAllByType(Text).some((text) => text.props.children === '삭제'));
  act(() => destructive.props.onPress());
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(texts(view!)[0]).toBe('둘째');
});

test('a focused sheet host takes the dialog over the root host', () => {
  act(() => {
    view = create(
      <>
        <DialogHost />
        <ScreenDialogHost />
      </>,
    );
  });
  act(() => showAlert('시트 안에서'));
  const [rootHost, sheetHost] = view!.root.children as unknown as { findAllByType: (type: typeof Text) => unknown[] }[];
  expect(rootHost.findAllByType(Text)).toHaveLength(0);
  expect(sheetHost.findAllByType(Text).length).toBeGreaterThan(0);
});
