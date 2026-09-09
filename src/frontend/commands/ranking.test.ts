import { describe, expect, it } from 'vitest';
import {
  defaultCommands,
  effectiveScore,
  groupRankedCommands,
  levelDefaultItems,
  MAX_DEFAULT_RESULTS,
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

  it('still applies the per-group cap, so one group cannot fill the list', () => {
    // MAX_DEFAULT_RESULTS is an upper bound, not a target: someone with a dozen
    // favourite projects sees five, not twelve. The existing tests all used
    // fewer commands than the cap, so this went unexercised.
    const favourites = Array.from({ length: MAX_DEFAULT_RESULTS }, (_, index) =>
      command(`fav-${index}`, 'projects', 2)
    );

    const shown = defaultCommands(favourites).flatMap(group => group.commands);

    expect(shown).toHaveLength(MAX_PER_GROUP);
  });

  it('is empty when nothing is prioritized', () => {
    expect(defaultCommands([command('a', 'projects'), command('b', 'ports')])).toEqual([]);
  });
});

describe('grouping limits', () => {
  it('lifts the per-group cap when asked', () => {
    // A nested level is a curated list of one item's actions. Capping it at
    // five would silently hide a sixth installed IDE from its own picker.
    const many: ScoredCommand[] = Array.from({ length: MAX_PER_GROUP + 3 }, (_, index) =>
      scored(`ide-${index}`, 'projects', 0.1)
    );

    const groups = groupRankedCommands(many, { maxPerGroup: Number.POSITIVE_INFINITY });

    expect(groups[0].commands).toHaveLength(MAX_PER_GROUP + 3);
  });

  it('still applies the default cap when no limits are given', () => {
    const many: ScoredCommand[] = Array.from({ length: MAX_PER_GROUP + 3 }, (_, index) =>
      scored(`ide-${index}`, 'projects', 0.1)
    );

    expect(groupRankedCommands(many)[0].commands).toHaveLength(MAX_PER_GROUP);
  });
});

describe('levelDefaultItems', () => {
  it('shows every action, including the unprioritized ones', () => {
    // defaultCommands filters to priority > 0, which is right for the root and
    // would leave a level empty -- an item's actions rarely carry a priority.
    const items = [
      command('reveal', 'projects'),
      command('copy-path', 'projects'),
      command('open-ide', 'projects'),
    ];

    const shown = levelDefaultItems(items).flatMap(group => group.commands);

    expect(shown).toHaveLength(3);
  });

  it('keeps more actions than a root group would allow', () => {
    const items = Array.from({ length: MAX_PER_GROUP + 2 }, (_, index) =>
      command(`ide-${index}`, 'projects')
    );

    expect(levelDefaultItems(items).flatMap(group => group.commands)).toHaveLength(
      MAX_PER_GROUP + 2
    );
  });

  it('groups actions so a level can separate them visually', () => {
    // "Set as default" rows sit in their own group to read as a distinct block.
    const items = [command('open-ide', 'projects'), command('set-default', 'app')];

    expect(levelDefaultItems(items)).toHaveLength(2);
  });
});

describe('defaultCommands budget', () => {
  it('drops a group that would only partly fit', () => {
    // A busy machine used to spend the whole budget on running processes and
    // favourites, leaving a lone "Dashboard" under "Go to" -- which reads as a
    // glitch rather than a shortcut.
    const many = [
      ...Array.from({ length: 5 }, (_, i) => command(`proc-${i}`, 'processes', 3)),
      ...Array.from({ length: 5 }, (_, i) => command(`fav-${i}`, 'projects', 2)),
      ...Array.from({ length: 5 }, (_, i) => command(`nav-${i}`, 'navigation', 1)),
    ];

    const groups = defaultCommands(many);
    const shown = groups.flatMap(group => group.commands);

    expect(shown.length).toBeLessThanOrEqual(MAX_DEFAULT_RESULTS);
    // Either a group is properly represented or it is absent.
    for (const group of groups) {
      expect(group.commands.length).toBe(MAX_PER_GROUP);
    }
  });

  it('keeps whole groups while they fit', () => {
    const commands = [
      ...Array.from({ length: 3 }, (_, i) => command(`nav-${i}`, 'navigation', 1)),
      ...Array.from({ length: 3 }, (_, i) => command(`app-${i}`, 'app', 1)),
    ];

    expect(defaultCommands(commands).map(group => group.id)).toEqual(['navigation', 'app']);
  });

  it('shows the leading group even when it alone fills the budget', () => {
    // Never render an empty palette: the top group is still the most useful
    // thing available.
    const commands = Array.from({ length: MAX_DEFAULT_RESULTS + 5 }, (_, i) =>
      command(`fav-${i}`, 'projects', 2)
    );

    expect(defaultCommands(commands)).toHaveLength(1);
  });
});
