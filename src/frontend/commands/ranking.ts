import type { Command, CommandGroupId } from './types';
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
  commands: Command[];
}

/** A Fuse result, narrowed to what ranking needs. */
export interface ScoredCommand {
  item: Command;
  score?: number;
}

/**
 * Blend a command's priority into its Fuse score. Fuse scores are
 * "lower is better" (0 is perfect), so priority subtracts.
 */
export const effectiveScore = (scored: ScoredCommand): number =>
  (scored.score ?? 0) - (scored.item.priority ?? 0) * 0.05;

/**
 * Turn a flat, globally-ranked result list into display groups.
 *
 * Group order follows the best hit in each group rather than a fixed list, so
 * typing an exact project name puts Projects first instead of burying it under
 * whichever group happens to sort earlier. Each group is capped so one project
 * matching six ways can't crowd out every other kind of result.
 */
export const groupRankedCommands = (scored: ScoredCommand[]): RankedGroup[] => {
  const ordered = [...scored].sort((a, b) => effectiveScore(a) - effectiveScore(b));

  const groups = new Map<CommandGroupId, Command[]>();
  let taken = 0;

  for (const entry of ordered) {
    if (taken >= MAX_RESULTS) break;
    const existing = groups.get(entry.item.group);
    if (existing) {
      if (existing.length >= MAX_PER_GROUP) continue;
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
 */
export const defaultCommands = (commands: Command[]): RankedGroup[] => {
  const byPriority = [...commands]
    .filter(command => (command.priority ?? 0) > 0)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, MAX_DEFAULT_RESULTS);

  // A flat score leaves effectiveScore ordering purely by priority, preserving
  // the sort above.
  return groupRankedCommands(byPriority.map(item => ({ item, score: 0 })));
};
