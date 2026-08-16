#!/usr/bin/env node
/**
 * Launcher for the screenshot capture run.
 *
 * Exists so the demo environment is set *before* Electron starts: the database
 * singleton resolves its path at import time, so BARNACLES_DATA_DIR has to be
 * in the environment of the Electron process itself, not applied later.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Captures use a neutral profile path rather than one inside the repo: several
// views render their real on-disk location (the aliases config file, project
// paths), and a repo-relative path bakes the developer's username into the
// published screenshot.
// A short, stable location outside the repo: repo-relative profiles bake the
// developer's username into paths the UI renders, and os.tmpdir() on macOS is a
// long /var/folders/… path that wraps awkwardly in the UI.
const captureProfile = path.join('/tmp/dev', '.demo-data');

const child = spawn(electron, [path.join(repoRoot, 'scripts/capture-screenshots.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    BARNACLES_DEMO: '1',
    BARNACLES_SCREENSHOTS: '1',
    BARNACLES_DATA_DIR: captureProfile,
  },
});

child.on('exit', code => process.exit(code ?? 1));
