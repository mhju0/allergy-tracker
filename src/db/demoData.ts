import type { Baby, Checkin, Food, Reaction, Trial } from './schema';

// Demo fixture: ~30 days of realistic weaning history so the app looks
// lived-in for demos. Inserted only when EXPO_PUBLIC_DEMO=1 and
// the DB has no baby row (see seed.ts). Deterministic 'demo-' ids.
//
// Written from the point of view of a parent who has actually kept this up for
// a month: every day a food was under observation carries an 이상 없음 record,
// because that is what the app asks for and what a diligent user would do. An
// unrecorded day inside a window reads as a day they forgot, and the fixture
// should not showcase that.
//
// Realism rules mirrored from the app's own flows:
// - a food is introduced in the morning, then checked once a day until the
//   window closes; the parent confirms 안전 the morning it elapses and usually
//   starts the next food shortly after.
// - reacted trials end at the reaction moment, and the reaction is that day's
//   record — no 이상 없음 on the day something went wrong.
// - one active trial at the end (tofu, day 2 of 3) so Home shows the dashboard
//   with the ledger mid-window and the 이상 없음 button live.
// - shape per owner spec 2026-07-23: two reacted (밀/달걀), everything else
//   safe (no cancelled trials), classic first-foods order.
//
// Times are varied but DETERMINISTIC. Math.random would break both the
// screenshot workflow and demoData.test.ts, so variation comes from a hash of
// the trial index — same input, same fixture, every run.

type Spec = {
  foodId: string;
  start: number; // days ago the food was first given
  outcome: Trial['outcome']; // null = active
  reaction?: {
    daysAgo: number;
    symptoms: string[];
    severity: Reaction['severity'];
    note: string | null;
  };
};

const WINDOW = 3;
const MINUTE = 60_000;

const PLAN: Spec[] = [
  { foodId: 'rice', start: 31, outcome: 'safe' },
  { foodId: 'sweetpotato', start: 28, outcome: 'safe' },
  { foodId: 'pumpkin', start: 25, outcome: 'safe' },
  { foodId: 'potato', start: 22, outcome: 'safe' },
  { foodId: 'carrot', start: 19, outcome: 'safe' },
  { foodId: 'broccoli', start: 16, outcome: 'safe' },
  {
    foodId: 'wheat', start: 13, outcome: 'reacted',
    reaction: { daysAgo: 12, symptoms: ['diarrhea'], severity: 'mild', note: '묽은 변 두 번, 이틀 뒤 회복' },
  },
  { foodId: 'banana', start: 11, outcome: 'safe' },
  {
    foodId: 'egg', start: 8, outcome: 'reacted',
    reaction: { daysAgo: 7, symptoms: ['hives', 'swelling'], severity: 'moderate', note: '볼과 목에 두드러기, 1시간 후 가라앉음' },
  },
  { foodId: 'beef', start: 6, outcome: 'safe' },
  { foodId: 'tofu', start: 1, outcome: null },
];

// Deterministic pseudo-random in [0, n) — an FNV-1a hash of (index, salt).
// Never Math.random: the fixture has to reproduce byte-for-byte.
function pick(index: number, salt: string, n: number): number {
  let h = (2166136261 ^ index) >>> 0;
  for (let i = 0; i < salt.length; i++) {
    h = (h ^ salt.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % n;
}

export function buildDemoHistory(now: Date): {
  babyRow: Baby;
  foods: Food[];
  trials: Trial[];
  reactions: Reaction[];
  checkins: Checkin[];
} {
  const at = (daysAgo: number, hour: number, minute = 0): Date => {
    const d = new Date(now.getTime() - daysAgo * 86_400_000);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const trials: Trial[] = [];
  const reactions: Reaction[] = [];
  const checkins: Checkin[] = [];

  // Start times are picked first, in one pass, because a trial's close depends
  // on when the NEXT food was introduced.
  //
  // Back-to-back foods hand over on the same morning: the window runs out and
  // the parent introduces the next one, which is exactly the implicit-safe
  // autoclose the app is built around (decideStartTrial → autoCloseSafeTrialId).
  // For that handoff to be legal the next feed has to land at or after the
  // previous window's end, i.e. no earlier in the day than the previous feed.
  // Nudging each feed in a run a few minutes later satisfies that without the
  // time drifting out of the morning — chaining off the previous close instead
  // compounds, and by the sixth handoff lands in the afternoon.
  const startedAts = PLAN.map((s, i) => {
    let run = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (PLAN[j].start - PLAN[j + 1].start !== WINDOW) break; // a rest day resets the run
      run++;
    }
    return at(s.start, 7, 30 + run * 9 + pick(i, 'min', 7));
  });

  PLAN.forEach((s, i) => {
    const id = `demo-t${i + 1}`;
    const startedAt = startedAts[i];
    const windowEnd = new Date(startedAt.getTime() + WINDOW * 86_400_000);
    const next = startedAts[i + 1];
    let endedAt: Date | null = null;

    if (s.reaction) {
      // The reaction ends the trial where it happened, early in the afternoon.
      const occurredAt = at(s.reaction.daysAgo, 13 + pick(i, 'rxh', 4), pick(i, 'rxm', 60));
      endedAt = occurredAt;
      reactions.push({
        id: `demo-r${i + 1}`, trialId: id, occurredAt,
        symptoms: s.reaction.symptoms, severity: s.reaction.severity, note: s.reaction.note,
      });
    } else if (s.outcome === 'safe') {
      endedAt = next && next.getTime() >= windowEnd.getTime() && next.getTime() - windowEnd.getTime() < 86_400_000
        ? new Date(next.getTime()) // handed over to the next food that same morning
        : new Date(windowEnd.getTime() + (10 + pick(i, 'confirm', 80)) * MINUTE); // confirmed on its own
    }

    trials.push({ id, foodId: s.foodId, startedAt, windowDays: WINDOW, outcome: s.outcome, endedAt });

    // One 이상 없음 per day the food was actually under observation. The day a
    // reaction happened is covered by the reaction itself.
    const reactionDay = s.reaction ? at(s.reaction.daysAgo, 0).getTime() : null;
    for (let day = 0; day < WINDOW; day++) {
      const date = new Date(startedAt.getTime() + day * 86_400_000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      if (reactionDay !== null && dayStart >= reactionDay) break;
      // Today's check-in is deliberately absent on the ACTIVE trial: it is what
      // the app is asking for right now, so leaving it undone is both realistic
      // (the evening check hasn't happened yet) and what makes Home open on the
      // live 이상 없음 button instead of its collapsed done-state.
      if (dayStart >= todayStart) break;

      // Mostly after the evening feed, occasionally around lunch.
      const seed = i * 10 + day;
      const midday = pick(seed, 'when', 4) === 0;
      const occurredAt = new Date(date);
      occurredAt.setHours(
        midday ? 11 + pick(seed, 'h', 3) : 17 + pick(seed, 'h', 5),
        pick(seed, 'm', 60), 0, 0,
      );
      if (occurredAt.getTime() < startedAt.getTime()) continue; // day 1 before the feed
      if (endedAt && occurredAt.getTime() > endedAt.getTime()) continue;
      if (occurredAt.getTime() > now.getTime()) continue;
      checkins.push({ id: `demo-c${i + 1}-${day}`, trialId: id, occurredAt, note: null });
    }

  });

  return {
    // welcomedAt set so demo installs (screenshots) skip the first-run welcome card
    babyRow: { id: 'demo-baby', name: '하율', birthdate: at(240, 0), defaultWindowDays: WINDOW, welcomedAt: at(45, 0) },
    foods: [{ id: 'demo-food-quinoa', name: '퀴노아', isCustom: true, allergenGroup: null }],
    trials, reactions, checkins,
  };
}
