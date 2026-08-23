import { Hono } from 'hono';
import { BadRequestException } from '../exceptions/http-exceptions';
import { EVENT_SOURCES, EVENT_STATUSES, eventService } from '../services/event-service';
import type { EventInput, EventSource, EventStatus } from '../../shared/types/api';

const events = new Hono();

function parseSource(value: string | undefined): EventSource | undefined {
  if (!value) return undefined;
  if (!EVENT_SOURCES.includes(value as EventSource)) {
    throw new BadRequestException(`Invalid source: ${value}`);
  }
  return value as EventSource;
}

function parseStatus(value: string | undefined): EventStatus | undefined {
  if (!value) return undefined;
  if (!EVENT_STATUSES.includes(value as EventStatus)) {
    throw new BadRequestException(`Invalid status: ${value}`);
  }
  return value as EventStatus;
}

/**
 * Parse a non-negative integer query param.
 *
 * Rejects blanks, fractions, and negatives rather than passing them to SQLite,
 * where a negative offset surfaces as a 500 instead of a 400.
 */
function parseIntParam(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;

  const parsed = Number(value);
  if (value.trim() === '' || !Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestException(`Invalid ${label}: ${value}`);
  }

  return parsed;
}

/**
 * Validate one submitted event, throwing on anything malformed.
 */
function validateEventInput(raw: unknown, index: number): EventInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new BadRequestException(`events[${index}] must be an object`);
  }

  const input = raw as Record<string, unknown>;

  for (const field of ['source', 'category', 'name', 'status'] as const) {
    if (typeof input[field] !== 'string' || (input[field] as string).length === 0) {
      throw new BadRequestException(`events[${index}].${field} is required`);
    }
  }

  if (!EVENT_SOURCES.includes(input.source as EventSource)) {
    throw new BadRequestException(`events[${index}].source is invalid`);
  }

  if (!EVENT_STATUSES.includes(input.status as EventStatus)) {
    throw new BadRequestException(`events[${index}].status is invalid`);
  }

  return {
    source: input.source as EventSource,
    category: input.category as string,
    name: input.name as string,
    status: input.status as EventStatus,
    durationMs: typeof input.durationMs === 'number' ? input.durationMs : undefined,
    errorMessage: typeof input.errorMessage === 'string' ? input.errorMessage : undefined,
    clientName: typeof input.clientName === 'string' ? input.clientName : undefined,
    clientVersion: typeof input.clientVersion === 'string' ? input.clientVersion : undefined,
    metadata:
      typeof input.metadata === 'object' && input.metadata !== null
        ? (input.metadata as Record<string, unknown>)
        : undefined,
    occurredAt: typeof input.occurredAt === 'string' ? input.occurredAt : undefined,
  };
}

/**
 * GET /api/events/counts
 * Per-name usage aggregates. Declared before any parameterized route.
 */
events.get('/counts', async c => {
  const source = parseSource(c.req.query('source'));
  const since = c.req.query('since');

  const counts = await eventService.getEventCounts({ source, since });

  return c.json({ data: counts });
});

/**
 * GET /api/events/series
 * Day-bucketed counts over a trailing window, zero-filled.
 */
events.get('/series', async c => {
  const source = parseSource(c.req.query('source'));
  const name = c.req.query('name');
  const days = parseIntParam(c.req.query('days'), 'days');

  const series = await eventService.getEventSeries({ source, name, days });

  return c.json({ data: series });
});

/**
 * GET /api/events
 * List events newest-first with a total for pagination.
 */
events.get('/', async c => {
  const result = await eventService.listEvents({
    source: parseSource(c.req.query('source')),
    category: c.req.query('category'),
    name: c.req.query('name'),
    status: parseStatus(c.req.query('status')),
    since: c.req.query('since'),
    limit: parseIntParam(c.req.query('limit'), 'limit'),
    offset: parseIntParam(c.req.query('offset'), 'offset'),
  });

  return c.json({ data: result });
});

/**
 * POST /api/events
 * Batched ingest. Producers buffer and flush, so this takes an array.
 */
events.post('/', async c => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new BadRequestException('Invalid JSON body');
  }

  const payload = body as { events?: unknown };
  if (!Array.isArray(payload?.events)) {
    throw new BadRequestException('events must be an array');
  }

  const inputs = payload.events.map((raw, index) => validateEventInput(raw, index));

  const result = await eventService.recordEvents(inputs);

  if (!result.success) {
    throw new BadRequestException(result.error || 'Failed to record events');
  }

  return c.json({ data: { inserted: result.inserted } });
});

/**
 * DELETE /api/events
 * Clear the log, or prune with ?olderThanDays=N.
 */
events.delete('/', async c => {
  const source = parseSource(c.req.query('source'));
  const olderThanDays = parseIntParam(c.req.query('olderThanDays'), 'olderThanDays');

  if (olderThanDays !== undefined) {
    const result = await eventService.pruneEvents(olderThanDays);
    if (!result.success) {
      throw new BadRequestException(result.error || 'Failed to prune events');
    }
    return c.json({ data: { deleted: result.deleted } });
  }

  const result = await eventService.clearEvents({ source });

  return c.json({ data: { deleted: result.deleted } });
});

export default events;
