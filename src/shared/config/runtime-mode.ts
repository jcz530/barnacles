import path from 'node:path';
import { DEMO_DATA_DIRNAME } from '../database/paths';

/**
 * Runtime mode flags, set via environment variables by the demo and screenshot
 * npm scripts. Kept dependency-free so main, backend, and CLI can all import it.
 */

/**
 * True when BARNACLES_DATA_DIR points at a demo profile.
 *
 * Matches a whole path component, not a substring: `~/projects/my.demo-database`
 * must not be mistaken for a demo profile.
 */
export function isDemoProfilePath(dir: string | undefined): boolean {
  if (!dir) return false;
  return path.resolve(dir).split(path.sep).includes(DEMO_DATA_DIRNAME);
}

/**
 * Demo mode: the app runs against a disposable database seeded with fake data.
 *
 * Requires *both* the flag and a demo profile directory. Demo behaviour is not
 * limited to seeding — it also substitutes the username, the git stats, the
 * running-process list, and the alias config path. Keying those off the flag
 * alone would let `BARNACLES_DEMO=1` on its own show fabricated data on top of
 * the user's real database. Requiring the profile makes demo mode all-or-nothing.
 */
export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BARNACLES_DEMO === '1' && isDemoProfilePath(env.BARNACLES_DATA_DIR);
}

/**
 * True when the demo flag is set but the profile is missing — a misconfiguration
 * worth failing loudly on rather than silently running as a normal session.
 */
export function isDemoModeMisconfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BARNACLES_DEMO === '1' && !isDemoProfilePath(env.BARNACLES_DATA_DIR);
}

/**
 * Screenshot capture mode. Implies demo mode, and additionally suppresses UI
 * affordances that should not appear in a published screenshot (e.g. the demo
 * badge).
 */
export function isScreenshotMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BARNACLES_SCREENSHOTS === '1';
}
