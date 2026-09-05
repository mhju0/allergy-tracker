# Allergy Tracker

Evidence order: source/tests → Git state/history → `docs/DECISIONS.md` →
`docs/ROADMAP.md` → `docs/PROJECT_HANDOFF.md` → historical Claude material.
Do not migrate Claude configuration without an explicit request.

Commands (CI uses Node 22):

```sh
npm ci                 # install locked dependencies
npm start              # Metro development server
npm run ios            # native iOS build/run; requires Xcode and CocoaPods
npm run typecheck
npm test -- --ci
```

There is no lint or separate build script.

- The product is Korean-only and on-device: no backend, accounts, or sync.
  UI copy uses i18next; dates use `ko-KR`.
- Food status is derived in `src/domain/status.ts`, never persisted. Trial
  transitions go through `src/trialLifecycle`; Observation rules and writes
  go through `src/observation`. The `checkin` table stores Observations;
  a check-in is the interaction that records one.
- Only one Trial may be active. Elapsed time alone does not end it. Starting
  the next Trial auto-closes an elapsed Trial as safe only when at least one
  eligible day has an Observation, otherwise cancelled. Cancelled Trials are
  skipped when deriving status, preserving any earlier status. Explicit safe
  confirmation requires an elapsed window. The UI defaults to three days; honor persisted
  `windowDays` when interpreting records.
- `ios/` and `android/` are generated and gitignored. Durable native changes
  belong in `app.json` or `plugins/`, including the local-notification signing
  plugin.
- Change `src/db/schema.ts`, then run `npx drizzle-kit generate` and include
  the generated `drizzle/` files. Do not hand-edit generated migration SQL.
- Preserve catalogue IDs, historical `foodName.*` translations, and legacy
  `is_custom` rows during upgrades. Existing device history depends on them.
- Preserve the local Postgres `mammacare_db` as retained historical data.
