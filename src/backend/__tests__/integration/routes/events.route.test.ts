import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationTestContext } from '@test/contexts';
import { del, get, post } from '@test/helpers/api-client';
import events from '@backend/routes/events';
import { events as eventsSchema, settings as settingsSchema } from '@shared/database/schema';
import { createEventData } from '@test/factories/event.factory';

/** Build a valid POST payload entry. */
function eventInput(overrides: Record<string, unknown> = {}) {
  return {
    source: 'mcp',
    category: 'tool_call',
    name: 'list_ports',
    status: 'success',
    durationMs: 12,
    clientName: 'claude-code',
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

describe('Events API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await context.setup(async () => {
      const { Hono } = await import('hono');
      const { errorHandler } = await import('@backend/middleware/error-handler');
      const app = new Hono();
      app.onError(errorHandler);
      app.route('/api/events', events);
      return app;
    });
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('POST /api/events', () => {
    it('records a batch of events', async () => {
      const { db, app } = context.get();

      const response = await post(app, '/api/events', {
        events: [eventInput(), eventInput({ name: 'list_projects' })],
      });

      expect(response.status).toBe(200);
      expect((response.data as any).data.inserted).toBe(2);

      const rows = await db.select().from(eventsSchema);
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.name).sort()).toEqual(['list_ports', 'list_projects']);
    });

    it('stores metadata as JSON and returns it parsed on read', async () => {
      const { app } = context.get();

      await post(app, '/api/events', {
        events: [eventInput({ metadata: { args: { path: '/tmp/demo' } } })],
      });

      const response = await get(app, '/api/events');
      const [event] = (response.data as any).data.events;

      expect(event.metadata).toEqual({ args: { path: '/tmp/demo' } });
    });

    it('drops oversized metadata rather than storing invalid JSON', async () => {
      const { app } = context.get();

      await post(app, '/api/events', {
        events: [eventInput({ metadata: { args: { blob: 'x'.repeat(5000) } } })],
      });

      const response = await get(app, '/api/events');
      const [event] = (response.data as any).data.events;

      expect(event.metadata).toEqual({ metadataOmitted: true, reason: 'too_large' });
    });

    it('truncates long error messages', async () => {
      const { db, app } = context.get();

      await post(app, '/api/events', {
        events: [eventInput({ status: 'error', errorMessage: 'e'.repeat(900) })],
      });

      const [row] = await db.select().from(eventsSchema);
      expect(row.errorMessage).toHaveLength(500);
    });

    it('clamps future timestamps to now', async () => {
      const { db, app } = context.get();
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

      await post(app, '/api/events', { events: [eventInput({ occurredAt: future })] });

      const [row] = await db.select().from(eventsSchema);
      expect(row.occurredAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('returns 400 when events is not an array', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/events', { events: 'nope' });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('events must be an array');
    });

    it('returns 400 when a required field is missing', async () => {
      const { app } = context.get();
      const { name: _omitted, ...withoutName } = eventInput();

      const response = await post(app, '/api/events', { events: [withoutName] });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('events[0].name is required');
    });

    it('returns 400 for an invalid source', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/events', {
        events: [eventInput({ source: 'malware' })],
      });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('events[0].source is invalid');
    });

    it('returns 400 for an invalid status', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/events', {
        events: [eventInput({ status: 'maybe' })],
      });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('events[0].status is invalid');
    });

    it('rejects batches larger than 200 events', async () => {
      const { db, app } = context.get();

      const response = await post(app, '/api/events', {
        events: Array.from({ length: 201 }, () => eventInput()),
      });

      expect(response.status).toBe(400);
      expect(await db.select().from(eventsSchema)).toHaveLength(0);
    });

    it('records nothing when usage logging is disabled', async () => {
      const { db, app } = context.get();

      await db.insert(settingsSchema).values({
        key: 'mcpUsageLogging',
        value: 'false',
        type: 'boolean',
      });

      const response = await post(app, '/api/events', { events: [eventInput()] });

      expect(response.status).toBe(200);
      expect((response.data as any).data.inserted).toBe(0);
      expect(await db.select().from(eventsSchema)).toHaveLength(0);
    });
  });

  describe('GET /api/events', () => {
    it('returns events newest-first with a total', async () => {
      const { db, app } = context.get();

      await db
        .insert(eventsSchema)
        .values([
          createEventData({ name: 'older', occurredAt: daysAgo(3) }),
          createEventData({ name: 'newer', occurredAt: daysAgo(1) }),
        ]);

      const response = await get(app, '/api/events');
      const body = (response.data as any).data;

      expect(response.status).toBe(200);
      expect(body.total).toBe(2);
      expect(body.events.map((e: any) => e.name)).toEqual(['newer', 'older']);
    });

    it('filters by name and status', async () => {
      const { db, app } = context.get();

      await db
        .insert(eventsSchema)
        .values([
          createEventData({ name: 'list_ports', status: 'success' }),
          createEventData({ name: 'list_ports', status: 'error' }),
          createEventData({ name: 'list_projects', status: 'error' }),
        ]);

      const response = await get(app, '/api/events?name=list_ports&status=error');
      const body = (response.data as any).data;

      expect(body.events).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it('paginates with limit and offset while reporting the full total', async () => {
      const { db, app } = context.get();

      await db
        .insert(eventsSchema)
        .values([1, 2, 3, 4, 5].map(n => createEventData({ occurredAt: daysAgo(n) })));

      const response = await get(app, '/api/events?limit=2&offset=2');
      const body = (response.data as any).data;

      expect(body.events).toHaveLength(2);
      expect(body.total).toBe(5);
    });

    it('excludes other sources when filtering by source', async () => {
      const { db, app } = context.get();

      await db
        .insert(eventsSchema)
        .values([
          createEventData({ source: 'mcp', name: 'list_ports' }),
          createEventData({ source: 'cli', category: 'command', name: 'status' }),
        ]);

      const response = await get(app, '/api/events?source=mcp');
      const body = (response.data as any).data;

      expect(body.events).toHaveLength(1);
      expect(body.events[0].name).toBe('list_ports');
    });

    it('returns 400 for malformed numeric params', async () => {
      const { app } = context.get();

      // A negative offset would otherwise reach SQLite and surface as a 500.
      for (const query of ['limit=-5', 'offset=-10', 'limit=1.5', 'limit=', 'limit=abc']) {
        const response = await get(app, `/api/events?${query}`);
        expect(response.status, query).toBe(400);
      }
    });

    it('returns 400 for an invalid source filter', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/events?source=bogus');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/events/counts', () => {
    it('aggregates totals, errors, duration and last-used per name', async () => {
      const { db, app } = context.get();

      await db.insert(eventsSchema).values([
        createEventData({
          name: 'list_ports',
          status: 'success',
          durationMs: 10,
          occurredAt: daysAgo(2),
        }),
        createEventData({
          name: 'list_ports',
          status: 'error',
          durationMs: 30,
          occurredAt: daysAgo(1),
        }),
        createEventData({ name: 'list_projects', status: 'success', durationMs: 5 }),
      ]);

      const response = await get(app, '/api/events/counts?source=mcp');
      const counts = (response.data as any).data;

      const ports = counts.find((c: any) => c.name === 'list_ports');
      expect(ports.total).toBe(2);
      expect(ports.errors).toBe(1);
      expect(ports.avgDurationMs).toBe(20);
      // Guards against unit-conversion bugs: must be a real recent date, not a
      // far-future timestamp from treating seconds as milliseconds.
      const lastUsed = new Date(ports.lastUsedAt);
      expect(lastUsed.getFullYear()).toBe(new Date().getFullYear());
      expect(lastUsed.getTime()).toBeGreaterThan(daysAgo(2).getTime());
      expect(lastUsed.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

      const projects = counts.find((c: any) => c.name === 'list_projects');
      expect(projects.total).toBe(1);
      expect(projects.errors).toBe(0);
    });
  });

  describe('GET /api/events/series', () => {
    it('returns a contiguous zero-filled series', async () => {
      const { db, app } = context.get();

      await db
        .insert(eventsSchema)
        .values([
          createEventData({ occurredAt: new Date() }),
          createEventData({ occurredAt: new Date() }),
        ]);

      const response = await get(app, '/api/events/series?source=mcp&days=7');
      const series = (response.data as any).data;

      expect(series).toHaveLength(7);
      expect(series[series.length - 1].total).toBe(2);
      // Every bucket present, including days with no activity
      expect(series.every((b: any) => typeof b.total === 'number')).toBe(true);
      expect(series.slice(0, 6).every((b: any) => b.total === 0)).toBe(true);
    });

    it('caps the window at 90 days', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/events/series?days=500');

      expect((response.data as any).data).toHaveLength(90);
    });
  });

  describe('DELETE /api/events', () => {
    it('prunes only events older than the cutoff', async () => {
      const { db, app } = context.get();

      await db
        .insert(eventsSchema)
        .values([
          createEventData({ name: 'old', occurredAt: daysAgo(40) }),
          createEventData({ name: 'recent', occurredAt: daysAgo(1) }),
        ]);

      const response = await del(app, '/api/events?olderThanDays=30');

      expect((response.data as any).data.deleted).toBe(1);
      const remaining = await db.select().from(eventsSchema);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('recent');
    });

    it('clears only the requested source', async () => {
      const { db, app } = context.get();

      await db
        .insert(eventsSchema)
        .values([
          createEventData({ source: 'mcp' }),
          createEventData({ source: 'cli', category: 'command' }),
        ]);

      await del(app, '/api/events?source=mcp');

      const remaining = await db.select().from(eventsSchema);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].source).toBe('cli');
    });
  });
});
