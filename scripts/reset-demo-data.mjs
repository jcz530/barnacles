#!/usr/bin/env node
/**
 * Delete the disposable demo profile so the next demo run starts from a clean,
 * deterministically seeded database.
 *
 * The target is a hard-coded literal, never interpolated from an argument or
 * environment variable, and is re-checked before deletion. Deleting the wrong
 * directory here would destroy the user's real database.
 */
import { rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEMO_DIRNAME = '.demo-data';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(repoRoot, DEMO_DIRNAME);

function refuse(reason) {
  console.error(`✋ Refusing to delete ${target}: ${reason}`);
  process.exit(1);
}

// Belt and braces: these can only fail if the constants above are edited badly,
// which is exactly the mistake worth catching before an rm.
if (path.basename(target) !== DEMO_DIRNAME) refuse('not the demo directory');
if (target === repoRoot) refuse('resolves to the repository root');
if (path.dirname(target) !== repoRoot) refuse('resolves outside the repository root');
if (target.endsWith('database.db')) refuse('resolves to a database file');

try {
  await access(target);
} catch {
  console.log(`✨ No ${DEMO_DIRNAME} directory to reset`);
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
console.log(`🧹 Reset ${DEMO_DIRNAME}`);
