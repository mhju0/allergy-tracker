# Cleanup audit — 2026-09-05

Baseline: `3cbfef0` (PR #3), 210 tests, Expo 57 / React Native 0.86,
five on-device SQLite tables. No server, staging environment or automatic
production deployment. Architecture and safety policy remain unchanged.

## Changes and evidence

| Change | Reason and verification |
| --- | --- |
| Atomic cancel-and-start | Failed insertion previously left the old Trial cancelled. Real SQLite rejects a replacement insert and rolls back cancellation, retaining Observations. Stale confirmations cannot cancel another active Trial. Elapsed windows retain the existing coverage rule. |
| Visible Trial persistence failures | Start no longer offers cancellation for a database failure; safe confirmation and detail cancellation display failures. Five UI regressions cover errors and the extra zero-coverage confirmation. |
| Remove unused Observation reads | Reaction logging previously did 1 + N SELECTs for N historical Trials. At N=100 it now executes **1 instead of 101**, verified at the production adapter's SQLite transport. Safe/cancel similarly go from 2 reads to 1. |
| Skip unchanged catalogue writes | Null-safe UPSERT condition preserves upgrade corrections and legacy rows. An unchanged launch now writes **0 rows instead of 120**, checked with SQLite `total_changes()`. |
| Single-pass latest Trial | Replaces copying/filtering/sorting with a maximum scan; preserves tie order and input. Synthetic 10,000-row lookup: **2.58 ms → 0.19 ms**, not a claim about overall UI speed. |
| Read report data on demand | Settings drops four history-table live subscriptions and builds the PDF from a fresh snapshot on export. Regression checks no history read at mount and fresh profile data in the report. Notification permission display also refreshes on foreground. |
| Delete unused scaffolding | Removed 97 vendored skill/lock files (4,455 lines), three unused workflow docs, the UUID wrapper and redundant function aliases/re-exports. Kept the domain glossary and environment archive; installed no replacement configuration. |
| Consolidate verification | Observation policy tests live with their module; two duplicate cases removed. A shared SQLite bridge replaces the SQL-substring mock test and duplicated database setup. Unused TypeScript declarations now fail verification. |

Benchmark: baseline and current TypeScript transpiled identically under Node
24.14.0; 10,000 records permuted by `(i * 7919) % 10000`, every seventh cancelled;
20 warm-ups, median of nine batches of 20 calls. Both versions selected the same
record. Automated tests separately cover cancellation, ties and input preservation.

## Verification loops

- `npm run verify`: TypeScript and **225 tests in 20 suites pass**, locally in
  Asia/Seoul and UTC. An invalid test outside the configured roots was ignored,
  verifying isolation from unrelated checkout folders.
- `npm run verify:bundle`: production **iOS and Android bundles pass**. Approximately
  3.4 MB and 3.7 MB respectively; no bundle-size improvement claimed.
- CI uses both commands, including PRs targeting another branch. README documents
  setup and targeted tests. Node 22.13+ supplies SQLite without a new dependency;
  committed migrations and the production Drizzle driver execute real transactions.
- Fresh **iOS Simulator Debug build and launch passed**. Native UI smoke covered
  welcome, catalogue, denied notification permission, Trial start, Observation and
  explicit replacement. The isolated device DB had 120 foods / 43 flagged, one
  active Trial, the old Trial cancelled and its Observation preserved. Screenshot
  inspection confirmed the replacement did not show a false automatic-close notice.
- The historical SwiftUICore failure was not reproduced. The unsigned simulator
  build emitted an expo-notifications keychain warning; signed notification delivery
  and cold-launch actions remain unverified. The temporary simulator and Metro
  process were removed after testing; no owner device or history was touched.

## PRs, branches and remaining work

- PR [#2](https://github.com/mhju0/allergy-tracker/pull/2): **should merge**. Actual
  lockfile diff updates xmldom 0.8.13 → 0.8.15 and 0.9.10 → 0.9.12; green CI,
  mergeable, no application changes. Left for owner merge.
- PR [#3](https://github.com/mhju0/allergy-tracker/pull/3): **ready for owner review**;
  its merge was reserved by the owner. Audit changes are isolated on
  `codex/audit-cleanup`, based on that PR.
- **No open issues.** No separate stuck implementation worth salvaging. The highest
  priority pending bug was Trial failure handling, completed here. Deleted local
  and remote `feat/warm-care-ui` only after verifying zero unique commits and
  main 10 commits ahead.
- **Next:** review the remaining dependency advisories individually; plan a release
  after signed-device verification. Require the existing `check` CI status in main
  branch protection: currently protection blocks force/deletion but requires no CI.
  Repository merge policy was left unchanged.
- **Retained deliberately:** custom-food upgrade guards, stable IDs/translations,
  lifecycle/Observation boundaries, notification reconciliation and native signing
  plugin. Router's drawer dependency still requires animation/gesture peers; no
  blind dependency removal or broad audit-fix upgrade.
- **Outside this cleanup:** schema changes, record editing/import/restore design,
  retained Postgres data and shared Firebase infrastructure. Their data-loss or
  product implications exceed the evidence available for an autonomous cleanup.
