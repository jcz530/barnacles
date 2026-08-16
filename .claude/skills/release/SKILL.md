---
name: release
description: |
  Cut a new Barnacles release: bump the version, branch, dry-run the release build
  (sign/notarize on Mac/Win/Linux) before merge, open the PR, and after merge tag +
  push to trigger the real release, then fix up the GitHub release notes to match
  house style. Use when asked to "cut a release", "bump the version", "make a release",
  or "tag a release".
allowed-tools:
  - Bash
  - Read
  - Edit
  - AskUserQuestion
---

# Release Barnacles

This repo publishes signed/notarized Electron builds for Mac, Windows, and Linux via
`.github/workflows/release.yml`. That workflow:
- Runs on `push: tags: v*` (builds **and** publishes a GitHub release with binaries)
- Also supports `workflow_dispatch` (manual run on any branch/ref) — in that mode
  electron-builder builds and signs/notarizes but does **not** publish, because
  publishing is gated on a tag being present (`reason=tag is defined`).

That second mode is the dry run: it catches signing/notarization failures (e.g. an
expired Apple Developer agreement) *before* the version bump merges to main, instead
of discovering it after tagging.

There are two phases, run in separate invocations because a human merges the PR in between.

## Phase 1 — Bump, dry-run, open PR

1. Check current state:
   ```bash
   git status
   grep '"version"' package.json
   git log --oneline -20
   gh release list --limit 5
   ```
   Decide the bump type (patch/minor/major) from the nature of the merged PRs since
   the last release tag. Ask the user if it's ambiguous.

2. Bump and branch:
   ```bash
   git checkout main && git pull origin main
   npm version <patch|minor|major> --no-git-tag-version
   git checkout -b release/vX.Y.Z
   git add package.json package-lock.json
   git commit -m "version bump vX.Y.Z"
   git push -u origin release/vX.Y.Z
   ```

3. Dry-run the release workflow on the branch (no tag, so no publish):
   ```bash
   gh workflow run release.yml --ref release/vX.Y.Z
   ```
   Poll for the run to start and complete — use Bash `run_in_background` with an
   `until` loop on `gh run list --workflow=release.yml --limit 1 --json status,headBranch`,
   filtered to the new branch, then report conclusion. This build takes ~10 minutes
   across all three platforms.

4. Report pass/fail:
   - **Pass**: open the PR (`gh pr create`), tell the user the dry-run build succeeded
     on Mac/Windows/Linux, and **stop**. Let the user review and merge manually —
     do not merge automatically.
   - **Fail**: pull failure logs (`gh run view <id> --log-failed`), diagnose, and
     report the root cause to the user before doing anything else. Common failure
     seen before: Apple notarization 403 "agreement missing or expired" — that
     requires the user to accept an agreement at developer.apple.com, not a code fix.

## Phase 2 — After the PR is merged: tag, release, fix up notes

Run this only when the user confirms the version-bump PR has been merged, and only
after they explicitly say to proceed with tagging (always ask first — this triggers
a public release).

1. Sync and tag:
   ```bash
   git checkout main && git pull origin main
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

2. Poll the triggered release workflow the same way as the dry run, until completion.
   This publishes binaries and auto-creates a GitHub release via
   `softprops/action-gh-release`. Note: unlike GitHub's native release UI, this action
   does **not** auto-generate a "What's Changed" body — the release will come up with
   an empty body. You generate that yourself in step 4.

3. If the build fails partway, GitHub may still create a partial release (seen before:
   only one platform's asset got attached before the rest were cancelled). Check with
   `gh release view vX.Y.Z` — if it's missing assets for any of Mac/Windows/Linux,
   delete the incomplete release (`gh release delete vX.Y.Z --yes`) and tell the user;
   do not leave a partial release live. The tag itself can stay. To retry after fixing
   the underlying issue, delete and re-push the tag (`git push origin --delete vX.Y.Z`
   then `git push origin vX.Y.Z`) — pushing an already-existing tag does not retrigger
   the workflow.

4. Once the build succeeds with all platform assets attached, generate the changelog
   body and append the download footer to match house style (see v0.8.0 as the
   reference — `gh release view v0.8.0`):

   ```bash
   gh api repos/jcz530/barnacles/releases/generate-notes \
     -f tag_name=vX.Y.Z -f previous_tag_name=v<PREVIOUS> -q .body
   ```

   Take that output, append the footer below, and set both title and body
   (title should read "Release vX.Y.Z"):

   ```
   # ⬇️ Download

   Mac (Silicone) — Windows —  Linux
   Choose the appropriate artifact below

   or download from
   https://barnacles.app/
   ```

   Write the generated notes + footer to a scratch file, then apply with:
   ```bash
   gh release edit vX.Y.Z --title "Release vX.Y.Z" --notes-file <scratch-file>.md
   ```

## Notes

- Never tag or push without the user's go-ahead — tagging triggers a real, public
  release build and publish.
- Never delete a tag once it has a fully-published release attached; only delete a
  release that is incomplete/broken.
- The version bump commit message style is lowercase: `version bump vX.Y.Z` (matches
  prior releases like `version bump v0.7.0`, `Version Bump: v0.6.0` — casing has
  varied historically, lowercase is fine going forward).
