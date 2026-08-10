import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useFreshNow } from './useFreshNow';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
  };
});

const D = (value: string) => new Date(value);

function Probe({ children, trial }: {
  children: (now: Date) => ReactNode;
  trial?: { startedAt: Date; windowDays: number };
}) {
  const now = useFreshNow(trial);
  return children(now);
}

describe('useFreshNow', () => {
  let view: ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(D('2026-07-01T10:00:00Z'));
  });

  afterEach(() => {
    if (view) act(() => view?.unmount());
    view = undefined;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('refreshes exactly at the next Trial-day transition without polling', () => {
    const seen: number[] = [];
    act(() => {
      view = create(
        <Probe trial={{ startedAt: D('2026-06-30T11:00:00Z'), windowDays: 3 }}>
          {(now) => { seen.push(now.getTime()); return null; }}
        </Probe>,
      );
    });
    const rendersBeforeDeadline = seen.length;

    act(() => { jest.advanceTimersByTime(59 * 60 * 1000); });
    expect(seen).toHaveLength(rendersBeforeDeadline);

    act(() => { jest.advanceTimersByTime(60 * 1000); });
    expect(seen.at(-1)).toBe(D('2026-07-01T11:00:00Z').getTime());
  });

  test('refreshes at local midnight when no Trial deadline is nearer', () => {
    const beforeMidnight = new Date(2026, 6, 1, 23, 59);
    const midnight = new Date(2026, 6, 2);
    jest.setSystemTime(beforeMidnight);
    const seen: number[] = [];
    act(() => {
      view = create(<Probe>{(now) => { seen.push(now.getTime()); return null; }}</Probe>);
    });

    act(() => { jest.advanceTimersByTime(60 * 1000); });
    expect(seen.at(-1)).toBe(midnight.getTime());
  });

  test('resamples time when the focused app returns to the foreground', () => {
    let onChange: ((status: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      onChange = listener;
      return { remove: jest.fn() };
    });
    const seen: number[] = [];
    act(() => {
      view = create(<Probe>{(now) => { seen.push(now.getTime()); return null; }}</Probe>);
    });

    jest.setSystemTime(D('2026-07-01T12:00:00Z'));
    act(() => { onChange?.('active'); });
    expect(seen.at(-1)).toBe(D('2026-07-01T12:00:00Z').getTime());
  });
});
