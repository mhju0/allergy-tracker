import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useStartTrialFlow } from '../src/data/useStartTrialFlow';
import { MarkSafeButton } from '../src/ui/MarkSafeButton';
import { Button } from '../src/ui/Button';
import FoodDetail from '../app/food/[id]';
import { startTrial, confirmSafe, cancelTrial } from '../src/trialLifecycle/sqlite';
import type { FoodWithStatus } from '../src/data/queries';

jest.mock('../src/trialLifecycle/sqlite', () => ({
  startTrial: jest.fn(), confirmSafe: jest.fn(), cancelTrial: jest.fn(),
}));
jest.mock('../src/observation/sqlite', () => ({ recordObservation: jest.fn() }));
jest.mock('../src/data/queries', () => ({
  useBaby: () => ({ defaultWindowDays: 3 }),
  useFoodsWithStatus: () => mockFoods,
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../src/i18n', () => ({ foodLabel: (food: { name: string }) => food.name }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'egg' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/ui/useFreshNow', () => ({ useFreshNow: () => new Date('2026-07-20T12:00:00Z') }));

const currentTrial = {
  id: 't1', foodId: 'egg', startedAt: new Date('2026-07-19T12:00:00Z'),
  windowDays: 3, outcome: null, endedAt: null,
  reactions: [], observations: [{ id: 'o1', trialId: 't1', occurredAt: new Date('2026-07-20T10:00:00Z'), note: null, backfilledAt: null }],
};
const mockFoods: FoodWithStatus[] = [{
  food: { id: 'egg', name: 'foodName.egg', isCustom: false, allergenGroup: 'egg' },
  status: 'testing', latest: currentTrial, trials: [currentTrial],
}];
const milk = { id: 'milk', name: 'foodName.milk', isCustom: false, allergenGroup: 'milk' };
let start: ReturnType<typeof useStartTrialFlow>;
let view: ReactTestRenderer;

function StartProbe() {
  start = useStartTrialFlow(mockFoods, 3);
  return null;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => view?.unmount());
  jest.restoreAllMocks();
});

test('a failed start reports a save error without offering cancellation', async () => {
  jest.mocked(startTrial).mockResolvedValue({ ok: false, reason: 'persistence_failed' });
  const onStarted = jest.fn();
  act(() => { view = create(<StartProbe />); });
  await act(async () => { await start(milk, onStarted); });
  expect(Alert.alert).toHaveBeenCalledWith('errors.generic');
  expect(cancelTrial).not.toHaveBeenCalled();
  expect(onStarted).not.toHaveBeenCalled();
});

test('confirmed replacement uses one atomic command and reports failure', async () => {
  jest.mocked(startTrial)
    .mockResolvedValueOnce({ ok: false, reason: 'trial_in_progress' })
    .mockResolvedValueOnce({ ok: false, reason: 'persistence_failed' });
  const onStarted = jest.fn();
  act(() => { view = create(<StartProbe />); });
  await act(async () => { await start(milk, onStarted); });
  const confirm = jest.mocked(Alert.alert).mock.calls[0][2]?.find((button) => button.style === 'destructive');
  expect(confirm).toBeDefined();
  await act(async () => { await confirm?.onPress?.(); });
  expect(startTrial).toHaveBeenLastCalledWith({ food: milk, windowDays: 3, replaceActiveTrialId: 't1' });
  expect(startTrial).toHaveBeenCalledTimes(2);
  expect(cancelTrial).not.toHaveBeenCalled();
  expect(onStarted).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenLastCalledWith('errors.generic');
});

test('a failed safe confirmation is visible', async () => {
  jest.mocked(confirmSafe).mockResolvedValue({ ok: false, reason: 'persistence_failed' });
  act(() => { view = create(<MarkSafeButton trial={currentTrial} />); });
  await act(async () => { view.root.findByType(Button).props.onPress(); });
  expect(confirmSafe).toHaveBeenCalledWith({ trialId: 't1' });
  expect(Alert.alert).toHaveBeenCalledWith('errors.generic');
});

test('zero-coverage safe confirmation still requires the explicit extra tap', async () => {
  jest.mocked(confirmSafe).mockResolvedValue({ ok: false, reason: 'persistence_failed' });
  act(() => { view = create(<MarkSafeButton trial={{ ...currentTrial, observations: [] }} />); });
  act(() => { view.root.findByType(Button).props.onPress(); });
  expect(confirmSafe).not.toHaveBeenCalled();
  const confirm = jest.mocked(Alert.alert).mock.calls[0][2]?.[0];
  await act(async () => { await confirm?.onPress?.(); });
  expect(confirmSafe).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenLastCalledWith('errors.generic');
});

test('a failed cancellation from Food detail is visible', async () => {
  jest.mocked(cancelTrial).mockResolvedValue({ ok: false, reason: 'persistence_failed' });
  act(() => { view = create(<FoodDetail />); });
  const cancel = view.root.findAllByType(Button).find((button) => button.props.label === 'food.cancelTrial');
  expect(cancel).toBeDefined();
  act(() => { cancel?.props.onPress(); });
  const confirm = jest.mocked(Alert.alert).mock.calls[0][2]?.find((button) => button.style === 'destructive');
  await act(async () => { await confirm?.onPress?.(); });
  expect(cancelTrial).toHaveBeenCalledWith({ trialId: 't1' });
  expect(Alert.alert).toHaveBeenLastCalledWith('errors.generic');
});
