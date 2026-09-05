# Claude Environment Inventory — ARCHIVE

**This is an archive, not a migration plan.** It records what existed in the Claude Code harness
around this project as of **2026-09-04**, so that a capability can be *deliberately* rebuilt later
if it turns out to be missed. Nothing here should be converted into Codex configuration by default.

**No secret values appear in this document.** Where a config file holds credentials or tokens, the
file is named and its contents are not reproduced. `~/.claude/security/`, `~/.claude/.credentials*`
and any auth material were not opened.

### Classification

| Tag | Meaning |
| --- | --- |
| `PROJECT-CRITICAL` | Encodes real knowledge about *the product*. Losing it loses information. |
| `USEFUL-BUT-OPTIONAL` | Genuine leverage, reconstructible, not load-bearing. |
| `CLAUDE-SPECIFIC` | Exists to make **Claude** behave. A different model may not need it at all. |
| `LIKELY-OBSOLETE` | Stale, superseded, or demonstrably never used. |
| `UNKNOWN` | Purpose or current relevance could not be established. |

---

## 1. Instruction files

### 1.1 `CLAUDE.md` (project root) — `PROJECT-CRITICAL`
- **Location:** `/Users/michaelju/Workspace/Projects/allergy-tracker/CLAUDE.md` · **tracked in git**
- **Scope:** project · **Dependencies:** references `docs/design-spec.md`, `docs/agents/*.md`, and the gitignored `.superpowers/rebuild-plan-2026-07-16.md`
- **Does the project rely on it?** The *rules* yes; the *file* no.
- **Knowledge vs behaviour:** ~80 % genuine product invariants, ~20 % agent instruction.
- **The knowledge half** — on-device only; v1 dead and not to be resurrected; status derived never stored; one active trial; the auto-close rule (elapsed + coverage → safe, else cancelled); observation logic lives in `src/observation`; screens use `useFreshNow` / `foodCatalogue` rather than rebuilding rules; Korean-only with `ko-KR` dates; colours only from `src/ui/tokens.ts`; icon + label always accompany status colour; DB changes go through `drizzle-kit generate`, never hand-edited SQL. **All of this is preserved in `docs/PROJECT_HANDOFF.md` and `docs/DECISIONS.md`.**
- **The behaviour half** — "gates before any commit: `npx tsc --noEmit && npx jest`" is a real command contract worth keeping; the "Agent skills" section (§ *Issue tracker*, *Triage labels*, *Domain docs*) is pure harness wiring for a workflow that was never exercised.
- **Note:** the most recent commit on `main` (`23cf63d`) exists solely to *delete an incorrect line* from this file — proof that it drifted and needed correcting. Do not treat it as automatically current.

### 1.2 `CONTEXT.md` (project root) — `PROJECT-CRITICAL`
- **Location:** repo root · **tracked** · **scope:** project
- **Purpose:** the domain glossary — **Trial** (never "Test"), **Observation** (never "Check-in" or "clear day"), **Check-in** (the interaction, distinct from the Observation it persists), **Coverage**.
- **This is real project knowledge, not agent config.** It is the reason the codebase and the Korean UI strings stay consistent. It was created as part of the agent-skills round (`aa4883c`) but does not depend on any skill to be useful.
- **Recommendation if any single file survives the move: this one.**

### 1.3 `~/.claude/CLAUDE.md` (user global) — `CLAUDE-SPECIFIC`, with two exceptions
- **Location:** `/Users/michaelju/.claude/CLAUDE.md` · **not in this repo** · **scope:** global, all projects
- **Purpose:** the owner's personal working agreement with Claude. Sections: *Delivering work* · *Evidence & claims* · *Verification* · *Long tasks* · *Git* · *Licensing*.
- **Does this project rely on it?** Only stylistically — but it is **why this repo looks the way it does**: the `[Verified]/[Inferred]/[Unknown]` tags throughout the docs, the red-test-first regression pattern (`baa6c44` before `dd473ae`), the one-commit-per-coherent-task history, Conventional Commits in English.
- **Two parts are project facts, not agent behaviour, and are preserved in the handoff docs:**
  1. **Licensing.** "No default license… never add, replace, or remove a `LICENSE` file unless I ask." Plus the repo-context notes: `mammacare` is a **shared / non-solely-owned** repo (`github.com/kehdgus96`) so licensing is not ours to set unilaterally; `mammacare-archive` is a local backup folder, not a canonical repo. This directly explains D-08 (MIT added, then removed).
  2. **Push safety.** "Never push to a repo I do not solely own (e.g. `mammacare`) without asking." Same ownership fact, stated as a rule.
- **Everything else — evidence tags, "only what was asked", commit etiquette — is category 3:** a preference a modern model can be told once, or can simply be expected to do.
- **Archaeology note:** `~/.claude/CLAUDE.md.bak` and `~/.claude/CLAUDE.md.proposed` also exist. Not inspected in depth; they suggest this file has been revised at least once.

### 1.4 `docs/agents/{domain,issue-tracker,triage-labels}.md` — `LIKELY-OBSOLETE`
- **Location:** repo `docs/agents/` · **tracked** · **scope:** project · 51 + 45 + 15 lines
- **Purpose:** tells the `.agents/skills` set how to consume this repo — which domain docs to read first, that issues live in GitHub Issues and should be driven with `gh`, and how the five canonical triage labels map to this repo's labels.
- **Dependencies:** the `.agents/skills/` set (§3.1) and a populated GitHub issue tracker.
- **Reality:** the repo has **zero issues, open or closed, ever**. The triage-label mapping maps onto nothing. `domain.md` is the least dead of the three — it points at `CONTEXT.md` and `docs/design-spec.md`, which are genuinely the right entry points.
- **Verdict:** the *pointer* in `domain.md` is worth one line in a README; the rest describes a process that never ran.

---

## 2. Claude settings

### 2.1 `~/.claude/settings.json` (global) — `CLAUDE-SPECIFIC`
| Key | Value | Note |
| --- | --- | --- |
| `model` | `opus[1m]` | 1M-context Opus as the default |
| `effortLevel` | `medium` | session default; this session was raised to `max` via `/effort` |
| `includeCoAuthoredBy` | `false` | **has a visible effect on this repo** — no `Co-Authored-By: Claude` trailers anywhere in 277 commits |
| `autoMemoryEnabled` | `true` | enables §6 |
| `enabledPlugins` | `mattpocock-skills@claude-plugins-official`, `github@claude-plugins-official` | |
| `hooks` | 12 event types | all identical 2 165-char wrappers → `~/.orca/agent-hooks/claude-hook.sh` (§5) |
| `statusLine` | command | same orca wrapper pattern |
| others | `autoMode`, `autoCompactWindow`, `skipDangerousModePermissionPrompt`, `skipWorkflowUsageWarning`, `agentPushNotifEnabled`, `tui`, `modelSettings`, `extraKnownMarketplaces` | UX/runtime preferences |
| `env` | **absent** | *no environment variables are set through Claude settings at all* |
- **Project reliance:** none, except that `includeCoAuthoredBy: false` shaped the commit history.
- **Three `.bak` variants sit beside it** (`settings.json.bak`, `.bak2`, `.bak.prehookremove`) — evidence the hook block has been added and removed before.

### 2.2 `~/.claude/settings.local.json` (global, machine-local) — `CLAUDE-SPECIFIC`
- `permissions.allow`: 5 entries — `Bash(rtk proxy *)`, `Bash(echo "EXIT: $?")`, `Bash(mount)`, `Bash(npx skills *)`, `Bash(node *)`.
- `skillOverrides`: 5 skills turned **off** — `code-review`, and four `higgsfield-*` skills. Turning off `code-review` globally is notable given this project ships its own `code-reviewer` subagent (§4.1).
- Pure harness permissioning. Nothing about the product.

### 2.3 `.claude/settings.local.json` (project) — `LIKELY-OBSOLETE`
- **Location:** repo `.claude/` · **gitignored** (`.gitignore:20` ignores `.claude/`)
- 13 `permissions.allow` entries, **most of them v1-era fossils**: a `frontend/package.json` reader, `curl localhost:8000/docs` (the dead FastAPI backend), `curl localhost:5173` (the dead Vite dev server), and an absolute grep into `/Users/michaelju/Workspace/Projects/mammacare-personal/frontend/src/theme.css` — a path outside this project.
- Broad allows worth knowing about: `Bash(git add *)`, `Bash(git commit *)`, `Bash(python3 *)`, `Bash(/usr/bin/grep *)`, `Bash(rg *)`.
- One entry is a **secret-scanning grep pattern** (`.env|.pem|.key|p12|jks|keystore|serviceAccountKey|firebase-adminsdk|google-services.json|GoogleService-Info.plist|credential|secret`) — that pattern is a genuinely reusable audit idiom; the permission entry around it is not.
- **Verdict:** a permission cache, half of it pointing at software that no longer exists.

### 2.4 `~/.claude.json` project entry — `CLAUDE-SPECIFIC`
- `allowedTools: []`, `mcpServers: {}`, `enabledMcpjsonServers: []`, `hasTrustDialogAccepted: true`, plus per-session telemetry counters (`lastCost`, token totals, durations).
- **No project-scoped MCP servers are configured.** Worth stating plainly: this project's tooling is `npm`, `npx`, `git` and `gh` — nothing exotic.

---

## 3. Skills

### 3.1 `.agents/skills/` — 35 skills, **tracked in git** — `USEFUL-BUT-OPTIONAL` (content) / `LIKELY-OBSOLETE` (as adopted process)
- **Location:** repo `.agents/skills/` · committed in `aa4883c` (2026-08-10) · pinned by `skills-lock.json` (source `mattpocock/skills`, per-skill `computedHash`)
- **Weight:** **96 of the repo's 218 tracked files — 44 % of the repository is agent skills.** `src/` is 56 files.
- **Names:** ask-matt · claude-handoff · code-review · codebase-design · diagnosing-bugs · domain-modeling · git-guardrails-claude-code · grill-me · grill-with-docs · grilling · handoff · implement · improve-codebase-architecture · loop-me · migrate-to-shoehorn · prototype · research · resolving-merge-conflicts · scaffold-exercises · setup-matt-pocock-skills · setup-pre-commit · setup-ts-deep-modules · tdd · teach · to-questionnaire · to-spec · to-tickets · triage · wait-what · wayfinder · wizard · writing-beats · writing-for-agents · writing-fragments · writing-shape
- **Notable:** every skill ships an `agents/openai.yaml` adapter — **this set is already Codex-shaped.** That makes migration cheap, which is exactly why it deserves a deliberate decision rather than a default carry-over.
- **Did the project use them?** `.claude/skill-stats.json` records **one** skill invocation in the project's entire life: `codebase-design`, 2026-07-14, once. (That counter only tracks project-scoped `.claude/skills`, so it undercounts — but the zero-issue tracker corroborates that the `to-tickets`/`triage`/`issue-tracker` half never ran.)
- **Two of them left permanent marks on the codebase regardless of the counter:** `setup-ts-deep-modules` (the vocabulary and structure of the 2026-08-10 deep-module refactor — D-37) and `domain-modeling` (which is where `CONTEXT.md`'s format comes from). Those outcomes are already in the code and the docs; the skills that produced them are not needed to keep them.
- **Recommendation:** treat as a vendored third-party toolkit. Keeping it costs 44 % of the file count and implies a workflow nobody runs.

### 3.2 `.claude/skills/` — 4 project skills — `CLAUDE-SPECIFIC`, one worth reading
- **Location:** repo `.claude/skills/` · **gitignored** · scope: project

| Skill | Purpose | Verdict |
| --- | --- | --- |
| `ship` | Default implementation loop: trace touchpoints → smallest safe diff → `self-review` → report | `CLAUDE-SPECIFIC` |
| `self-review` | **Mandatory post-implementation gate**: run typecheck + jest, send the diff to the `code-reviewer` subagent, fix FAIL findings, report commit-readiness | `CLAUDE-SPECIFIC` — but see below |
| `readonly-audit` | Investigation mode with an `allowed-tools` whitelist that makes writes impossible; produces evidence-tagged findings | `USEFUL-BUT-OPTIONAL` |
| `design-polish` | UI polish, **one screen per run, tokens only**; explicitly not for logic changes | `CLAUDE-SPECIFIC`, project-shaped |
- **The one durable fact inside them:** `self-review` hard-codes the project's verification contract — *typecheck and tests must both pass before anything is reported done*. That contract is real and is captured in `docs/PROJECT_HANDOFF.md`. The orchestration around it is Claude scaffolding.
- `design-polish`'s "tokens only, one screen per run" is a distilled lesson from the design-audit round, and its constraint (never hardcode a colour) is already enforced by a test — `src/ui/tokens.test.ts` — which is the durable version.

### 3.3 `~/.claude/skills/` (global) — mixed
| Skill | State | Verdict |
| --- | --- | --- |
| `ui-ux-pro-max` | Real: `SKILL.md` + `data/` + `scripts/`. A local searchable design database — 67 styles, 161 palettes, 57 font pairings, 25 charts, 21 stacks incl. React Native | `USEFUL-BUT-OPTIONAL` — plausibly used during the design rounds, though nothing in the repo cites it |
| `computer-use` | **empty directory** | `LIKELY-OBSOLETE` |
| `orca-cli` | **empty directory** | `LIKELY-OBSOLETE` |
| `orchestration` | **empty directory** | `LIKELY-OBSOLETE` |

---

## 4. Subagents

### 4.1 `.claude/agents/code-reviewer.md` — `USEFUL-BUT-OPTIONAL`
- **Location:** repo `.claude/agents/` · **gitignored** · scope: project
- **Purpose:** an adversarial, strictly read-only senior reviewer for Expo/RN/TypeScript diffs. Frontmatter restricts it to `Read, Grep, Glob, Bash`; the body forbids editing and any `git add/commit/push/checkout`. Its stated brief: *"find reasons the diff is NOT safe, not to be agreeable."*
- **Dependency:** invoked by the `self-review` skill (§3.2) with the current `git diff`.
- **Why it matters beyond Claude:** the *criteria* it reviews against are this project's real invariants. The adversarial-review habit is visible in the history — the design audit's five P0s were each confirmed by an adversarial pass, and the Home-state bug was caught this way.
- **`~/.claude/agents/` (global) is empty** — this is the only custom subagent anywhere.

---

## 5. Hooks

### 5.1 12 global hooks, all pointing at `orca` — `CLAUDE-SPECIFIC`
- **Location:** `~/.claude/settings.json` → `~/.orca/agent-hooks/claude-hook.sh`
- **Events wired:** `UserPromptSubmit`, `Stop`, `StopFailure`, `SubagentStart`, `SubagentStop`, `TeammateIdle`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `SessionStart`, `PostCompact`. Every one is the same 2 165-character cross-platform launcher (POSIX shell with an embedded base64 PowerShell branch for Windows) that shells out to the orca script.
- **What orca is:** a third-party multi-agent observability/telemetry layer. `~/.orca/agent-hooks/` contains hooks for **14 different agent CLIs** — `claude-hook.sh`, `codex-hook.sh`, `cursor-hook.sh`, `copilot-hook.sh`, `gemini-hook.sh`, `grok-hook.sh`, `devin-hook.sh`, `droid-hook.sh`, `kimi-hook.sh`, `antigravity-hook.sh`, `command-code-hook.sh`, `openclaude-hook.sh`, plus `claude-statusline.sh`.
- **Directly relevant to this migration:** **orca already ships `codex-hook.sh`.** If the owner wants the same telemetry under Codex, that is an orca-side setup step, not something to port out of the Claude config.
- **Project reliance:** none. No hook reads, writes or validates anything in this repo.

### 5.2 `~/.claude/hooks.disabled/rtk-rewrite.sh` — `LIKELY-OBSOLETE`
- Plus `.rtk-hook.sha256` and a `.bak-20260704`. Disabled by directory rename; related to the `rtk proxy` permission in §2.2. Predates this project's v2 work.

### 5.3 No project-level hooks
- Neither `.claude/settings.local.json` nor any committed file defines a hook. Notably, `.agents/skills/git-guardrails-claude-code/scripts/block-dangerous-git.sh` **exists in the repo but is not installed as a hook.**

---

## 6. Auto-memory — `PROJECT-CRITICAL` content, `CLAUDE-SPECIFIC` mechanism

- **Location:** `~/.claude/projects/-Users-michaelju-Workspace-Projects-allergy-tracker/memory/` · outside the repo · scope: this project only · enabled by `autoMemoryEnabled: true`
- **Structure:** `MEMORY.md` index + one file per fact.

| File | Contents | Status |
| --- | --- | --- |
| `v2-rebuild-allergy-tracker.md` (~35 KB) | The single densest source of non-git knowledge: the dogfooding device ("mj iphone 12 mini"), the Xcode workspace rename, CocoaPods needing a UTF-8 `LANG`, the `SwiftUICore` Debug-link break, the screenshot/GIF regeneration recipe, provisioning traps, catalog history (55 → 148 → 120), the grilled won't-dos | **Harvested** into `PROJECT_HANDOFF.md` / `DECISIONS.md` / `ROADMAP.md` |
| `redesign-direction-specimen.md` | The 표본 pick, the "visual language only — do not rename the Korean vocabulary" constraint, the 19-glyph coverage answer, the open A안/B안 list question | **Harvested.** Also now partly *stale*: 표본 was superseded by Warm Care a day after this was written |
| `firebase-v1-secret-alerts.md` | Why the two secret alerts are harmless v1 Firebase *client* keys, why history rewriting was rejected, and the still-open question of the live `mammacare-ce9a5` project | **Harvested** |
| `MEMORY.md` | One-line index of the above | — |
- **The mechanism is Claude-specific; the content is not.** This is exactly the "conversation-only knowledge" the handoff exists to rescue. It is also a live demonstration of the risk: `redesign-direction-specimen.md` reads as current and describes a design system that was replaced 24 hours later. Memory files record what was true when written.

---

## 7. MCP servers — `CLAUDE-SPECIFIC`, and none are project dependencies

| Server | Where | Transport | Project relies on it? |
| --- | --- | --- | --- |
| `headroom` | `~/.claude/.claude.json` | stdio (`headroom`) | No |
| `serena` | `~/.claude/.claude.json` | stdio (`uvx`) | No |
| `tokensave` | `~/.claude/.claude.json` | stdio (local binary) | No |
| `github` | via the `github@claude-plugins-official` plugin | remote | No — **and it failed to connect this session** (400: *"Authorization header is badly formatted"*). All GitHub work was done with the `gh` CLI instead, which is the more portable path anyway. |
| `claude-in-chrome` | account-level | — | No |
| Gmail · Google Calendar · Google Drive · Notion | account-level claude.ai connectors | — | No |

- `~/.claude.json` top-level `mcpServers` is **empty**; the project entry's `mcpServers` and `enabledMcpjsonServers` are **empty**. There is **no `.mcp.json` in the repo**.
- **Takeaway:** nothing about building, testing or shipping this app requires an MCP server. `gh` covers the GitHub surface.

---

## 8. Plugins & marketplaces — `CLAUDE-SPECIFIC`

**Installed** (`~/.claude/plugins/installed_plugins.json`):

| Plugin | Version | Scope | Note |
| --- | --- | --- | --- |
| `mattpocock-skills@claude-plugins-official` | 1.2.3 | user | The upstream of the vendored `.agents/skills/` set (§3.1) — so those 35 skills exist **twice**: once globally as a plugin, once committed into this repo |
| `github@claude-plugins-official` | `1dd995193ba2` | user | Provides the failing MCP server (§7) |
| `skill-usage-counter@skill-usage-counter-marketplace` | 1.0.1 | local (`/Users/michaelju`) | The source of `.claude/skill-stats.json` |

**Registered marketplaces** (`~/.claude/plugins/known_marketplaces.json`): `claude-plugins-official`,
`anthropic-agent-skills`, `karpathy-skills`, `ponytail`, `skill-usage-counter-marketplace`.
**`karpathy-skills` and `ponytail` are registered but have nothing installed from them** — `LIKELY-OBSOLETE`.

---

## 9. Slash commands — none

No `~/.claude/commands/` directory and no `.claude/commands/` in the repo. Every `/name` used on this
project (`/ship`, `/self-review`, `/readonly-audit`, `/design-polish`) is a **skill** invoked by name
(§3.2), not a custom command file. Nothing to inventory.

---

## 10. Claude session output that is NOT config — `PROJECT-CRITICAL`

Listed here because it lives in agent-shaped directories and would be easy to mistake for harness
config and discard.

### 10.1 `.superpowers/` — gitignored, **the richest decision archive in the project**
- `rebuild-plan-2026-07-16.md` — the internal build plan, deliberately kept out of the public repo (D-39).
- `sdd/progress.md` (45 lines) — Tasks 1–14 plus rounds D1–D11, including the *"PROJECT CLOSED at v2.1.1"* entry and the four grilled won't-dos. **This is the primary source for a large share of `docs/DECISIONS.md`.**
- `sdd/task-{1..14}-brief.md` + `-report.md` — 28 files, the ground-up rebuild, task by task.
- `sdd/d1-report.md`, `d2-report.md`, `d3-report.md`, `d15-report.md` — designer/audit rounds.
- 10 × `review-<sha>..<sha>.diff` plus `review-final-branch.md`, `review-task1-slim.md`, `review-task2-slim.md` — the adversarial review trail.
- `d1-home.png`, `d2-home.png`, `d2-calendar.png`, `smoke-boot.png` — screenshots of superseded designs.
- **Status:** not Claude *configuration* — it is Claude *output*, and it is history. It is gitignored, so it exists on this machine only. **Back it up before cleaning anything.**

### 10.2 `design-audit/` — **tracked in git** — `PROJECT-CRITICAL` (with a caveat)
- 9 tracked files: `plan.md`, `plan-home-state-field.md`, `warm-care-design.md`, `mockup-directions-3.html`, and other mockups. Marked `linguist-documentation` in `.gitattributes` so it does not skew the repo's language stats.
- **Caveat:** `plan.md` is a *historical* implementation plan and is now partly wrong — its §3 "Do not do" list still forbids a bottom nav, which Warm Care shipped (D-15). Read it as evidence of intent at a point in time, not as current law.

---

## 11. Clean-slate separation

The user's stated goal: keep **(1)** facts about the project; do not auto-migrate **(2)** instructions
Claude needed to behave, or **(3)** historical preferences a modern model handles unprompted.

### Category 1 — project facts. Preserved; already extracted into the handoff docs.
- Product invariants from `CLAUDE.md` (derived status, one active trial, coverage-aware auto-close, Korean-only, tokens-only colour, migrations via drizzle-kit).
- The domain vocabulary in `CONTEXT.md`.
- The verification contract: `npx tsc --noEmit && npx jest` must both pass.
- Everything in `~/.claude/.../memory/` — device name, build gotchas, the `SwiftUICore` Debug break, catalog history, the grilled won't-dos, the Firebase reasoning.
- Everything in `.superpowers/sdd/` and `design-audit/`.
- From the **global** `CLAUDE.md`, exactly two items: the licensing decision (no license by default; the `mammacare` repo is co-owned) and the push-safety fact behind it.

### Category 2 — Claude behavioural scaffolding. Archived here; not migrated.
- The `ship` / `self-review` / `readonly-audit` / `design-polish` skills and the `code-reviewer` subagent.
- All 35 `.agents/skills/` and the `docs/agents/*.md` conventions around them.
- 12 orca hooks, the statusline, plugins, marketplaces, MCP servers, every `permissions.allow` list.
- Model/effort/auto-mode settings.

### Category 3 — preferences a capable model should not need told twice. Not migrated.
- `[Verified]`/`[Inferred]`/`[Unknown]` evidence tagging.
- "Only what was asked"; don't refactor adjacent code; remove orphaned imports.
- Conventional Commits in English; one commit per coherent task; no `git add .`.
- Write the failing test first; don't assert on incidental behaviour.
- Never commit secrets.
- *(These produced a visibly disciplined repository. That is an argument for stating them once if the new setup does not deliver them — not for porting a config file.)*

### If nothing else survives
`CONTEXT.md` (vocabulary) · the product-invariant half of `CLAUDE.md` · `docs/design-spec.md` §11
(the do-not-resurrect list) · the memory directory's contents · `.superpowers/sdd/progress.md`.
The first three are in the repo. **The last two are gitignored or outside it — copy them somewhere
durable before cleaning up.**
