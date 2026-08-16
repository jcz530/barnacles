---
name: update-screenshots
description: |
  Regenerate Barnacles product screenshots from demo data and publish them to the
  README and the barnacles-marketing site, including each shot's title, description,
  and alt text from the screenshot manifest. Use when asked to "update the
  screenshots", "refresh the marketing screenshots", "regenerate screenshots", or
  after a UI change that makes the published screenshots stale.
allowed-tools:
  - Bash
  - Read
  - Edit
  - Glob
  - AskUserQuestion
---

# Update Barnacles Screenshots

Screenshots are captured from a deterministic demo database, never from real data.
`npm run screenshots` wipes a disposable profile, seeds 12 fake projects, boots the
app headlessly, and writes one 2400x1600 PNG per page per theme into
`screenshots/out/` as `<name>-<theme>.png`.

`screenshots/manifest.mjs` is the source of truth. Each entry carries both the
capture instructions (`route`, `storage`, `afterLoad`, `settleMs`) and the
publication payload (`title`, `description`, `alt`, `targets`). Publishing is a
mechanical merge of that payload — do not invent new copy unless asked.

Two repos are involved and they are **separate git repositories**:
- this repo — `README.md` + `assets/images/screenshots/`
- the marketing site — Nuxt, `public/images/screenshots/`, consumed by
  `app/components/organisms/AppShowcase.vue`

The marketing site is normally a sibling checkout named `barnacles-marketing`.
Resolve it once and reuse it; if it is somewhere else, ask the user for the path.

```bash
MARKETING="$(cd "$(git rev-parse --show-toplevel)/../barnacles-marketing" 2>/dev/null && pwd)"
echo "${MARKETING:-not found — ask the user where the marketing site lives}"
```

## Phase 1 — Preflight

```bash
git status --short
git -C "$MARKETING" status --short
git -C "$MARKETING" branch --show-current
```

Both trees should be clean and marketing should be on `main`. If either has
uncommitted work, stop and ask before touching anything — this skill creates
branches and commits in both.

Read `screenshots/manifest.mjs` to see which shots exist and where each publishes.

## Phase 2 — Capture

```bash
npm run screenshots
```

Expect one line per shot per theme and a final count. Any `✗` line means that page
failed — investigate before publishing rather than shipping a stale image. The
script hard-fails a shot whose theme or view mode did not apply, so a `✗` is a real
problem, never cosmetic.

Shots marked `manual: true` in the manifest are skipped by the script. Currently
that is `cli`. To refresh it, run the CLI against the demo profile and screenshot
the terminal by hand:

```bash
BARNACLES_DEMO=1 BARNACLES_DATA_DIR=/tmp/dev/.demo-data barnacles projects
```

Tell the user this is a manual step; do not silently skip it.

## Phase 3 — Review (do not skip)

Read every PNG in `screenshots/out/` with the Read tool — it renders images, and
this visual gate is the reason this is a skill and not a shell script. Reject a
shot and fix the cause if you see:

- a real username, home directory, hostname, or client name
- an empty state or a loading skeleton where content should be
- a page in the wrong view mode (card vs table) or the wrong theme
- content that contradicts the manifest `description` for that shot

Fix the demo data, the manifest, or the app — never edit a PNG.

## Phase 4 — Publish to the README

The README uses the light variants. For each shot whose `targets.readme` is set:

```bash
cp screenshots/out/<name>-light.png \
   assets/images/screenshots/barnacles-screenshot-<name>.png
```

Then update `README.md`. Images are wrapped in paired anchors so re-runs replace
in place rather than appending:

```md
<!-- screenshot:settings -->
![<manifest alt text>](assets/images/screenshots/barnacles-screenshot-settings.png)
<!-- /screenshot:settings -->
```

If a shot's anchors are not in the README yet, insert them at the matching
`<!-- Screenshot: … -->` placeholder if one exists, otherwise in the section the
shot belongs to. Use the manifest's `alt` verbatim.

## Phase 5 — Publish to the marketing site

The marketing repo uses **pnpm** — its `package.json` scripts say npm, but the
lockfile is `pnpm-lock.yaml`. Use pnpm.

Ask the user which theme the marketing site should use if it is not already
obvious from the existing files; default to light to match what is published today.

```bash
cp screenshots/out/<name>-light.png "$MARKETING/public/images/screenshots/<file>.png"
```

Then edit the `steps` array in `app/components/organisms/AppShowcase.vue`:
- `stepId: <n>` — update that step's `title`, `description`, and `alt` in place
- `stepId: 'new'` — append a step with the next free `id` and the manifest's
  `icon`, `color`, and `features`

Check `app/components/molecules/VideoPlayer.vue` for a hardcoded screenshot path
and update it if it points at a file you replaced.

## Phase 6 — Verify and commit

```bash
# this repo
npm run format
npm run lint
npm run test:unit

# marketing — proves the Vue edit still compiles
(cd "$MARKETING" && pnpm lint && pnpm build)
```

Show the user both diffs. Then commit on a branch in each repo — never one commit,
they are separate repositories — and open a PR in marketing:

```bash
git -C <repo> checkout -b update-screenshots-<date>
git -C <repo> add -A
git -C <repo> commit -m "Update product screenshots"

# marketing only
(cd "$MARKETING" && gh pr create --fill)
```

Do not push this repo's branch or open its PR unless the user asks.

## Notes

- Never commit `screenshots/out/` — it is gitignored working output. Only the
  copied `assets/images/screenshots/` and `public/images/screenshots/` files are
  tracked.
- Never delete published screenshots that no longer appear in the manifest without
  asking; `dashboard-old.png` in the marketing repo is deliberately kept.
- `AppShowcase.vue` step 6 (Privacy) intentionally has `image: ''` — do not "fix" it.
- `/configs` and `/hosts` are deliberately absent from the manifest: they render
  the real home directory and `/etc/hosts`. Do not add them.
- Theme and view mode are forced by driving the app's own toggles after mount, not
  by seeding localStorage alone — the app rewrites those keys during boot, and
  `useDark` falls back to the OS colour scheme, so a seeded value silently loses.
  If a shot comes out in the wrong theme, that mechanism is where to look.
- Stop `npm run dev` before capturing. The app takes a single-instance lock, so a
  running dev instance makes the capture exit silently.
- Never point demo mode at the real database. `npm run screenshots` handles this;
  if running pieces by hand, `BARNACLES_DATA_DIR` must be set or the seeder will
  refuse to run.
