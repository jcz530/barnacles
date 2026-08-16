/**
 * Demo project accounts.
 *
 * Passwords are seeded through the real account service so they are encrypted
 * exactly like user data. These are obviously-fake placeholder credentials for
 * services that do not exist; the account rows exist so the Accounts tab has
 * something to render.
 */

export interface DemoAccount {
  projectId: string;
  name: string;
  username: string;
  email: string;
  password: string;
  notes: string | null;
  loginUrl: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    projectId: 'demo-proj-01',
    name: 'Staging dashboard',
    username: 'harbor-staging',
    email: 'dev@example.com',
    password: 'demo-password-placeholder',
    notes: 'Shared read-only account for the staging environment.',
    loginUrl: 'https://staging.example.com/login',
  },
  {
    projectId: 'demo-proj-01',
    name: 'Container registry',
    username: 'harbor-ci',
    email: 'ci@example.com',
    password: 'demo-password-placeholder',
    notes: null,
    loginUrl: 'https://registry.example.com',
  },
  {
    projectId: 'demo-proj-01',
    name: 'Error tracking',
    username: 'harbor-team',
    email: 'dev@example.com',
    password: 'demo-password-placeholder',
    notes: 'Alerts route to the #harbor-alerts channel.',
    loginUrl: 'https://errors.example.com/harbor',
  },
  {
    projectId: 'demo-proj-02',
    name: 'Design handoff',
    username: 'tidepool',
    email: 'design@example.com',
    password: 'demo-password-placeholder',
    notes: null,
    loginUrl: 'https://design.example.com',
  },
];
