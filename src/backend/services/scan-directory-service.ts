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
 * Directories too broad to scan. Adding one of these would make every future
 * scan walk an enormous tree, so they are refused rather than merely warned
 * about — a misbehaving client should not be able to wreck scan performance.
 */
function assertScannable(absolutePath: string): void {
  const home = os.homedir();
  const { root } = path.parse(absolutePath);

  if (absolutePath === root) {
    throw new ScanDirectoryRejectedError(
      `"${absolutePath}" is a filesystem root. Choose the directory your projects live in, e.g. ~/clients.`
    );
  }

  if (absolutePath === home) {
    throw new ScanDirectoryRejectedError(
      'The home directory is too broad to scan — every future scan would walk all of it. ' +
        'Choose the directory your projects live in, e.g. ~/clients.'
    );
  }
}

class ScanDirectoryService {
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
    const absolutePath = path.resolve(expandTilde(inputPath));

    assertScannable(absolutePath);

    const stats = await fs.stat(absolutePath).catch((): null => null);
    if (!stats) {
      throw new ScanDirectoryRejectedError(`"${inputPath}" does not exist.`);
    }
    if (!stats.isDirectory()) {
      throw new ScanDirectoryRejectedError(`"${inputPath}" is not a directory.`);
    }

    const directories = await this.listStored();
    const stored = collapseTilde(absolutePath);

    // Compare expanded, so `~/clients` and `/Users/me/clients` are one entry.
    const alreadyPresent = directories.some(
      (dir: string) => path.resolve(expandTilde(dir)) === absolutePath
    );

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
    const absolutePath = path.resolve(expandTilde(inputPath));
    const directories = await this.listStored();

    return directories.some((dir: string) => {
      const scanRoot = path.resolve(expandTilde(dir));
      return absolutePath === scanRoot || absolutePath.startsWith(scanRoot + path.sep);
    });
  }
}

export const scanDirectoryService = new ScanDirectoryService();
