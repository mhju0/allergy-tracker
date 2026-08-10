import { sortDayEvents } from './calendar';
import type { TrialLike } from './status';
import type { ObservationLike } from '../observation';

// Every observable moment in a trial's life, as one ordered stream.
//
// The calendar and the food-detail page both show a trial's history — one
// sliced by day, one by food — and each used to walk trials, reactions and
// Observations itself. That put the same four rules in two screens, including the
// subtle one: a reacted trial's END row is never emitted, because the reaction
// row already marks that moment. Written twice, it can be fixed once.

export type RecordKind = 'start' | 'safe' | 'reacted' | 'cancelled' | 'observation';

export type ReactionLike = {
  id: string;
  trialId: string;
  occurredAt: Date;
  severity: string;
  symptoms: string[];
  note?: string | null;
};

export type RecordedTrial = TrialLike & { reactions: ReactionLike[]; observations: ObservationLike[] };

export type TrialRecord<F> = {
  key: string;
  at: Date;
  kind: RecordKind;
  food: F;
  trialId: string;
  reaction?: ReactionLike; // only on kind 'reacted'
};

// Oldest first, with a trial's start listed last among events sharing its
// instant (see sortDayEvents). Reverse it for a newest-first view.
export function buildRecords<F>(
  foods: { food: F; trials: RecordedTrial[] }[],
  opts: { includeCancelled?: boolean } = {},
): TrialRecord<F>[] {
  const rows: TrialRecord<F>[] = [];

  for (const { food, trials } of foods) {
    for (const tr of trials) {
      // Cancelled trials are invisible on the calendar (owner decision
      // 2026-07-23) but keep their full history on the food detail page.
      if (tr.outcome === 'cancelled' && !opts.includeCancelled) continue;
      rows.push({ key: `start-${tr.id}`, at: tr.startedAt, kind: 'start', food, trialId: tr.id });
      // outcome 'reacted' emits no end row — the reaction below is that moment.
      if (tr.endedAt && (tr.outcome === 'safe' || tr.outcome === 'cancelled')) {
        rows.push({ key: `end-${tr.id}`, at: tr.endedAt, kind: tr.outcome, food, trialId: tr.id });
      }
      for (const r of tr.reactions) {
        rows.push({ key: `reaction-${r.id}`, at: r.occurredAt, kind: 'reacted', food, trialId: tr.id, reaction: r });
      }
      for (const observation of tr.observations) {
        rows.push({
          key: `observation-${observation.id}`,
          at: observation.occurredAt,
          kind: 'observation',
          food,
          trialId: tr.id,
        });
      }
    }
  }

  return sortDayEvents(rows);
}

// "보통 · 두드러기, 발진" — the one-line reaction summary, written three
// different ways across the calendar, the detail page and the PDF report.
export function reactionSummary(
  r: Pick<ReactionLike, 'severity' | 'symptoms'>,
  t: (key: string) => string,
): string {
  return `${t(`reaction.severityLevel.${r.severity}`)} · ${r.symptoms.map((s) => t(`reaction.symptom.${s}`)).join(', ')}`;
}
