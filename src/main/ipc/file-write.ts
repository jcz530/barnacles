/**
 * Safe file writing primitives.
 *
 * Editing a config file in place is unforgiving: a mangled ~/.zshrc breaks every new
 * shell, a re-encoded ~/.ssh/id_rsa locks you out of servers, and a dotfile symlinked
 * into a dotfile repo silently detaches from git if written naively. Everything here
 * exists to make the read -> edit -> write round trip byte-exact and atomic.
 *
 * Deliberately free of Electron imports so it can be unit tested directly.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { getAppDataDir } from '../../shared/database/paths';

/** How many backup copies to retain per file. */
const MAX_BACKUPS_PER_FILE = 5;

/** Only inspect the head of a file when sniffing for binary content. */
const BINARY_SNIFF_BYTES = 8 * 1024;

/** Refuse to open anything larger than this for editing. */
export const MAX_EDITABLE_SIZE = 10 * 1024 * 1024;

export type LineEnding = 'lf' | 'crlf';

/**
 * The invisible properties of a file that a naive read/write would destroy.
 * Captured on read, reapplied on save.
 */
export interface FileEncoding {
  /** File began with a UTF-8 byte order mark. */
  bom: boolean;
  /** Dominant line ending. Content is normalized to LF for the editor. */
  lineEnding: LineEnding;
  /** File ended with a trailing newline. */
  finalNewline: boolean;
  /** File mixed CRLF and LF. Saving normalizes to `lineEnding`, so warn the user. */
  mixedLineEndings: boolean;
}

export type NotEditableReason = 'binary' | 'not-utf8' | 'too-large' | 'ambiguous-line-endings';

export interface ReadForEditResult {
  editable: boolean;
  reason?: NotEditableReason;
  /** LF-normalized, BOM-stripped text. Only present when editable. */
  content?: string;
  encoding?: FileEncoding;
  /** Identity captured for conflict detection. */
  mtimeMs?: number;
  size?: number;
  /** Symlinks resolved, so the UI reports the file actually written. */
  realPath?: string;
  isSensitive?: boolean;
}

export type WriteFailureReason = 'conflict' | 'permission' | 'not-found' | 'error';

export interface WriteResult {
  success: boolean;
  reason?: WriteFailureReason;
  error?: string;
  mtimeMs?: number;
  size?: number;
  backupPath?: string;
}

/**
 * Directories whose contents are credentials rather than configuration.
 * Paths are matched after symlink resolution.
 */
const SENSITIVE_DIRECTORIES = [
  ['.ssh'],
  ['.gnupg'],
  ['.aws'],
  ['.kube'],
  ['.docker'],
  ['.config', 'gcloud'],
  ['.config', 'gh'],
];

/** Filenames that carry key material wherever they live. */
const SENSITIVE_FILENAMES = new Set([
  '.netrc',
  '_netrc',
  'credentials',
  '.pgpass',
  '.my.cnf',
  '.git-credentials',
  '.npmrc', // holds _authToken
  '.pypirc',
]);

/** Extensions that indicate key or certificate material. */
const SENSITIVE_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.keystore']);

/**
 * Whether a path holds credentials, so the UI can warn before editing.
 *
 * Public keys are excluded: `id_rsa` is secret, `id_rsa.pub` is not.
 */
export function isSensitivePath(filePath: string): boolean {
  // Compare case-insensitively: macOS (APFS) and Windows are case-insensitive by
  // default, so ~/.SSH/id_rsa IS ~/.ssh/id_rsa. realpath() does not canonicalize
  // case, so an exact-case compare would miss it -- and a false negative here
  // means editing a private key with no warning.
  const normalized = path.normalize(filePath);
  const basename = path.basename(normalized).toLowerCase();
  const ext = path.extname(basename).toLowerCase();

  // Match on whole path segments. Comparing raw substrings would flag
  // `.ssh_notes.md`, whose name merely starts with a sensitive directory name.
  // Split on both separators so Windows-shaped paths are handled too.
  const segments = normalized
    .split(/[\\/]/)
    .filter(Boolean)
    .map(segment => segment.toLowerCase());
  const parentSegments = segments.slice(0, -1);
  const isUnderSensitiveDir = SENSITIVE_DIRECTORIES.some(dir =>
    parentSegments.some((_, i) => dir.every((part, j) => parentSegments[i + j] === part))
  );
  if (isUnderSensitiveDir) {
    return true;
  }

  if (SENSITIVE_FILENAMES.has(basename)) {
    return true;
  }

  if (SENSITIVE_EXTENSIONS.has(ext)) {
    return true;
  }

  // Private keys: id_rsa, id_ed25519, ... but not their .pub counterparts.
  if (basename.startsWith('id_') && ext !== '.pub') {
    return true;
  }

  return false;
}

/**
 * Expands a leading tilde to the user's home directory.
 * Mirrors the helper in file-system-bridge.ts.
 */
export function expandTilde(filepath: string): string {
  if (filepath === '~') {
    return os.homedir();
  }
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Whether a buffer is text we can safely round-trip as UTF-8.
 *
 * Two checks: a NUL byte in the head means binary, and a decode/re-encode that
 * doesn't reproduce the original bytes means the content isn't valid UTF-8.
 * Either way, editing would silently corrupt the file, so we refuse.
 */
export type BufferClassification =
  { ok: true; reason?: undefined } | { ok: false; reason: NotEditableReason };

export function classifyBuffer(buffer: Buffer): BufferClassification {
  const head = buffer.subarray(0, Math.min(buffer.length, BINARY_SNIFF_BYTES));
  if (head.includes(0)) {
    return { ok: false, reason: 'binary' };
  }

  // Buffer.toString('utf8') replaces invalid sequences with U+FFFD rather than
  // throwing, so re-encoding and comparing is what actually detects them.
  const roundTripped = Buffer.from(buffer.toString('utf8'), 'utf8');
  if (Buffer.compare(roundTripped, buffer) !== 0) {
    return { ok: false, reason: 'not-utf8' };
  }

  return { ok: true };
}

/**
 * Splits a text buffer into editor-ready content plus the encoding details
 * needed to reconstruct the original byte-for-byte.
 */
export function decodeForEdit(buffer: Buffer): { content: string; encoding: FileEncoding } {
  let text = buffer.toString('utf8');

  const bom = text.charCodeAt(0) === 0xfeff;
  if (bom) {
    text = text.slice(1);
  }

  const crlfCount = (text.match(/\r\n/g) || []).length;
  // Lone LFs are total LFs minus those that are part of a CRLF pair.
  const lfCount = (text.match(/\n/g) || []).length - crlfCount;

  // Any CRLF at all wins. A strict majority test sends ties (and CRLF-minority
  // files) down the LF branch, which silently rewrites every CRLF in a file the
  // user never touched -- turning a one-line edit into a whole-file diff.
  // Converting toward CRLF is the conservative direction: tools that accept CRLF
  // outnumber those that break on it.
  const lineEnding: LineEnding = crlfCount > 0 ? 'crlf' : 'lf';
  const mixedLineEndings = crlfCount > 0 && lfCount > 0;

  // Normalize to LF for the editor. This is the only rewriting we do to the
  // content; every other byte passes through untouched.
  const content = text.replace(/\r\n/g, '\n');

  const finalNewline = content.endsWith('\n');

  return {
    content,
    encoding: { bom, lineEnding, finalNewline, mixedLineEndings },
  };
}

/**
 * Reverses {@link decodeForEdit}, restoring line endings, BOM and trailing newline.
 */
export function encodeForWrite(content: string, encoding: FileEncoding): Buffer {
  // Deliberately NO CRLF normalization here. decodeForEdit already guarantees
  // the content it hands out contains no \r\n, and CodeMirror is configured to
  // LF, so a normalize would only ever act on a pre-existing lone \r that
  // decode left adjacent to an \n it produced -- silently deleting a byte.
  //   "x\r\r\n" -> decode "x\r\n" -> normalize would give "x\n" -> "x\r\n"
  // Lone \r characters are ordinary content and must pass through untouched.
  let text = content;

  if (encoding.finalNewline) {
    if (!text.endsWith('\n')) {
      text += '\n';
    }
  } else if (text.endsWith('\n')) {
    text = text.slice(0, -1);
  }

  if (encoding.lineEnding === 'crlf') {
    text = text.replace(/\n/g, '\r\n');
  }

  if (encoding.bom) {
    text = '﻿' + text;
  }

  return Buffer.from(text, 'utf8');
}

/**
 * Reads a file for editing, refusing anything that can't survive the round trip.
 */
export async function readFileForEdit(filePath: string): Promise<ReadForEditResult> {
  const expanded = expandTilde(filePath);

  // Resolve symlinks up front so conflict detection, mode preservation and the
  // sensitivity check all describe the file we will actually write.
  const realPath = await fs.realpath(expanded);
  const stats = await fs.stat(realPath);

  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${realPath}`);
  }

  const isSensitive = isSensitivePath(realPath);

  if (stats.size > MAX_EDITABLE_SIZE) {
    return { editable: false, reason: 'too-large', realPath, isSensitive };
  }

  const buffer = await fs.readFile(realPath);
  const classification = classifyBuffer(buffer);

  if (!classification.ok) {
    return { editable: false, reason: classification.reason, realPath, isSensitive };
  }

  // A lone CR immediately before a CRLF cannot survive this model: decoding
  // collapses the \r\n to \n, leaving the pre-existing \r adjacent to it, and
  // nothing downstream can tell that apart from a file that simply contained
  // "\r\n". Rather than silently drop a byte, refuse to edit the file --
  // the read-only view and an external editor still work.
  if (buffer.includes('\r\r\n')) {
    return { editable: false, reason: 'ambiguous-line-endings', realPath, isSensitive };
  }

  const { content, encoding } = decodeForEdit(buffer);

  return {
    editable: true,
    content,
    encoding,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    realPath,
    isSensitive,
  };
}

/** Tracks which files have been backed up already this session. */
const backedUpThisSession = new Set<string>();

/** Directory holding backup copies. Demo-mode aware via getAppDataDir(). */
function backupDir(): string {
  return path.join(getAppDataDir(), 'file-backups');
}

/**
 * Copies the current contents aside before the first write of a session.
 *
 * Backups live in app data rather than beside the original so editing doesn't
 * litter the home directory with stray files.
 */
async function createBackup(realPath: string): Promise<string | undefined> {
  if (backedUpThisSession.has(realPath)) {
    return undefined;
  }

  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });

  const hash = crypto.createHash('sha256').update(realPath).digest('hex').slice(0, 16);
  const ext = path.extname(realPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `${hash}-${stamp}${ext}`);

  await fs.copyFile(realPath, target);
  backedUpThisSession.add(realPath);

  await pruneBackups(dir, hash);

  return target;
}

/** Keeps only the newest MAX_BACKUPS_PER_FILE copies for a given file. */
async function pruneBackups(dir: string, hash: string): Promise<void> {
  try {
    const entries = await fs.readdir(dir);
    const mine = entries.filter(name => name.startsWith(`${hash}-`)).sort();

    const excess = mine.length - MAX_BACKUPS_PER_FILE;
    for (let i = 0; i < excess; i++) {
      await fs.unlink(path.join(dir, mine[i])).catch(() => {
        // A backup we cannot prune is not worth failing the save over.
      });
    }
  } catch {
    // Pruning is best effort.
  }
}

/** Exposed for tests, which need each case to start from a clean slate. */
export function resetBackupSessionState(): void {
  backedUpThisSession.clear();
}

/**
 * Writes by truncating the existing inode rather than replacing it.
 *
 * Used only for hardlinked files, where temp+rename would silently detach every
 * other name for the inode. Not atomic -- a crash mid-write can leave a partial
 * file -- which is why the backup taken before this point matters more here.
 */
async function writeInPlace(
  realPath: string,
  buffer: Buffer,
  backupPath: string | undefined
): Promise<WriteResult> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(realPath, 'r+');
    await handle.truncate(0);
    await handle.write(buffer, 0, buffer.length, 0);
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    const code = (error as NodeJS.ErrnoException)?.code;
    return {
      success: false,
      reason: code === 'EACCES' || code === 'EPERM' ? 'permission' : 'error',
      error: error instanceof Error ? error.message : 'Failed to write file',
    };
  }

  const after = await fs.stat(realPath);
  return { success: true, mtimeMs: after.mtimeMs, size: after.size, backupPath };
}

/**
 * Writes a file atomically, preserving its permissions, symlink and identity.
 *
 * The temp file is created in the same directory so the final rename stays on one
 * filesystem, which is what makes it atomic: readers see either the old file or
 * the new one, never a half-written one.
 */
export async function writeFileAtomic(options: {
  filePath: string;
  content: string;
  encoding: FileEncoding;
  expectedMtimeMs?: number;
  expectedSize?: number;
  /** Skip the conflict check when the user has chosen to overwrite. */
  force?: boolean;
}): Promise<WriteResult> {
  const { filePath, content, encoding, expectedMtimeMs, expectedSize, force } = options;
  const expanded = expandTilde(filePath);

  let realPath: string;
  let stats: fsSync.Stats;
  try {
    realPath = await fs.realpath(expanded);
    stats = await fs.stat(realPath);
  } catch {
    return { success: false, reason: 'not-found', error: 'File no longer exists' };
  }

  if (!stats.isFile()) {
    return { success: false, reason: 'error', error: 'Path is not a file' };
  }

  // Conflict detection: has the file changed underneath us since it was opened?
  if (!force && expectedMtimeMs !== undefined) {
    const changed =
      stats.mtimeMs !== expectedMtimeMs ||
      (expectedSize !== undefined && stats.size !== expectedSize);
    if (changed) {
      return {
        success: false,
        reason: 'conflict',
        error: 'File changed on disk since it was opened',
      };
    }
  }

  const buffer = encodeForWrite(content, encoding);

  let backupPath: string | undefined;
  try {
    backupPath = await createBackup(realPath);
  } catch {
    // A failed backup should not block the save; the atomic write still protects
    // against partial writes.
  }

  // A hardlinked file cannot use temp+rename: rename() rebinds the name to a new
  // inode, so every other name for that inode keeps the OLD content. Dotfile
  // managers (stow, chezmoi, plain `ln`) hardlink into a repo, and detaching the
  // file from that repo is exactly the failure the symlink handling avoids.
  // Truncate-in-place instead: it keeps the inode, and with it hardlinks, ACLs,
  // extended attributes and ownership. The tradeoff is atomicity, so it is used
  // only where rename would actively corrupt the user's setup.
  if (stats.nlink > 1) {
    return writeInPlace(realPath, buffer, backupPath);
  }

  const dir = path.dirname(realPath);
  const tmpPath = path.join(
    dir,
    `.${path.basename(realPath)}.barnacles-${crypto.randomBytes(6).toString('hex')}.tmp`
  );

  let handle: fs.FileHandle | undefined;
  try {
    // Pass the mode at creation, not after writing: `open` would otherwise use
    // 0666 & ~umask (typically 0644), leaving the full plaintext of a 0600 key
    // world-readable in its own directory for the duration of the write.
    handle = await fs.open(tmpPath, 'wx', stats.mode);
    await handle.writeFile(buffer);
    // Re-assert it: `open` masks its mode argument through the umask, so a
    // group/other bit present in the original would otherwise be dropped.
    await handle.chmod(stats.mode);
    // Flush to disk before the rename so a crash can't leave an empty file.
    await handle.sync();
    await handle.close();
    handle = undefined;

    await fs.rename(tmpPath, realPath);
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await fs.unlink(tmpPath).catch(() => {});

    const code = (error as NodeJS.ErrnoException)?.code;
    const reason: WriteFailureReason =
      code === 'EACCES' || code === 'EPERM' ? 'permission' : 'error';
    return {
      success: false,
      reason,
      error: error instanceof Error ? error.message : 'Failed to write file',
    };
  }

  const after = await fs.stat(realPath);
  return {
    success: true,
    mtimeMs: after.mtimeMs,
    size: after.size,
    backupPath,
  };
}
