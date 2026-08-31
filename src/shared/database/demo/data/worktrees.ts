/**
 * Extra git worktrees for demo projects.
 *
 * Every project gets a main worktree seeded from its stats; these are the
 * *additional* checkouts, so demo mode shows the multi-worktree view rather than
 * only the single-checkout summary. Between them they cover a sibling checkout,
 * one under a separate worktrees root, and a detached HEAD with no branch.
 *
 * `directory` is a name, not a path: the seeder resolves it under the demo
 * workspace exactly as it does for projects, so the on-disk directory really
 * exists and open-in-IDE resolves. A cosmetic /Users/dev path would not.
 *
 * Left deliberately uneven: most projects have a single checkout, a couple have
 * two, and one has enough to make the list scroll.
 */
export interface DemoWorktree {
  projectId: string;
  /** Directory name inside the demo workspace, resolved by the seeder. */
  directory: string;
  /** Null for a detached HEAD. */
  branch: string | null;
  hasUncommittedChanges: boolean;
  lastCommitDaysAgo: number;
  lastCommitMessage: string;
}

export const DEMO_WORKTREES: DemoWorktree[] = [
  // harbor-api: the busiest repo, enough checkouts that the list scrolls.
  {
    projectId: 'demo-proj-01',
    directory: 'harbor-api-billing',
    branch: 'feat/usage-billing',
    hasUncommittedChanges: true,
    lastCommitDaysAgo: 1,
    lastCommitMessage: 'Meter API calls per organisation',
  },
  {
    projectId: 'demo-proj-01',
    directory: 'harbor-api-hotfix',
    branch: 'hotfix/rate-limit-headers',
    hasUncommittedChanges: false,
    lastCommitDaysAgo: 3,
    lastCommitMessage: 'Return Retry-After on 429',
  },
  {
    projectId: 'demo-proj-01',
    directory: 'harbor-api-schema-review',
    branch: null, // detached HEAD, reviewing an old commit
    hasUncommittedChanges: false,
    lastCommitDaysAgo: 21,
    lastCommitMessage: 'Split subscription resolvers',
  },

  // lighthouse-web: a release branch alongside main.
  {
    projectId: 'demo-proj-03',
    directory: 'lighthouse-web-release',
    branch: 'release/2.4',
    hasUncommittedChanges: false,
    lastCommitDaysAgo: 5,
    lastCommitMessage: 'Bump version to 2.4.0',
  },

  // anchor-admin: a long-running migration kept out of the main checkout.
  {
    projectId: 'demo-proj-09',
    directory: 'anchor-admin-vue3-migration',
    branch: 'chore/vue3-migration',
    hasUncommittedChanges: true,
    lastCommitDaysAgo: 2,
    lastCommitMessage: 'Convert the audit log table to script setup',
  },
];
