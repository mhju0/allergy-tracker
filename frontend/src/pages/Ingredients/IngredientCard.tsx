import { type ChipStatus } from "../../components/ui/status-chip";
import { IngredientIcon } from "../../components/IngredientIcon";
import type { IngredientResponse } from "../../api/ingredients";

// Korean status label — shown under the stamp AND in the aria-label so state is
// never conveyed by ink color alone (DESIGN_SYSTEM accessibility rule).
const CHIP_LABEL: Record<ChipStatus, string> = {
  safe: "안전",
  testing: "테스트중",
  reaction: "반응",
  caution: "주의",
  "not-started": "미시작",
};

// Ink color per status, existing semantic tokens only (hybrid mock: stamp ink =
// traffic-light fg colors). not-started is a dashed empty stamp in neutral ink.
const STAMP_RING: Record<ChipStatus, string> = {
  safe: "border-double border-4 border-safe-fg text-safe-fg",
  testing: "border-double border-4 border-testing-fg text-testing-fg",
  reaction: "border-double border-4 border-reaction-fg text-reaction-fg",
  caution: "border-double border-4 border-caution-fg text-caution-fg",
  "not-started": "border-dashed border-2 border-warm-border text-warm-fg-muted",
};

const STAMP_LABEL_COLOR: Record<ChipStatus, string> = {
  safe: "text-safe-fg",
  testing: "text-testing-fg",
  reaction: "text-reaction-fg",
  caution: "text-caution-fg",
  "not-started": "text-warm-fg-muted",
};

/**
 * Presentational ingredient tile — hybrid-mock ink-stamp look. Owns no data or
 * derivation; the page passes the derived chip status and the tap handler.
 * The tiny deterministic rotation (by ingredient id) gives the hand-stamped feel
 * without per-ingredient image assets.
 */
export function IngredientCard({
  ingredient,
  chip,
  starting,
  disabled,
  onStart,
}: {
  ingredient: IngredientResponse;
  chip: ChipStatus;
  starting: boolean;
  disabled: boolean;
  onStart: (ingredient: IngredientResponse) => void;
}) {
  const monthLabel =
    ingredient.recommended_month != null ? `${ingredient.recommended_month}개월~` : null;
  const rotation = (ingredient.id % 5) - 2; // -2° ~ +2°, stable per ingredient

  return (
    <button
      type="button"
      onClick={() => onStart(ingredient)}
      disabled={disabled}
      aria-label={`${ingredient.name}, ${CHIP_LABEL[chip]}`}
      className="flex flex-col items-center gap-2 rounded-3xl bg-warm-surface px-2 py-4 shadow-warm transition-colors hover:bg-warm-surface-soft/40 disabled:pointer-events-none disabled:opacity-60"
    >
      <span
        style={{ transform: `rotate(${rotation}deg)` }}
        className={`flex aspect-square w-full max-w-24 flex-col items-center justify-center gap-1 rounded-full ${STAMP_RING[chip]}`}
      >
        <IngredientIcon name={ingredient.name} emoji={ingredient.emoji} className="h-8 w-8" />
        <span className="max-w-[80%] truncate text-[11px] font-bold leading-tight">
          {ingredient.name}
        </span>
      </span>
      <span className={`text-[11px] font-semibold leading-tight ${STAMP_LABEL_COLOR[chip]}`}>
        {starting ? "시작하는 중…" : CHIP_LABEL[chip]}
        {!starting && monthLabel && (
          <span className="font-medium text-warm-fg-muted"> · {monthLabel}</span>
        )}
      </span>
    </button>
  );
}
