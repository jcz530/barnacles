#!/usr/bin/env node
/**
 * Cross-platform production build script for Barnacles
 * Replaces build-production.sh for Windows compatibility
 */

import { execSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  copyFileSync,
  renameSync,
  readdirSync,
  chmodSync,
} from 'fs';
import { platform } from 'os';
import { join } from 'path';

const isWindows = platform() === 'win32';
const isMac = platform() === 'darwin';

/**
 * Execute a command and stream output
 */
function run(command, options = {}) {
  console.log(`\n> ${command}\n`);
  try {
    execSync(command, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let targetPlatform = isMac ? 'mac' : isWindows ? 'win' : 'linux';
  let skipSign = false;

  for (const arg of args) {
    switch (arg) {
      case '--mac':
        targetPlatform = 'mac';
        break;
      case '--win':
        targetPlatform = 'win';
        break;
      case '--linux':
        targetPlatform = 'linux';
        break;
      case '--skip-sign':
        skipSign = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        console.error('Usage: node build-production.mjs [--mac|--win|--linux] [--skip-sign]');
        process.exit(1);
    }
  }

  return { targetPlatform, skipSign };
}

/**
 * Count items in a directory
 */
function countDirItems(dir) {
  try {
    return readdirSync(dir).length;
  } catch {
    return 0;
  }
}

/**
 * Main build function
 */
async function build() {
  const { targetPlatform, skipSign } = parseArgs();

  // Set up environment for signing
  if (skipSign) {
    console.log('⚠️  Building WITHOUT code signing and notarization (faster local build)');
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    process.env.SKIP_NOTARIZE = 'true';
  } else {
    console.log('Building with code signing and notarization (production build)');
  }

  // Build application
  console.log('\n📦 Building application...');
  run('npm run build');

  // Set CLI executable permissions (Unix only)
  if (!isWindows && existsSync('dist/cli/index.js')) {
    console.log('\n🔧 Setting CLI executable permissions...');
    try {
      chmodSync('dist/cli/index.js', 0o755);
    } catch (error) {
      console.warn('Warning: Could not set CLI permissions:', error.message);
    }
  }

  // Backup package-lock.json
  console.log('\n💾 Backing up package-lock.json...');
  copyFileSync('package-lock.json', 'package-lock.json.bak');

  // Remove node_modules
  console.log('\n🗑️  Removing node_modules...');
  rmSync('node_modules', { recursive: true, force: true });

  // Install production dependencies
  console.log('\n📥 Installing production dependencies...');
  run('npm ci --omit=dev');

  // Verify production-only install
  const packageCount = countDirItems('node_modules');
  console.log(`\n✅ Number of packages installed: ${packageCount}`);

  if (existsSync('node_modules/electron')) {
    console.error('ERROR: electron (dev dependency) was installed!');
    process.exit(1);
  }

  // Install notarize for code signing (macOS signed builds only)
  if (!skipSign && targetPlatform === 'mac') {
    console.log('\n🔐 Installing @electron/notarize for code signing...');
    run('npm install --no-save @electron/notarize');
  } else {
    console.log('\n⏭️  Skipping @electron/notarize installation (not needed)');
  }

  // Create placeholder for missing libsql platform packages
  console.log('\n📁 Creating placeholder directories for missing libsql platform packages...');
  const libsqlDir = join('node_modules', '@libsql', 'darwin-x64');
  mkdirSync(libsqlDir, { recursive: true });
  writeFileSync(
    join(libsqlDir, 'package.json'),
    JSON.stringify({ name: '@libsql/darwin-x64', version: '0.0.0' })
  );

  // Rebuild native modules for Electron
  console.log('\n🔨 Rebuilding native modules for Electron...');
  run('npx --yes electron-builder install-app-deps');

  // Build electron app
  console.log('\n🏗️  Running electron-builder...');
  let builderArgs = `--${targetPlatform}`;
  if (skipSign && targetPlatform === 'mac') {
    // For local macOS builds, only create zip (skip DMG which can have permission issues)
    builderArgs = '--mac zip';
  }
  console.log(`Builder args: ${builderArgs}`);
  run(`npx --yes electron-builder ${builderArgs}`);

  // Restore development dependencies
  console.log('\n♻️  Restoring development dependencies...');
  rmSync('node_modules', { recursive: true, force: true });
  renameSync('package-lock.json.bak', 'package-lock.json');
  run('npm ci');

  // Rebuild native modules for development
  console.log('\n🔨 Rebuilding native modules for development...');
  run('npm run rebuild');

  console.log('\n✅ Build complete!');
}

// Run the build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
