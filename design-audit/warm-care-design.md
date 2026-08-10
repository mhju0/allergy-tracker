# Warm Care — UI redesign direction

**Status:** Shipped design direction. Current behavior and architecture are
documented in `README.md`, `docs/design-spec.md`, and `CONTEXT.md`.

## Design philosophy

Warm Care treats the app as a calm second memory for a busy parent. The interface should answer three questions without interpretation: what food is being watched, what should I do now, and where will the record go. Large rounded surfaces group each answer, while generous cream-colored space prevents the medical context from feeling clinical.

The visual language borrows the reassuring simplicity of modern baby trackers and the food-first clarity of solids apps, without copying a branded screen. Huckleberry's emphasis on lowering parents' mental load informs the single “next action” on Today; Nara's calm, fuss-free logging informs the soft surfaces and plain labels; Solid Starts' food-progress model informs the searchable ingredient library and prominent reaction history.

Color behaves like a quiet signal rather than decoration. Oat cream is the ground, white is the working surface, terracotta marks the primary action, sage means confirmed safe, honey means actively observing, and berry red is reserved for reaction or urgent guidance. Every status also has an icon and a written label.

Rounded cards, 16–24 point gaps, and 48 point controls establish an easy one-handed rhythm. Headings are friendly and compact; supporting text is never smaller than 13 points in the phone mocks. Shadows are broad and faint so cards feel lifted without becoming toy-like.

Motion should only confirm cause and effect: a pressed control settles slightly, a chosen filter changes fill, and navigation moves directly to the named destination. No gesture is required, no icon-only control carries a primary task, and each screen has one visually dominant action.

## Interaction model

[Verified] The app currently uses stack navigation with Home as its hub, and its product rule allows only one active food trial at a time. The redesigned information architecture keeps the rule while making the three recurring destinations persistent:

- **오늘** — the active observation and today's single next action.
- **재료** — search, browse, start, and review foods.
- **기록** — calendar and event history in one place.

Settings moves to a clearly labeled profile control in the Today header. Reaction logging remains a visible secondary action wherever an active food appears; it is never hidden in an overflow menu.

## Six-screen mock set

1. **Today / 오늘** — baby context, active food, three-day progress, “오늘 이상 없음” as the one primary action, and a clearly separate reaction action.
2. **Foods / 재료** — search first, plain-language filters, recent foods first, and a “새 재료 고르기” entry point.
3. **Food detail / 재료 상세** — status summary, high-risk explanation, observation history, and one explicit “3일 관찰 시작” action.
4. **History / 기록** — month context, status legend, selected-day records, and direct links to food detail.
5. **Log reaction / 반응 기록** — symptoms before severity, persistent emergency guidance when needed, and a sticky save action that states what will happen.
6. **Settings / 설정** — baby details, notification state, exports, privacy, and medical disclaimer grouped into understandable cards.

## Core tokens

| Role | Value | Use |
| --- | --- | --- |
| Background | `#FFF8F2` | Warm app ground |
| Surface | `#FFFFFF` | Cards and sheets |
| Primary | `#B64F37` | Main action |
| Ink | `#362C27` | Primary text |
| Secondary ink | `#6E5D55` | Supporting text |
| Honey tint | `#FFF0CF` | Observing |
| Honey text | `#7A5413` | Observing text/icon |
| Sage tint | `#E4F2E8` | Safe |
| Sage text | `#356B4E` | Safe text/icon |
| Berry tint | `#F9E5E7` | Reaction |
| Berry text | `#963944` | Reaction text/icon |
| Border | `#EBDDD3` | Dividers and outlines |

## Reference principles

- Huckleberry: one organized view and reduced mental load — <https://explore.huckleberrycare.com/app/>
- Nara Baby: intuitive, calming, fuss-free tracking — <https://play.google.com/store/apps/details?id=com.naraorganics.nara>
- Solid Starts: food progress, allergen guidance, and shareable reaction records — <https://solidstarts.com/app/>
