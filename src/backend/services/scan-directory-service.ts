import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { settingsService } from './settings-service';
import { getDefaultScanDirectories } from '../utils/default-scan-directories';
import { collapseTilde, expandTilde } from '../utils/path-utils';
import { SETTING_KEYS } from '../../shared/types/api';

export interface AddScanDirectoryResult {
  /** The stored directory list after the operation, in `~/...` form. */
  directories: string[];
  /** The directory as stored, tilde-collapsed. */
  added: string;
  /** True when the directory was already present and nothing changed. */
  alreadyPresent: boolean;
}

export class ScanDirectoryRejectedError extends Error {}

/**
 * macOS and Windows filesystems are case-insensitive by default, so `~/code`
 * and `~/Code` are one directory. Comparing them byte-for-byte would store both
 * and scan the same tree twice.
 */
const CASE_INSENSITIVE_FS = process.platform === 'darwin' || process.platform === 'win32';

function samePath(a: string, b: string): boolean {
  return CASE_INSENSITIVE_FS ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function isInside(child: string, parent: string): boolean {
  const prefix = parent.endsWith(path.sep) ? parent : parent + path.sep;
  return CASE_INSENSITIVE_FS
    ? child.toLowerCase().startsWith(prefix.toLowerCase())
    : child.startsWith(prefix);
}

/**
 * Resolve to a real path where possible. A configured directory that no longer
 * exists still needs comparing, so fall back to the lexical form.
 */
async function canonicalize(inputPath: string): Promise<string> {
  const resolved = path.resolve(expandTilde(inputPath));
  return fs.realpath(resolved).catch((): string => resolved);
}

/**
 * Directories whose whole subtree is system-owned. Scanning one walks an
 * enormous tree on every future scan, so they are refused outright rather than
 * merely discouraged in the MCP tool description — a model acting on untrusted
 * repo content should not be able to wreck scan performance.
 *
 * Only these roots themselves are denied, not everything beneath them: macOS
 * temp directories realpath into /private/var, and a project legitimately
 * living under /Volumes/ssd is fine. The risk is scanning the broad root, not
 * a specific directory inside it.
 */
const DENIED_ROOTS = [
  '/System',
  '/Library',
  '/Applications',
  '/usr',
  '/bin',
  '/sbin',
  '/etc',
  '/var',
  '/private',
  '/dev',
  '/proc',
  '/Volumes',
  '/mnt',
  '/media',
];

function assertScannable(absolutePath: string): void {
  const home = os.homedir();
  const { root } = path.parse(absolutePath);

  if (absolutePath === root) {
    throw new ScanDirectoryRejectedError(
      `"${absolutePath}" is a filesystem root. Choose the directory your projects live in, e.g. ~/clients.`
    );
  }

  // Home itself and, crucially, every ancestor of it: `~/..` resolves to
  // /Users, which is home plus every other account on the machine.
  if (absolutePath === home || home.startsWith(absolutePath + path.sep)) {
    throw new ScanDirectoryRejectedError(
      `"${absolutePath}" is too broad to scan — every future scan would walk all of it. ` +
        'Choose the directory your projects live in, e.g. ~/clients.'
    );
  }

  if (DENIED_ROOTS.includes(absolutePath)) {
    throw new ScanDirectoryRejectedError(
      `"${absolutePath}" is a system directory and too broad to scan. ` +
        'Choose the directory your projects live in, e.g. ~/clients.'
    );
  }
}

class ScanDirectoryService {
  /**
   * Serialises appends. The read and the write are separate awaits, so two
   * concurrent calls would otherwise both read the old list and the second
   * would drop the first one's entry.
   */
  private pendingAdd: Promise<unknown> = Promise.resolve();

  /**
   * Read the configured scan directories in their stored (`~/...`) form.
   *
   * `getDefaultScanDirectories` expands tildes for the scanner; this keeps the
   * stored form so the list can be written back unchanged.
   */
  async listStored(): Promise<string[]> {
    const stored = await settingsService.getValue<string[]>(SETTING_KEYS.SCAN_INCLUDED_DIRECTORIES);

    if (stored && Array.isArray(stored) && stored.length > 0) {
      return stored;
    }

    return (await getDefaultScanDirectories()).map(collapseTilde);
  }

  /**
   * Append one directory to the scan list.
   *
   * The read-modify-write happens here rather than in the caller: `PUT
   * /settings/:key` replaces the whole value, so an API client doing its own
   * read-then-write could clobber a list edited in between.
   */
  async add(inputPath: string): Promise<AddScanDirectoryResult> {
    const run = this.pendingAdd.then(
      () => this.addInternal(inputPath),
      () => this.addInternal(inputPath)
    );
    // Keep the chain going even when this call rejects, so one bad path does
    // not wedge every later append.
    this.pendingAdd = run.catch((): undefined => undefined);
    return run;
  }

  private async addInternal(inputPath: string): Promise<AddScanDirectoryResult> {
    const requested = path.resolve(expandTilde(inputPath));

    // Check the requested path before touching the filesystem, so a denied root
    // is reported as such rather than as "does not exist" on a platform where
    // it happens not to be present.
    assertScannable(requested);

    const stats = await fs.stat(requested).catch((): null => null);
    if (!stats) {
      throw new ScanDirectoryRejectedError(`"${inputPath}" does not exist.`);
    }
    if (!stats.isDirectory()) {
      throw new ScanDirectoryRejectedError(`"${inputPath}" is not a directory.`);
    }

    // Re-check the resolved path: a symlink pointing at a denied root would
    // otherwise smuggle one past the check above.
    const absolutePath = await fs.realpath(requested);
    assertScannable(absolutePath);

    const directories = await this.listStored();
    const stored = collapseTilde(absolutePath);

    // Compare canonicalised, so `~/clients`, `/Users/me/clients` and a symlink
    // to either are one entry.
    const alreadyPresent = await this.alreadyListed(directories, absolutePath);

    if (alreadyPresent) {
      return { directories, added: stored, alreadyPresent: true };
    }

    const updated = [...directories, stored];
    await settingsService.setSetting(SETTING_KEYS.SCAN_INCLUDED_DIRECTORIES, updated, 'json');

    return { directories: updated, added: stored, alreadyPresent: false };
  }

  /**
   * Whether a path falls under any configured scan directory. Drives the hint
   * shown after adding a project the scanner would never find on its own.
   */
  async covers(inputPath: string): Promise<boolean> {
    const absolutePath = await canonicalize(inputPath);
    const directories = await this.listStored();

    for (const dir of directories) {
      const scanRoot = await canonicalize(dir);
      if (samePath(absolutePath, scanRoot) || isInside(absolutePath, scanRoot)) {
        return true;
      }
    }

    return false;
  }

  /** Whether any stored entry already points at this directory. */
  private async alreadyListed(directories: string[], absolutePath: string): Promise<boolean> {
    for (const dir of directories) {
      if (samePath(await canonicalize(dir), absolutePath)) {
        return true;
      }
    }

    return false;
  }
}

export const scanDirectoryService = new ScanDirectoryService();
