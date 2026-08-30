import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Drizzle applies a migration only when its journal `when` exceeds the newest
 * `created_at` already recorded in __drizzle_migrations
 * (drizzle-orm/sqlite-core/dialect.cjs: `Number(lastDbMigration[2]) < migration.folderMillis`).
 *
 * So a migration whose timestamp is lower than an already-applied one is
 * silently SKIPPED on existing databases while still working on fresh ones --
 * the app then runs against a missing table. Hand-written migrations pick their
 * own `when`, which makes this easy to get wrong. Pin the invariant.
 */
describe('migration journal', () => {
  const journalPath = path.join(process.cwd(), 'migrations', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as {
    entries: { idx: number; when: number; tag: string }[];
  };

  it('has strictly increasing `when` timestamps', () => {
    const outOfOrder = journal.entries
      .slice(1)
      .filter((entry, i) => entry.when <= journal.entries[i].when)
      .map(entry => entry.tag);

    expect(outOfOrder).toEqual([]);
  });

  it('has strictly increasing idx values with no gaps', () => {
    expect(journal.entries.map(e => e.idx)).toEqual(journal.entries.map((_, i) => i));
  });

  it('has a .sql file for every journal entry', () => {
    const missing = journal.entries
      .map(e => e.tag)
      .filter(tag => !fs.existsSync(path.join(process.cwd(), 'migrations', `${tag}.sql`)));

    expect(missing).toEqual([]);
  });

  it('has a journal entry for every .sql file', () => {
    const tags = new Set(journal.entries.map(e => e.tag));
    const unregistered = fs
      .readdirSync(path.join(process.cwd(), 'migrations'))
      .filter(f => f.endsWith('.sql'))
      .map(f => f.replace(/\.sql$/, ''))
      .filter(tag => !tags.has(tag));

    expect(unregistered).toEqual([]);
  });
});
