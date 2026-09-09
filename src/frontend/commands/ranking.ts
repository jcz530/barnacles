import type { CommandGroupId, PaletteItem } from './types';
import { COMMAND_GROUP_LABELS } from './types';

/** Most results any one group contributes to a search. */
export const MAX_PER_GROUP = 5;
/** Most results shown overall for a search. */
export const MAX_RESULTS = 50;
/** Most results shown when nothing has been typed yet. */
export const MAX_DEFAULT_RESULTS = 12;

export interface RankedGroup {
  id: CommandGroupId;
  label: string;
  commands: PaletteItem[];
}

/** A Fuse result, narrowed to what ranking needs. */
export interface ScoredCommand {
  item: PaletteItem;
  score?: number;
}

/**
 * Blend a command's priority into its Fuse score. Fuse scores are
 * "lower is better" (0 is perfect), so priority subtracts.
 */
export const effectiveScore = (scored: ScoredCommand): number =>
  (scored.score ?? 0) - (scored.item.priority ?? 0) * 0.05;

export interface GroupingLimits {
  /** Most results any one group contributes. */
  maxPerGroup?: number;
  /** Most results overall. */
  maxResults?: number;
}

/** A level shows all of its own items; see levelDefaultItems. */
export const LEVEL_LIMITS: GroupingLimits = {
  maxPerGroup: Number.POSITIVE_INFINITY,
  maxResults: Number.POSITIVE_INFINITY,
};

/**
 * Turn a flat, globally-ranked result list into display groups.
 *
 * Group order follows the best hit in each group rather than a fixed list, so
 * typing an exact project name puts Projects first instead of burying it under
 * whichever group happens to sort earlier. Each group is capped so one project
 * matching six ways can't crowd out every other kind of result.
 *
 * The caps are overridable because a nested level is already a short, curated
 * list -- capping the actions of one item would silently hide, say, a sixth
 * installed IDE from its own picker.
 *
 * Ids are deduplicated on the way through: they are the render keys, so a
 * provider emitting the same id twice would otherwise surface as a duplicate-key
 * warning and a row that cannot be highlighted.
 */
export const groupRankedCommands = (
  scored: ScoredCommand[],
  limits: GroupingLimits = {}
): RankedGroup[] => {
  const maxPerGroup = limits.maxPerGroup ?? MAX_PER_GROUP;
  const maxResults = limits.maxResults ?? MAX_RESULTS;

  const ordered = [...scored].sort((a, b) => effectiveScore(a) - effectiveScore(b));

  const groups = new Map<CommandGroupId, PaletteItem[]>();
  const seen = new Set<string>();
  let taken = 0;

  for (const entry of ordered) {
    if (taken >= maxResults) break;
    // Keeps the best-ranked of any duplicate, since ordered is sorted already.
    if (seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    const existing = groups.get(entry.item.group);
    if (existing) {
      if (existing.length >= maxPerGroup) continue;
      existing.push(entry.item);
    } else {
      // First hit for this group also fixes the group's position.
      groups.set(entry.item.group, [entry.item]);
    }
    taken += 1;
  }

  return [...groups.entries()].map(([id, commands]) => ({
    id,
    label: COMMAND_GROUP_LABELS[id],
    commands,
  }));
};

/**
 * What the palette shows before anything is typed: the highest-priority
 * commands, grouped. Dumping the whole registry here would be unreadable and
 * slow, since it can run to hundreds of entries.
 *
 * The per-group cap does the trimming, so twenty favourite projects show five
 * rows rather than crowding out everything else -- the empty state is meant to
 * be a sample of what the palette can do, not a project list.
 *
 * MAX_DEFAULT_RESULTS is applied after that capping rather than before it.
 * Truncating the ranked list up front let a busy machine spend the whole budget
 * on running processes and favourites, leaving the groups below them with a
 * row or two each -- a lone "Dashboard" under "Go to" reads as a glitch rather
 * than a shortcut. Capping first means each group is either properly
 * represented or absent.
 */
export const defaultCommands = (commands: PaletteItem[]): RankedGroup[] => {
  const byPriority = [...commands]
    .filter(command => (command.priority ?? 0) > 0)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // A flat score leaves effectiveScore ordering purely by priority, preserving
  // the sort above.
  const grouped = groupRankedCommands(byPriority.map(item => ({ item, score: 0 })));

  const kept: RankedGroup[] = [];
  let taken = 0;

  for (const group of grouped) {
    // A group that would only partly fit is left out entirely.
    if (taken + group.commands.length > MAX_DEFAULT_RESULTS) break;
    kept.push(group);
    taken += group.commands.length;
  }

  // Never show nothing: if the first group alone exceeds the budget it is still
  // the most useful thing there is, so keep it.
  return kept.length > 0 ? kept : grouped.slice(0, 1);
};

/**
 * What a nested level shows before anything is typed: everything it has.
 *
 * Unlike the root, a level is already a short hand-built list, so there is
 * nothing to trim and no priority to filter on -- an item's actions all matter
 * equally. Grouping still runs, to keep the labels and ordering consistent with
 * the root, but without the per-group cap.
 */
export const levelDefaultItems = (items: PaletteItem[]): RankedGroup[] =>
  groupRankedCommands(
    items.map(item => ({ item, score: 0 })),
    LEVEL_LIMITS
  );
