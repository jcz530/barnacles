import { and, avg, count, desc, eq, gte, lt, max, sql } from 'drizzle-orm';
import { db } from '../../shared/database/connection';
import { events } from '../../shared/database/schema';
import { settingsService } from './settings-service';
import { SETTING_KEYS } from '../../shared/types/api';
import type {
  EventBucket,
  EventCount,
  EventInput,
  EventListFilter,
  EventListResponse,
  EventRecord,
  EventSource,
  EventStatus,
} from '../../shared/types/api';

/** Producers are told to cap payloads; these are enforced again server-side. */
const MAX_BATCH_SIZE = 200;
const MAX_METADATA_BYTES = 2048;
const MAX_ERROR_MESSAGE_CHARS = 500;
const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 50;
const MAX_SERIES_DAYS = 90;
const DEFAULT_SERIES_DAYS = 14;

export const EVENT_SOURCES: EventSource[] = ['mcp', 'cli', 'app', 'api'];
export const EVENT_STATUSES: EventStatus[] = ['success', 'error'];

type EventRow = typeof events.$inferSelect;

/**
 * Serialize a metadata object, dropping it entirely if it exceeds the byte cap.
 *
 * Truncating serialized JSON mid-string would produce something unparseable, so
 * an oversized payload is replaced by a marker rather than cut short.
 */
function serializeMetadata(metadata?: Record<string, unknown> | null): string | null {
  if (!metadata) return null;

  try {
    const json = JSON.stringify(metadata);
    if (Buffer.byteLength(json, 'utf8') <= MAX_METADATA_BYTES) {
      return json;
    }
    return JSON.stringify({ metadataOmitted: true, reason: 'too_large' });
  } catch {
    return JSON.stringify({ metadataOmitted: true, reason: 'unserializable' });
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toEventRecord(row: EventRow): EventRecord {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    name: row.name,
    status: row.status,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    clientName: row.clientName,
    clientVersion: row.clientVersion,
    metadata: parseMetadata(row.metadata),
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

/**
 * Fill gaps in a day-bucketed series so the chart gets a contiguous array.
 *
 * SQLite can group by day cheaply but zero-filling in SQL needs a recursive CTE,
 * which isn't worth it at this scale — do it here instead.
 */
export function zeroFillSeries(
  rows: {
    date: string;
    total: number;
    errors: number;
    avgDurationMs: number | null;
    toolsUsed: number;
  }[],
  days: number,
  today: Date = new Date()
): EventBucket[] {
  const byDate = new Map(rows.map(row => [row.date, row]));
  const buckets: EventBucket[] = [];

  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));

  for (let i = 0; i < days; i++) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;

    const row = byDate.get(key);
    buckets.push({
      date: key,
      total: row?.total ?? 0,
      errors: row?.errors ?? 0,
      // A day with no calls has no average to report — null, not 0, so the
      // chart can tell "fast" apart from "idle".
      avgDurationMs: row?.avgDurationMs ?? null,
      toolsUsed: row?.toolsUsed ?? 0,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

class EventService {
  /**
   * Record a batch of events.
   *
   * Checks the logging setting here rather than trusting producers, so turning
   * logging off is authoritative even for an older CLI binary still emitting.
   */
  async recordEvents(
    inputs: EventInput[]
  ): Promise<{ success: boolean; inserted: number; error?: string }> {
    if (inputs.length === 0) {
      return { success: true, inserted: 0 };
    }

    if (inputs.length > MAX_BATCH_SIZE) {
      return { success: false, inserted: 0, error: `Batch exceeds ${MAX_BATCH_SIZE} events` };
    }

    const loggingEnabled = await settingsService.getValue<boolean>(SETTING_KEYS.MCP_USAGE_LOGGING);
    if (loggingEnabled === false) {
      return { success: true, inserted: 0 };
    }

    const now = new Date();
    const values = inputs.map(input => {
      // Clamp future timestamps so a skewed producer clock can't stretch the chart axis.
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : now;
      const validOccurredAt =
        Number.isNaN(occurredAt.getTime()) || occurredAt > now ? now : occurredAt;

      return {
        source: input.source,
        category: input.category,
        name: input.name,
        status: input.status,
        durationMs: input.durationMs ?? null,
        errorMessage: input.errorMessage?.slice(0, MAX_ERROR_MESSAGE_CHARS) ?? null,
        clientName: input.clientName ?? null,
        clientVersion: input.clientVersion ?? null,
        metadata: serializeMetadata(input.metadata),
        occurredAt: validOccurredAt,
      };
    });

    await db.insert(events).values(values);

    return { success: true, inserted: values.length };
  }

  /**
   * List events newest-first, with the total matching the filter for pagination.
   */
  async listEvents(filter: EventListFilter = {}): Promise<EventListResponse> {
    const conditions = [];
    if (filter.source) conditions.push(eq(events.source, filter.source));
    if (filter.category) conditions.push(eq(events.category, filter.category));
    if (filter.name) conditions.push(eq(events.name, filter.name));
    if (filter.status) conditions.push(eq(events.status, filter.status));
    if (filter.since) {
      const since = new Date(filter.since);
      if (!Number.isNaN(since.getTime())) conditions.push(gte(events.occurredAt, since));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const offset = filter.offset ?? 0;

    const rows = await db
      .select()
      .from(events)
      .where(where)
      .orderBy(desc(events.occurredAt))
      .limit(limit)
      .offset(offset);

    const [totals] = await db.select({ value: count() }).from(events).where(where);

    return {
      events: rows.map(toEventRecord),
      total: totals?.value ?? 0,
    };
  }

  /**
   * Aggregate per-name usage counts.
   *
   * Grouped in SQL — pulling every row to count in JS would mean shipping the
   * whole table over HTTP on each poll.
   */
  async getEventCounts(
    filter: { source?: EventSource; since?: string } = {}
  ): Promise<EventCount[]> {
    const conditions = [];
    if (filter.source) conditions.push(eq(events.source, filter.source));
    if (filter.since) {
      const since = new Date(filter.since);
      if (!Number.isNaN(since.getTime())) conditions.push(gte(events.occurredAt, since));
    }

    const rows = await db
      .select({
        name: events.name,
        total: count(),
        errors: sql<number>`sum(case when ${events.status} = 'error' then 1 else 0 end)`,
        avgDurationMs: avg(events.durationMs),
        lastUsedAt: max(events.occurredAt),
      })
      .from(events)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(events.name);

    return rows.map(row => ({
      name: row.name,
      total: Number(row.total ?? 0),
      errors: Number(row.errors ?? 0),
      avgDurationMs: row.avgDurationMs === null ? null : Math.round(Number(row.avgDurationMs)),
      // Drizzle maps a `timestamp` column through max() back to a Date already.
      lastUsedAt: row.lastUsedAt instanceof Date ? row.lastUsedAt : null,
    }));
  }

  /**
   * Day-bucketed counts over a trailing window, zero-filled.
   */
  async getEventSeries(
    filter: { source?: EventSource; name?: string; days?: number } = {}
  ): Promise<EventBucket[]> {
    const days = Math.min(Math.max(filter.days ?? DEFAULT_SERIES_DAYS, 1), MAX_SERIES_DAYS);

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const conditions = [gte(events.occurredAt, since)];
    if (filter.source) conditions.push(eq(events.source, filter.source));
    if (filter.name) conditions.push(eq(events.name, filter.name));

    const bucket = sql<string>`date(${events.occurredAt}, 'unixepoch', 'localtime')`;

    const rows = await db
      .select({
        date: bucket,
        total: count(),
        errors: sql<number>`sum(case when ${events.status} = 'error' then 1 else 0 end)`,
        avgDurationMs: avg(events.durationMs),
        toolsUsed: sql<number>`count(distinct ${events.name})`,
      })
      .from(events)
      .where(and(...conditions))
      .groupBy(bucket);

    return zeroFillSeries(
      rows.map(row => ({
        date: row.date,
        total: Number(row.total ?? 0),
        errors: Number(row.errors ?? 0),
        avgDurationMs: row.avgDurationMs === null ? null : Math.round(Number(row.avgDurationMs)),
        toolsUsed: Number(row.toolsUsed ?? 0),
      })),
      days
    );
  }

  /**
   * Delete events older than the retention window.
   */
  async pruneEvents(
    olderThanDays: number
  ): Promise<{ success: boolean; deleted: number; error?: string }> {
    if (!Number.isFinite(olderThanDays) || olderThanDays < 0) {
      return { success: false, deleted: 0, error: 'olderThanDays must be a non-negative number' };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await db.delete(events).where(lt(events.occurredAt, cutoff));

    return { success: true, deleted: result.changes ?? 0 };
  }

  /**
   * Delete events, optionally limited to one source. Powers the "Clear log" action.
   *
   * With no `source` this intentionally clears the whole table — callers that
   * mean "just my source" must pass one.
   */
  async clearEvents(
    filter: { source?: EventSource } = {}
  ): Promise<{ success: boolean; deleted: number }> {
    const result = await db
      .delete(events)
      .where(filter.source ? eq(events.source, filter.source) : undefined);

    return { success: true, deleted: result.changes ?? 0 };
  }
}

export const eventService = new EventService();
