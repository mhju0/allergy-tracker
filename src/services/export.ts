import { reactionSummary, type ReactionLike } from '../domain/records';
import type { TrialLike } from '../domain/status';
import { foodLabel } from '../i18n';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

export type ReportInput<F extends { isCustom: boolean; name: string }> = {
  baby: { name: string | null; birthdate: Date | null };
  foods: { food: F; status: string; trials: TrialLike[]; latest: TrialLike | undefined }[];
  reactions: ReactionLike[];
};

const koDate = (d: Date) => d.toLocaleDateString('ko-KR');

// The pediatrician hand-out, from domain values to a printable document.
//
// This assembly used to live in app/settings.tsx while only the templating sat
// here, so the test could hand-write a view-model and never touch the part that
// decides what goes in the report.
export function buildReport<F extends { isCustom: boolean; name: string }>(
  { baby, foods, reactions }: ReportInput<F>, now: Date, t: Translate,
): string {
  const foodByTrial = new Map<string, F>();
  for (const { food, trials } of foods) for (const tr of trials) foodByTrial.set(tr.id, food);

  return render({
    title: t('report.title'),
    // Optional fields: whatever is set, joined; empty string drops the line.
    babyLine: [
      baby.name,
      baby.birthdate ? t('report.born', { date: koDate(baby.birthdate) }) : null,
    ].filter(Boolean).join(' · '),
    generatedLine: t('report.generated', { date: koDate(now) }),
    foodsHeading: t('report.foodsTried'),
    reactionsHeading: t('report.reactionsSection'),
    noneLabel: t('report.none'),
    cols: { food: t('report.colFood'), status: t('report.colStatus'), lastTried: t('report.colLastTried') },
    // A food is "tried" once it has any trial that wasn't cancelled.
    rows: foods
      .filter((f) => f.trials.some((tr) => tr.outcome !== 'cancelled'))
      .map((f) => ({
        food: foodLabel(f.food),
        status: t(`status.${f.status}`),
        lastTried: f.latest ? koDate(f.latest.startedAt) : '',
      })),
    reactionRows: reactions.map((r) => {
      const food = foodByTrial.get(r.trialId);
      return {
        food: food ? foodLabel(food) : '',
        date: koDate(r.occurredAt),
        summary: reactionSummary(r, t),
        note: r.note ?? '',
      };
    }),
  });
}

type ReportView = {
  title: string; babyLine: string; generatedLine: string;
  foodsHeading: string; reactionsHeading: string; noneLabel: string;
  cols: { food: string; status: string; lastTried: string };
  rows: { food: string; status: string; lastTried: string }[];
  reactionRows: { food: string; date: string; summary: string; note: string }[];
};

function render(v: ReportView): string {
  const e = escapeHtml;
  const rows = v.rows.map((r) =>
    `<tr><td>${e(r.food)}</td><td>${e(r.status)}</td><td>${e(r.lastTried)}</td></tr>`).join('');
  const reactions = v.reactionRows.length === 0
    ? `<p>${e(v.noneLabel)}</p>`
    : `<ul>${v.reactionRows.map((r) =>
        `<li><strong>${e(r.food)}</strong> — ${e(r.date)} · ${e(r.summary)}${r.note ? ` · ${e(r.note)}` : ''}</li>`,
      ).join('')}</ul>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, sans-serif; padding: 32px; color: #1c1c1e; }
    h1 { font-size: 22px; } h2 { font-size: 16px; margin-top: 24px; }
    p.meta { color: #6e6e73; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    ul { font-size: 13px; }
  </style></head><body>
    <h1>${e(v.title)}</h1>
    <p class="meta">${v.babyLine ? `${e(v.babyLine)}<br>` : ''}${e(v.generatedLine)}</p>
    <h2>${e(v.foodsHeading)}</h2>
    <table><tr><th>${e(v.cols.food)}</th><th>${e(v.cols.status)}</th><th>${e(v.cols.lastTried)}</th></tr>${rows}</table>
    <h2>${e(v.reactionsHeading)}</h2>
    ${reactions}
  </body></html>`;
}

export function buildBackup(
  data: { baby: unknown[]; foods: unknown[]; trials: unknown[]; reactions: unknown[]; checkins: unknown[] },
  exportedAt: Date,
): string {
  return JSON.stringify(
    { app: 'allergy-tracker', version: 1, exportedAt: exportedAt.toISOString(), ...data },
    null, 2,
  );
}
