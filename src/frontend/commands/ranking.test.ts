import { describe, expect, it } from 'vitest';
import {
  defaultCommands,
  effectiveScore,
  groupRankedCommands,
  MAX_PER_GROUP,
  MAX_RESULTS,
  type ScoredCommand,
} from './ranking';
import type { Command, CommandGroupId } from './types';

const command = (id: string, group: CommandGroupId, priority?: number): Command => ({
  id,
  title: id,
  group,
  priority,
  run: () => {},
});

const scored = (id: string, group: CommandGroupId, score: number, priority?: number) => ({
  item: command(id, group, priority),
  score,
});

describe('effectiveScore', () => {
  it('leaves a command without priority at its raw score', () => {
    expect(effectiveScore(scored('a', 'projects', 0.4))).toBe(0.4);
  });

  it('ranks a prioritized command ahead of an equally fuzzy one', () => {
    const plain = scored('a', 'projects', 0.4);
    const favorite = scored('b', 'projects', 0.4, 2);

    expect(effectiveScore(favorite)).toBeLessThan(effectiveScore(plain));
  });
});

describe('groupRankedCommands', () => {
  it('orders groups by their best hit rather than a fixed order', () => {
    // The projects hit is better, so Projects must come first even though
    // navigation appears earlier in the input.
    const groups = groupRankedCommands([
      scored('nav', 'navigation', 0.5),
      scored('proj', 'projects', 0.1),
    ]);

    expect(groups.map(group => group.id)).toEqual(['projects', 'navigation']);
  });

  it('caps each group so one project cannot crowd out other kinds of result', () => {
    const many: ScoredCommand[] = Array.from({ length: MAX_PER_GROUP + 4 }, (_, index) =>
      scored(`proj-${index}`, 'projects', 0.1 + index * 0.01)
    );

    const groups = groupRankedCommands([...many, scored('nav', 'navigation', 0.9)]);

    expect(groups[0].commands).toHaveLength(MAX_PER_GROUP);
    // The navigation hit still makes it in despite ranking below nine projects.
    expect(groups.map(group => group.id)).toContain('navigation');
  });

  it('keeps the best command within a group first', () => {
    const groups = groupRankedCommands([
      scored('worse', 'projects', 0.6),
      scored('better', 'projects', 0.1),
    ]);

    expect(groups[0].commands.map(entry => entry.id)).toEqual(['better', 'worse']);
  });

  it('stops at the overall result cap', () => {
    const groupIds: CommandGroupId[] = ['projects', 'processes', 'ports', 'navigation', 'app'];
    const entries = groupIds.flatMap(group =>
      Array.from({ length: MAX_PER_GROUP }, (_, index) => scored(`${group}-${index}`, group, 0.1))
    );

    const total = groupRankedCommands(entries).reduce(
      (count, group) => count + group.commands.length,
      0
    );

    expect(total).toBeLessThanOrEqual(MAX_RESULTS);
  });

  it('returns nothing for no matches', () => {
    expect(groupRankedCommands([])).toEqual([]);
  });

  it('drops duplicate ids, keeping the best-ranked one', () => {
    // Ids are the render keys. A provider emitting one twice would otherwise be
    // a duplicate-key warning plus a row that cannot be highlighted.
    const groups = groupRankedCommands([
      { item: { ...command('dupe', 'ports'), subtitle: 'worse' }, score: 0.6 },
      { item: { ...command('dupe', 'ports'), subtitle: 'better' }, score: 0.1 },
    ]);

    const commands = groups.flatMap(group => group.commands);
    expect(commands).toHaveLength(1);
    expect(commands[0].subtitle).toBe('better');
  });
});

describe('defaultCommands', () => {
  it('shows only prioritized commands, best first', () => {
    const groups = defaultCommands([
      command('inert', 'projects'),
      command('favorite', 'projects', 2),
      command('running', 'processes', 3),
    ]);

    const shown = groups.flatMap(group => group.commands.map(entry => entry.id));
    expect(shown).toEqual(['running', 'favorite']);
    expect(shown).not.toContain('inert');
  });

  it('is empty when nothing is prioritized', () => {
    expect(defaultCommands([command('a', 'projects'), command('b', 'ports')])).toEqual([]);
  });
});
