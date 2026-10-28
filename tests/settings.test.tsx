import { Alert, AppState, Linking, Text, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Settings from '../app/settings';
import { readAllTables, useFoodsWithStatus } from '../src/data/queries';
import { canAskForPermission, ensurePermission, isPermissionGranted } from '../src/services/notify';
import { reconcileTrialLifecycle } from '../src/trialLifecycle/sqlite';
import { updateBabySettings } from '../src/data/mutations';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { deleteAsync, moveAsync } from 'expo-file-system/legacy';

const mockBaby = { id: 'b1', name: '기존 이름', birthdate: null, defaultWindowDays: 3, welcomedAt: null };
jest.mock('../src/db/client', () => ({ db: {} }));
jest.mock('../src/data/queries', () => ({
  ...jest.requireActual('../src/data/queries'),
  useBaby: () => mockBaby,
  useFoodsWithStatus: jest.fn(() => []),
  readAllTables: jest.fn(),
}));
jest.mock('../src/data/mutations', () => ({ updateBabySettings: jest.fn(async () => {}) }));
jest.mock('../src/services/notify', () => ({
  isPermissionGranted: jest.fn(),
  canAskForPermission: jest.fn(),
  ensurePermission: jest.fn(),
}));
jest.mock('../src/trialLifecycle/sqlite', () => ({ reconcileTrialLifecycle: jest.fn(async () => {}) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useFocusEffect: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'test-report.pdf' })) }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  deleteAsync: jest.fn(async () => {}),
  moveAsync: jest.fn(async () => {}),
  writeAsStringAsync: jest.fn(async () => {}),
}));

let view: ReactTestRenderer;
let onStateChange: (state: AppStateStatus) => void;
const removeListener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isPermissionGranted).mockResolvedValue(false);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onStateChange = listener;
    return { remove: removeListener };
  });
});
afterEach(() => {
  act(() => view?.unmount());
  jest.restoreAllMocks();
});

test('returning from system settings refreshes the notification permission display', async () => {
  await act(async () => { view = create(<Settings />); });
  expect(view.root.findAllByType(Text).some((node) => node.props.children === 'settings.notifOffShort')).toBe(true);
  jest.mocked(isPermissionGranted).mockResolvedValue(true);
  await act(async () => { onStateChange('active'); });
  expect(view.root.findAllByType(Text).some((node) => node.props.children === 'settings.notifOn')).toBe(true);
  act(() => view.unmount());
  expect(removeListener).toHaveBeenCalledTimes(1);
});

test('history is read only when exporting, and the report uses the fresh database snapshot', async () => {
  jest.mocked(readAllTables).mockResolvedValue({
    baby: [{ ...mockBaby, name: '최근 이름' }], foods: [], trials: [], reactions: [], checkins: [],
  });
  await act(async () => { view = create(<Settings />); });
  expect(useFoodsWithStatus).not.toHaveBeenCalled();
  expect(readAllTables).not.toHaveBeenCalled();
  const button = view.root.findAllByProps({ accessibilityLabel: 'settings.exportPdfClear, settings.exportPdfFormat' })[0];
  expect(button).toBeDefined();
  await act(async () => { await button?.props.onPress(); });
  expect(readAllTables).toHaveBeenCalledTimes(1);
  expect(printToFileAsync).toHaveBeenCalledWith({ html: expect.stringContaining('최근 이름'), width: 595, height: 842 });
});

test('the baby name is not cut mid-syllable by the input and is capped when saved', async () => {
  await act(async () => { view = create(<Settings />); });
  const input = view.root.findAllByProps({ accessibilityLabel: 'setup.babyName' }).find((node) => node.props.onChangeText);
  expect(input?.props.maxLength).toBeUndefined();
  await act(async () => { input?.props.onChangeText(' 가나다라마바사아자차카타파하가나다라마바사 '); });
  expect(updateBabySettings).toHaveBeenLastCalledWith({ name: '가나다라마바사아자차카타파하가나다라마바' });
});

test('the PDF is shared under a readable, dated file name in local time', async () => {
  // Pick a moment whose UTC date differs from the local date, so a UTC stamp would fail.
  const at = new Date(2026, 9, 28, 0, 30);
  if (at.getTimezoneOffset() > 0) at.setHours(23, 30); // west of UTC, late evening falls on the next UTC day
  jest.useFakeTimers({ now: at, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  try {
    jest.mocked(readAllTables).mockResolvedValue({
      baby: [mockBaby], foods: [], trials: [], reactions: [], checkins: [],
    });
    await act(async () => { view = create(<Settings />); });
    const button = view.root.findAllByProps({ accessibilityLabel: 'settings.exportPdfClear, settings.exportPdfFormat' })[0];
    await act(async () => { await button?.props.onPress(); });
  } finally {
    jest.useRealTimers();
  }
  const path = 'file:///cache/allergy-record-2026-10-28.pdf';
  expect(deleteAsync).toHaveBeenCalledWith(path, { idempotent: true });
  expect(moveAsync).toHaveBeenCalledWith({ from: 'test-report.pdf', to: path });
  expect(shareAsync).toHaveBeenCalledWith(path, expect.objectContaining({ mimeType: 'application/pdf' }));
});

function notificationRow() {
  return view.root.findAll((node) => node.props.title === 'settings.observationNotifications' && typeof node.props.onPress === 'function')[0];
}

test('tapping notifications asks for permission when iOS can still prompt, and reschedules on grant', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  jest.mocked(canAskForPermission).mockResolvedValue(true);
  jest.mocked(ensurePermission).mockResolvedValue(true);
  await act(async () => { view = create(<Settings />); });
  await act(async () => { await notificationRow()?.props.onPress(); });
  expect(ensurePermission).toHaveBeenCalledTimes(1);
  expect(reconcileTrialLifecycle).toHaveBeenCalledTimes(1);
  expect(openSettings).not.toHaveBeenCalled();
  expect(view.root.findAllByType(Text).some((node) => node.props.children === 'settings.notifOn')).toBe(true);
});

test('tapping notifications opens the Settings app when iOS can no longer prompt', async () => {
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  jest.mocked(canAskForPermission).mockResolvedValue(false);
  await act(async () => { view = create(<Settings />); });
  await act(async () => { await notificationRow()?.props.onPress(); });
  expect(openSettings).toHaveBeenCalledTimes(1);
  expect(ensurePermission).not.toHaveBeenCalled();
});

function rowTitled(title: string) {
  return view.root.findAll((node) => node.props.title === title && typeof node.props.onPress === 'function')[0];
}

test('a failed save from 사용 안내 다시 보기 is reported, not dropped', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.mocked(updateBabySettings).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { view = create(<Settings />); });
  await act(async () => { await rowTitled('settings.showGuide')?.props.onPress(); });
  expect(alert).toHaveBeenCalledWith('errors.generic');
});

test('a privacy policy link that cannot open is reported, not dropped', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
  await act(async () => { view = create(<Settings />); });
  await act(async () => { rowTitled('settings.privacyPolicy')?.props.onPress(); });
  expect(alert).toHaveBeenCalledWith('errors.generic');
});
