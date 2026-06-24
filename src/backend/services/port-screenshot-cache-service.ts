import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { and, asc, eq } from 'drizzle-orm';
import { db, getAppDataDir } from '../../shared/database/connection';
import { portScreenshots } from '../../shared/database/schema';

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_BYTES = 50 * 1024 * 1024; // 50MB

let cacheDir: string | null = null;

function getCacheDir(): string {
  if (!cacheDir) {
    cacheDir = path.join(getAppDataDir(), 'screenshot-cache');
  }
  return cacheDir;
}

async function ensureCacheDir(): Promise<string> {
  const dir = getCacheDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

interface CachedScreenshot {
  fileName: string;
  capturedAt: Date;
  width: number;
  height: number;
}

async function touchAccessed(id: string): Promise<void> {
  await db
    .update(portScreenshots)
    .set({ lastAccessedAt: new Date() })
    .where(eq(portScreenshots.id, id));
}

async function findRow(port: number, processName: string) {
  const [row] = await db
    .select()
    .from(portScreenshots)
    .where(and(eq(portScreenshots.port, port), eq(portScreenshots.processName, processName)))
    .limit(1);
  return row ?? null;
}

export async function getFresh(
  port: number,
  processName: string,
  signature: string | null
): Promise<CachedScreenshot | null> {
  const row = await findRow(port, processName);
  if (!row) return null;
  if (signature && row.contentSignature && row.contentSignature !== signature) return null;
  if (Date.now() - row.capturedAt.getTime() > TTL_MS) return null;

  await touchAccessed(row.id);
  return {
    fileName: row.fileName,
    capturedAt: row.capturedAt,
    width: row.width,
    height: row.height,
  };
}

export async function getStale(
  port: number,
  processName: string
): Promise<CachedScreenshot | null> {
  const row = await findRow(port, processName);
  if (!row) return null;

  await touchAccessed(row.id);
  return {
    fileName: row.fileName,
    capturedAt: row.capturedAt,
    width: row.width,
    height: row.height,
  };
}

export async function getByFileName(fileName: string): Promise<Buffer | null> {
  try {
    const dir = getCacheDir();
    return await fs.readFile(path.join(dir, fileName));
  } catch {
    return null;
  }
}

export function computeContentSignature(input: {
  etag?: string | null;
  lastModified?: string | null;
  contentLength?: string | null;
  bodyPrefix?: string;
}): string {
  const basis =
    input.etag || input.lastModified || input.contentLength
      ? `${input.etag ?? ''}|${input.lastModified ?? ''}|${input.contentLength ?? ''}`
      : (input.bodyPrefix ?? '');
  return createHash('sha1').update(basis).digest('hex');
}

export async function upsert(params: {
  port: number;
  processName: string;
  signature: string | null;
  jpegBuffer: Buffer;
  width: number;
  height: number;
}): Promise<CachedScreenshot> {
  const { port, processName, signature, jpegBuffer, width, height } = params;
  const dir = await ensureCacheDir();

  // Pick the id/fileName before the write so a screenshot is captured for an
  // existing row's id when one exists - but the insert/update itself must be
  // a single atomic statement keyed off the (port, processName) unique index,
  // not a separate read-then-write, otherwise two concurrent captures for the
  // same port can both see no existing row and race to insert.
  const existing = await findRow(port, processName);

  const id = existing?.id ?? randomBytes(12).toString('hex');
  const fileName = `${id}.jpg`;
  const finalPath = path.join(dir, fileName);
  const tmpPath = `${finalPath}.tmp-${randomBytes(6).toString('hex')}`;

  await fs.writeFile(tmpPath, jpegBuffer);
  await fs.rename(tmpPath, finalPath);

  const capturedAt = new Date();
  const fields = {
    contentSignature: signature,
    fileName,
    fileSize: jpegBuffer.length,
    width,
    height,
    capturedAt,
    lastAccessedAt: capturedAt,
  };

  await db
    .insert(portScreenshots)
    .values({ id, port, processName, ...fields })
    .onConflictDoUpdate({
      target: [portScreenshots.port, portScreenshots.processName],
      set: fields,
    });

  await evict();

  return { fileName, capturedAt, width, height };
}

async function deleteRowAndFile(row: { id: string; fileName: string }): Promise<void> {
  const dir = getCacheDir();
  try {
    await fs.unlink(path.join(dir, row.fileName));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  await db.delete(portScreenshots).where(eq(portScreenshots.id, row.id));
}

export async function evict(): Promise<void> {
  const rows = await db.select().from(portScreenshots).orderBy(asc(portScreenshots.lastAccessedAt));

  let totalBytes = rows.reduce((sum, r) => sum + r.fileSize, 0);
  let count = rows.length;

  for (const row of rows) {
    if (count <= MAX_CACHE_ENTRIES && totalBytes <= MAX_CACHE_BYTES) break;
    await deleteRowAndFile(row);
    count--;
    totalBytes -= row.fileSize;
  }
}

export async function sweepOrphans(): Promise<void> {
  const dir = await ensureCacheDir();

  const rows = await db.select().from(portScreenshots);
  const rowFileNames = new Set(rows.map(r => r.fileName));

  let filesOnDisk: string[];
  try {
    filesOnDisk = await fs.readdir(dir);
  } catch {
    filesOnDisk = [];
  }

  // Files with no matching DB row (e.g. left behind by a crash mid-write)
  for (const file of filesOnDisk) {
    if (file.endsWith('.jpg') && !rowFileNames.has(file)) {
      try {
        await fs.unlink(path.join(dir, file));
      } catch {
        // best-effort cleanup
      }
    }
  }

  // DB rows whose backing file is missing — drop the row so the next probe recaptures
  const diskFileSet = new Set(filesOnDisk);
  for (const row of rows) {
    if (!diskFileSet.has(row.fileName)) {
      await db.delete(portScreenshots).where(eq(portScreenshots.id, row.id));
    }
  }
}

// Negative cache for ports confirmed not to be HTTP, to avoid repeated failed-fetch timeouts
const nonHttpCache = new Map<number, number>(); // port -> expiry timestamp
const NON_HTTP_TTL_MS = 60 * 1000;

export function isKnownNonHttp(port: number): boolean {
  const expiry = nonHttpCache.get(port);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) {
    nonHttpCache.delete(port);
    return false;
  }
  return true;
}

export function markNonHttp(port: number): void {
  nonHttpCache.set(port, Date.now() + NON_HTTP_TTL_MS);
}

export function clearNonHttp(port: number): void {
  nonHttpCache.delete(port);
}
