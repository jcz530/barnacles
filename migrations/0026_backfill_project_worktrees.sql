-- Backfill project_worktrees from the git columns on project_stats.
--
-- Branch and dirty state describe a checkout, not a repository, so they move to
-- project_worktrees. Every existing project becomes its own main worktree; the
-- next scan then discovers any linked worktrees via `git worktree list`.
--
-- git_status is deliberately not carried over: it stored raw `git status
-- --porcelain` output (multi-KB for a busy repo) and nothing ever read it.
--
-- Idempotent: the NOT EXISTS guard skips projects that already have a worktree
-- row, so re-running changes nothing.
INSERT INTO project_worktrees (
  id,
  project_id,
  path,
  branch,
  is_main,
  has_uncommitted_changes,
  last_commit_date,
  last_commit_message,
  preferred_ide,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(16))) as id,
  p.id as project_id,
  p.path as path,
  s.git_branch as branch,
  1 as is_main,
  s.has_uncommitted_changes as has_uncommitted_changes,
  s.last_commit_date as last_commit_date,
  s.last_commit_message as last_commit_message,
  p.preferred_ide as preferred_ide,
  unixepoch('now') as created_at,
  unixepoch('now') as updated_at
FROM projects p
LEFT JOIN project_stats s ON s.project_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM project_worktrees w WHERE w.project_id = p.id
);
