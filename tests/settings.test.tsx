import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import Settings from '../app/settings';
import { readAllTables, useFoodsWithStatus } from '../src/data/queries';
import { isPermissionGranted } from '../src/services/notify';
import { printToFileAsync } from 'expo-print';

const mockBaby = { id: 'b1', name: '기존 이름', birthdate: null, defaultWindowDays: 3, welcomedAt: null };
jest.mock('../src/db/client', () => ({ db: {} }));
jest.mock('../src/data/queries', () => ({
  ...jest.requireActual('../src/data/queries'),
  useBaby: () => mockBaby,
  useFoodsWithStatus: jest.fn(() => []),
  readAllTables: jest.fn(),
}));
jest.mock('../src/data/mutations', () => ({ updateBabySettings: jest.fn() }));
jest.mock('../src/services/notify', () => ({ isPermissionGranted: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(async () => ({ uri: 'test-report.pdf' })) }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));

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
  const button = view.root.findAllByProps({ accessibilityLabel: 'settings.exportPdfClear, PDF' })[0];
  expect(button).toBeDefined();
  await act(async () => { await button?.props.onPress(); });
  expect(readAllTables).toHaveBeenCalledTimes(1);
  expect(printToFileAsync).toHaveBeenCalledWith({ html: expect.stringContaining('최근 이름') });
});
