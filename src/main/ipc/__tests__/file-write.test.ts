import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { getAppDataDir } from '../../../shared/database/paths';
import {
  classifyBuffer,
  decodeForEdit,
  encodeForWrite,
  isSensitivePath,
  readFileForEdit,
  resetBackupSessionState,
  writeFileAtomic,
} from '../file-write';

let tmpDir: string;
let backupsDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'barnacles-file-write-'));
  // Under NODE_ENV=test getAppDataDir resolves to a pid-namespaced tmp dir, so
  // ask it where backups land rather than assuming a path.
  backupsDir = path.join(getAppDataDir(), 'file-backups');
  await fs.rm(backupsDir, { recursive: true, force: true });
  resetBackupSessionState();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.rm(backupsDir, { recursive: true, force: true });
});

/** Writes a fixture from raw bytes and returns its path. */
async function fixture(name: string, contents: Buffer | string): Promise<string> {
  const filePath = path.join(tmpDir, name);
  await fs.writeFile(filePath, contents);
  return filePath;
}

/**
 * Reads a file for editing and writes it straight back with no modifications.
 * The file must come out byte-identical.
 */
async function roundTrip(filePath: string): Promise<void> {
  const before = await fs.readFile(filePath);

  const read = await readFileForEdit(filePath);
  expect(read.editable).toBe(true);

  const result = await writeFileAtomic({
    filePath,
    content: read.content!,
    encoding: read.encoding!,
    expectedMtimeMs: read.mtimeMs,
    expectedSize: read.size,
  });
  expect(result.success).toBe(true);

  const after = await fs.readFile(filePath);
  expect(Buffer.compare(before, after)).toBe(0);
}

describe('encoding round trip', () => {
  it('preserves a plain LF file exactly', async () => {
    await roundTrip(await fixture('lf.txt', "alias ll='ls -la'\nexport PATH=$HOME/bin\n"));
  });

  it('preserves CRLF line endings', async () => {
    await roundTrip(await fixture('crlf.txt', 'first\r\nsecond\r\nthird\r\n'));
  });

  it('preserves a UTF-8 BOM alongside CRLF', async () => {
    const buf = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('key = value\r\nother = thing\r\n', 'utf8'),
    ]);
    await roundTrip(await fixture('bom-crlf.txt', buf));
  });

  it('preserves the absence of a trailing newline', async () => {
    await roundTrip(await fixture('no-final-newline.txt', 'no newline at end'));
  });

  it('preserves tabs, CJK and emoji', async () => {
    await roundTrip(
      await fixture('special.txt', 'tab\there\nCJK 日本語 中文\nemoji 🎉🚀\naccents éàü ñ\n')
    );
  });

  it.each(['x\r\r\n', 'a\r\r\nb\r\n', 'line1\r\nline2\r\r\nline3\r\n'])(
    'refuses a file whose line endings cannot round-trip (%j)',
    async contents => {
      // A lone CR before a CRLF is unrepresentable: decoding collapses the \r\n
      // to \n, and the surviving \r is then indistinguishable from content that
      // was always "\r\n". Editing would silently delete a byte, so refuse.
      const filePath = await fixture('ambiguous.txt', contents);
      const before = await fs.readFile(filePath);

      const read = await readFileForEdit(filePath);
      expect(read.editable).toBe(false);
      expect(read.reason).toBe('ambiguous-line-endings');

      // And the file is untouched.
      expect(Buffer.compare(before, await fs.readFile(filePath))).toBe(0);
    }
  );

  it('preserves lone CR line endings (classic Mac)', async () => {
    await roundTrip(await fixture('cr-only.txt', 'line one\rline two\r'));
  });

  it('preserves an empty file', async () => {
    await roundTrip(await fixture('empty.txt', ''));
  });

  it('preserves a file containing only a BOM', async () => {
    await roundTrip(await fixture('bom-only.txt', Buffer.from([0xef, 0xbb, 0xbf])));
  });

  it('preserves a U+FEFF that appears mid-file', async () => {
    await roundTrip(await fixture('mid-bom.txt', 'first\nsec\ufeffond\n'));
  });

  it('keeps CRLF when CRLF and LF counts tie', async () => {
    // A strict-majority test sends ties to LF, silently rewriting every CRLF in
    // a file the user never touched and turning one edit into a whole-file diff.
    const filePath = await fixture('tie.txt', 'a\r\nb\n');
    const read = await readFileForEdit(filePath);
    expect(read.encoding?.lineEnding).toBe('crlf');
  });

  it('keeps CRLF even when LF is the majority', async () => {
    const filePath = await fixture('lf-major.txt', 'a\r\nb\nc\nd\n');
    const read = await readFileForEdit(filePath);
    expect(read.encoding?.lineEnding).toBe('crlf');
    expect(read.encoding?.mixedLineEndings).toBe(true);
  });

  it('preserves a file with mixed line endings by normalizing to the dominant one', async () => {
    // Any CRLF present means CRLF wins, so the stray LF is converted on save.
    const filePath = await fixture('mixed.txt', 'a\r\nb\r\nc\nd\r\n');
    const read = await readFileForEdit(filePath);

    expect(read.encoding?.mixedLineEndings).toBe(true);
    expect(read.encoding?.lineEnding).toBe('crlf');

    await writeFileAtomic({
      filePath,
      content: read.content!,
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    // The stray LF is normalized; every other byte is untouched.
    expect(await fs.readFile(filePath, 'utf8')).toBe('a\r\nb\r\nc\r\nd\r\n');
  });

  it('applies an edit without disturbing surrounding encoding', async () => {
    const filePath = await fixture('edit-crlf.txt', 'one\r\ntwo\r\n');
    const read = await readFileForEdit(filePath);

    await writeFileAtomic({
      filePath,
      content: read.content!.replace('two', 'TWO'),
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    expect(await fs.readFile(filePath, 'utf8')).toBe('one\r\nTWO\r\n');
  });

  it('expands LF-normalized content to CRLF', () => {
    // encodeForWrite is only ever fed content from decodeForEdit, which
    // guarantees LF-only. It deliberately does NOT re-normalize: doing so would
    // eat a pre-existing lone CR (see the ambiguous-line-endings case).
    const encoding = {
      bom: false,
      lineEnding: 'crlf' as const,
      finalNewline: true,
      mixedLineEndings: false,
    };
    expect(encodeForWrite('a\nb\n', encoding).toString('utf8')).toBe('a\r\nb\r\n');
  });

  it('reports encoding details on read', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('x\r\ny', 'utf8')]);
    const { content, encoding } = decodeForEdit(buf);

    expect(content).toBe('x\ny');
    expect(encoding).toEqual({
      bom: true,
      lineEnding: 'crlf',
      finalNewline: false,
      mixedLineEndings: false,
    });
  });
});

describe('non-editable files', () => {
  it('refuses a file containing NUL bytes', async () => {
    const filePath = await fixture('image.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a]));
    const read = await readFileForEdit(filePath);

    expect(read.editable).toBe(false);
    expect(read.reason).toBe('binary');
    expect(read.content).toBeUndefined();
  });

  it('refuses a file that is not valid UTF-8', async () => {
    // Lone 0xFF is invalid UTF-8; decoding would replace it with U+FFFD and
    // saving would silently corrupt the file.
    const filePath = await fixture('latin1.txt', Buffer.from([0x68, 0x69, 0xff, 0x0a]));
    const read = await readFileForEdit(filePath);

    expect(read.editable).toBe(false);
    expect(read.reason).toBe('not-utf8');
  });

  it('accepts valid multi-byte UTF-8', () => {
    expect(classifyBuffer(Buffer.from('日本語 🚀', 'utf8'))).toEqual({ ok: true });
  });
});

describe('atomic write', () => {
  it('preserves restrictive file permissions', async () => {
    const filePath = await fixture('id_rsa', 'PRIVATE KEY\n');
    await fs.chmod(filePath, 0o600);

    const read = await readFileForEdit(filePath);
    await writeFileAtomic({
      filePath,
      content: 'PRIVATE KEY EDITED\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    const stats = await fs.stat(filePath);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it('writes through a symlink instead of replacing it', async () => {
    const target = await fixture('real.txt', 'original\n');
    const link = path.join(tmpDir, 'link.txt');
    await fs.symlink(target, link);

    const read = await readFileForEdit(link);
    await writeFileAtomic({
      filePath: link,
      content: 'updated\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    // The symlink survives and the file it points at received the edit.
    expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
    expect(await fs.readFile(target, 'utf8')).toBe('updated\n');
  });

  it('writes through a hardlink without detaching it', async () => {
    // rename() rebinds the name to a new inode, so every other name for the old
    // inode would keep the stale content -- silently detaching a dotfile from
    // the repo it is linked into.
    const a = await fixture('linked-a.txt', 'shared original\n');
    const b = path.join(tmpDir, 'linked-b.txt');
    await fs.link(a, b);

    const inodeBefore = (await fs.stat(a)).ino;

    const read = await readFileForEdit(a);
    const result = await writeFileAtomic({
      filePath: a,
      content: 'shared edited\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    expect(result.success).toBe(true);
    // Same inode, and both names see the edit.
    expect((await fs.stat(a)).ino).toBe(inodeBefore);
    expect(await fs.readFile(a, 'utf8')).toBe('shared edited\n');
    expect(await fs.readFile(b, 'utf8')).toBe('shared edited\n');
  });

  it('follows a multi-hop symlink chain', async () => {
    const target = await fixture('chain-target.txt', 'original\n');
    const mid = path.join(tmpDir, 'chain-mid.txt');
    const outer = path.join(tmpDir, 'chain-outer.txt');
    await fs.symlink(target, mid);
    await fs.symlink(mid, outer);

    const read = await readFileForEdit(outer);
    await writeFileAtomic({
      filePath: outer,
      content: 'edited\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    expect((await fs.lstat(outer)).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(mid)).isSymbolicLink()).toBe(true);
    expect(await fs.readFile(target, 'utf8')).toBe('edited\n');
  });

  it('creates the temp file with the final mode, never world-readable', async () => {
    // The plaintext of a 0600 key must not sit at 0644 mid-write.
    const filePath = await fixture('secret.key', 'SECRET\n');
    await fs.chmod(filePath, 0o600);

    const read = await readFileForEdit(filePath);
    await writeFileAtomic({
      filePath,
      content: 'SECRET EDITED\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    expect((await fs.stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it('leaves no temp files behind', async () => {
    const filePath = await fixture('clean.txt', 'a\n');
    const read = await readFileForEdit(filePath);

    await writeFileAtomic({
      filePath,
      content: 'b\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    const leftovers = (await fs.readdir(tmpDir)).filter(n => n.includes('barnacles-'));
    expect(leftovers).toEqual([]);
  });

  it('reports not-found for a file that has been deleted', async () => {
    const result = await writeFileAtomic({
      filePath: path.join(tmpDir, 'gone.txt'),
      content: 'x',
      encoding: { bom: false, lineEnding: 'lf', finalNewline: true, mixedLineEndings: false },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not-found');
  });
});

describe('conflict detection', () => {
  it('refuses to write when the file changed on disk', async () => {
    const filePath = await fixture('conflict.txt', 'original\n');
    const read = await readFileForEdit(filePath);

    // Someone else edits the file after we opened it.
    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(filePath, 'changed elsewhere\n');

    const result = await writeFileAtomic({
      filePath,
      content: 'my edit\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('conflict');
    // The external change must survive untouched.
    expect(await fs.readFile(filePath, 'utf8')).toBe('changed elsewhere\n');
  });

  it('overwrites when force is set', async () => {
    const filePath = await fixture('force.txt', 'original\n');
    const read = await readFileForEdit(filePath);

    await new Promise(resolve => setTimeout(resolve, 10));
    await fs.writeFile(filePath, 'changed elsewhere\n');

    const result = await writeFileAtomic({
      filePath,
      content: 'my edit\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
      force: true,
    });

    expect(result.success).toBe(true);
    expect(await fs.readFile(filePath, 'utf8')).toBe('my edit\n');
  });

  it('writes when the file is untouched', async () => {
    const filePath = await fixture('stable.txt', 'original\n');
    const read = await readFileForEdit(filePath);

    const result = await writeFileAtomic({
      filePath,
      content: 'edited\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    expect(result.success).toBe(true);
    expect(await fs.readFile(filePath, 'utf8')).toBe('edited\n');
  });
});

describe('backups', () => {
  it('copies the original aside on first write', async () => {
    const filePath = await fixture('backed-up.txt', 'original\n');
    const read = await readFileForEdit(filePath);

    const result = await writeFileAtomic({
      filePath,
      content: 'edited\n',
      encoding: read.encoding!,
      expectedMtimeMs: read.mtimeMs,
      expectedSize: read.size,
    });

    expect(result.backupPath).toBeDefined();
    // The backup holds the pre-edit contents.
    expect(await fs.readFile(result.backupPath!, 'utf8')).toBe('original\n');
  });

  it('retains at most five backups per file', async () => {
    const filePath = await fixture('churn.txt', 'v0\n');

    for (let i = 1; i <= 6; i++) {
      resetBackupSessionState(); // simulate a fresh session each time
      const read = await readFileForEdit(filePath);
      await writeFileAtomic({
        filePath,
        content: `v${i}\n`,
        encoding: read.encoding!,
        expectedMtimeMs: read.mtimeMs,
        expectedSize: read.size,
      });
      // Timestamps are second-resolution in the filename; keep them distinct.
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    const backups = (await fs.readdir(backupsDir)).sort();
    expect(backups.length).toBe(5);

    // The oldest must be the one pruned: asserting only the count would pass
    // even if the sort order were reversed and the newest were deleted.
    const contents = await Promise.all(
      backups.map(name => fs.readFile(path.join(backupsDir, name), 'utf8'))
    );
    // Six writes from v0: backups hold the pre-edit states v0..v5, newest five
    // are v1..v5 after pruning v0.
    expect(contents).toEqual(['v1\n', 'v2\n', 'v3\n', 'v4\n', 'v5\n']);
  });

  it('backs up only once per file per session', async () => {
    const filePath = await fixture('once.txt', 'original\n');

    for (let i = 0; i < 3; i++) {
      const read = await readFileForEdit(filePath);
      await writeFileAtomic({
        filePath,
        content: `edit ${i}\n`,
        encoding: read.encoding!,
        expectedMtimeMs: read.mtimeMs,
        expectedSize: read.size,
      });
    }

    const backups = await fs.readdir(backupsDir);
    expect(backups.length).toBe(1);
    expect(await fs.readFile(path.join(backupsDir, backups[0]), 'utf8')).toBe('original\n');
  });
});

describe('isSensitivePath', () => {
  it.each([
    '/Users/me/.ssh/id_rsa',
    '/Users/me/.ssh/config',
    '/Users/me/.gnupg/gpg.conf',
    '/Users/me/.aws/credentials',
    '/Users/me/.config/gcloud/configurations/config_default',
    '/Users/me/.netrc',
    '/Users/me/certs/server.pem',
    '/Users/me/certs/server.key',
    '/Users/me/project/id_ed25519',
    // macOS and Windows are case-insensitive, so these ARE the same files.
    '/Users/me/.SSH/config',
    '/Users/me/.Ssh/known_hosts',
    '/Users/me/.AWS/credentials',
    '/Users/me/.config/GCLOUD/configurations/config_default',
    '/Users/me/.NETRC',
    '/Users/me/.kube/config',
    '/Users/me/.git-credentials',
  ])('flags %s', filePath => {
    expect(isSensitivePath(filePath)).toBe(true);
  });

  it.each([
    '/Users/me/.zshrc',
    '/Users/me/.gitconfig',
    '/Users/me/.ssh_notes.md',
    '/Users/me/project/package.json',
    '/Users/me/project/id_rsa.pub',
  ])('does not flag %s', filePath => {
    expect(isSensitivePath(filePath)).toBe(false);
  });
});
