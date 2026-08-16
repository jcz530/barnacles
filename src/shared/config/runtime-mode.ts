/**
 * Runtime mode flags, set via environment variables by the demo and screenshot
 * npm scripts. Kept dependency-free so main, backend, and CLI can all import it.
 */

/** Demo mode: the app runs against a disposable database seeded with fake data. */
export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BARNACLES_DEMO === '1';
}

/**
 * Screenshot capture mode. Implies demo mode, and additionally suppresses UI
 * affordances that should not appear in a published screenshot (e.g. the demo
 * badge).
 */
export function isScreenshotMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BARNACLES_SCREENSHOTS === '1';
}
