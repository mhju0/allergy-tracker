import { buildDemoHistory } from './demoData';

const now = new Date(2026, 6, 17, 12, 0, 0);
const d = buildDemoHistory(now);

describe('buildDemoHistory', () => {
  it('spans about a month of history (owner spec 2026-07-23: ~30 days)', () => {
    const earliest = Math.min(...d.trials.map((t) => t.startedAt.getTime()));
    const span = now.getTime() - earliest;
    expect(span).toBeGreaterThan(28 * 86_400_000);
    expect(span).toBeLessThan(35 * 86_400_000);
  });

  it('has exactly two reacted trials and no cancelled ones (owner spec)', () => {
    expect(d.trials.filter((t) => t.outcome === 'reacted')).toHaveLength(2);
    expect(d.trials.filter((t) => t.outcome === 'cancelled')).toHaveLength(0);
  });

  it('has exactly one active trial and it is the most recent', () => {
    const active = d.trials.filter((t) => t.outcome === null);
    expect(active).toHaveLength(1);
    const latestStart = Math.max(...d.trials.map((t) => t.startedAt.getTime()));
    expect(active[0].startedAt.getTime()).toBe(latestStart);
    expect(active[0].endedAt).toBeNull();
  });

  it('never overlaps trials: each closed trial ends before the next starts', () => {
    const sorted = [...d.trials].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      expect(prev.endedAt).not.toBeNull();
      expect(prev.endedAt!.getTime()).toBeLessThanOrEqual(sorted[i].startedAt.getTime());
    }
  });

  it('attaches every reaction and checkin to an existing trial, within its lifetime', () => {
    const byId = new Map(d.trials.map((t) => [t.id, t]));
    for (const ev of [...d.reactions, ...d.checkins]) {
      const t = byId.get(ev.trialId);
      expect(t).toBeDefined();
      expect(ev.occurredAt.getTime()).toBeGreaterThanOrEqual(t!.startedAt.getTime());
      expect(ev.occurredAt.getTime()).toBeLessThanOrEqual((t!.endedAt ?? now).getTime());
    }
  });

  it('places every event in the past', () => {
    const dates = [
      d.babyRow.birthdate!, // demo data always sets one; only the schema is nullable now
      ...d.trials.map((t) => t.startedAt),
      ...d.reactions.map((r) => r.occurredAt),
      ...d.checkins.map((c) => c.occurredAt),
    ];
    for (const dt of dates) expect(dt.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('uses unique ids across all rows', () => {
    const ids = [
      d.babyRow.id,
      ...d.foods.map((f) => f.id),
      ...d.trials.map((t) => t.id),
      ...d.reactions.map((r) => r.id),
      ...d.checkins.map((c) => c.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes safe and reacted outcomes for a varied calendar', () => {
    const outcomes = new Set(d.trials.map((t) => t.outcome));
    expect(outcomes.has('safe')).toBe(true);
    expect(outcomes.has('reacted')).toBe(true);
  });

  // The fixture represents a parent who kept this up. An observed day with no
  // record reads as a day they forgot, and shows up as a blank cell in the
  // ledger and an empty day on the calendar.
  const localDay = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();

  it('records 이상 없음 on every day a food was actually under observation', () => {
    const reactionDayByTrial = new Map(d.reactions.map((r) => [r.trialId, localDay(r.occurredAt)]));
    const checkinDays = new Set(d.checkins.map((c) => `${c.trialId}@${localDay(c.occurredAt)}`));

    const missing: string[] = [];
    for (const t of d.trials) {
      const reactionDay = reactionDayByTrial.get(t.id);
      for (let day = 0; day < t.windowDays; day++) {
        const date = new Date(t.startedAt.getTime() + day * 86_400_000);
        const key = localDay(date);
        if (reactionDay !== undefined && key >= reactionDay) break; // the reaction is that day's record
        if (key >= localDay(now)) break; // today's check-in is still outstanding by design
        if (!checkinDays.has(`${t.id}@${key}`)) missing.push(`${t.foodId} day ${day + 1}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('never logs 이상 없음 on a day something reacted', () => {
    for (const r of d.reactions) {
      const clash = d.checkins.filter(
        (c) => c.trialId === r.trialId && localDay(c.occurredAt) === localDay(r.occurredAt),
      );
      expect(clash).toEqual([]);
    }
  });

  it('varies the time of day rather than stamping everything at 09:00', () => {
    const minutesOf = (dates: Date[]) => new Set(dates.map((x) => x.getHours() * 60 + x.getMinutes()));
    // starts, check-ins and confirmations should each span several times
    expect(minutesOf(d.trials.map((t) => t.startedAt)).size).toBeGreaterThan(4);
    expect(minutesOf(d.checkins.map((c) => c.occurredAt)).size).toBeGreaterThan(8);
    expect(minutesOf(d.trials.flatMap((t) => (t.endedAt ? [t.endedAt] : []))).size).toBeGreaterThan(4);
    // and no single clock time should dominate the whole fixture
    const all = [...d.trials.map((t) => t.startedAt), ...d.checkins.map((c) => c.occurredAt)];
    const counts = new Map<number, number>();
    for (const x of all) {
      const k = x.getHours() * 60 + x.getMinutes();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThan(all.length / 3);
  });

  it('introduces food in the morning and checks in later in the day', () => {
    for (const t of d.trials) expect(t.startedAt.getHours()).toBeGreaterThanOrEqual(7);
    for (const t of d.trials) expect(t.startedAt.getHours()).toBeLessThan(12);
    for (const c of d.checkins) expect(c.occurredAt.getHours()).toBeGreaterThanOrEqual(11);
  });

  it('never confirms safe before the window has actually elapsed', () => {
    for (const t of d.trials) {
      if (t.outcome !== 'safe') continue;
      const windowEnd = t.startedAt.getTime() + t.windowDays * 86_400_000;
      expect(t.endedAt!.getTime()).toBeGreaterThanOrEqual(windowEnd);
    }
  });

  it("leaves today's check-in outstanding, so Home opens on the live 이상 없음 button", () => {
    const active = d.trials.find((t) => t.outcome === null)!;
    const today = d.checkins.filter(
      (c) => c.trialId === active.id && localDay(c.occurredAt) === localDay(now),
    );
    expect(today).toEqual([]);
    // ...but yesterday, the first day of that window, IS recorded
    expect(d.checkins.filter((c) => c.trialId === active.id).length).toBeGreaterThan(0);
  });

  it('is deterministic — two builds for the same instant are identical', () => {
    expect(JSON.stringify(buildDemoHistory(now))).toEqual(JSON.stringify(buildDemoHistory(now)));
  });
});
