import { SquareTerminal, Terminal } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../shared/types/api';
import type { RunnableScript } from '../../../shared/types/process';
import type { Command, CommandContext } from '../types';

export interface ScriptCommandDeps {
  /**
   * Run a command as an ad-hoc process in `cwd`.
   *
   * Ad-hoc rather than a tracked one: createProcess mints a fresh
   * `adhoc-<timestamp>` id per call, so a script started here gets no
   * stop/restart of its own and leaves a new entry each run. That is how the
   * project page's script list already behaves; making it otherwise would mean
   * a different backend, not a different palette.
   */
  runScript: (projectId: string, cwd: string, command: string) => void | Promise<void>;
}

/** What the palette knows about each project's scripts. */
export interface ScriptCommandState {
  scripts: Record<string, RunnableScript[]>;
  /** Projects whose fetch is in flight. */
  loading: Record<string, boolean>;
}

/**
 * The "Run Script" row for a project's action level.
 *
 * One row that opens a level, rather than a script per row: a project commonly
 * has twenty-odd scripts -- build, lint, postinstall, prepare -- and a level
 * applies no per-group cap, so inlining them would bury the one or two
 * processes someone actually came for.
 */
export const scriptCommands = (
  project: ProjectWithDetails,
  state: ScriptCommandState,
  deps: ScriptCommandDeps
): Command[] => {
  const scripts = state.scripts[project.id];

  if (!scripts) {
    return state.loading[project.id]
      ? [
          {
            id: `script.loading:${project.id}`,
            title: 'Loading scripts…',
            group: 'processes' as const,
            loading: true,
          },
        ]
      : [];
  }

  // Nothing in the manifests, or no manifests at all.
  if (scripts.length === 0) return [];

  return [
    {
      id: `script.open:${project.id}`,
      title: 'Run Script',
      subtitle: `${scripts.length} ${scripts.length === 1 ? 'script' : 'scripts'}`,
      group: 'processes' as const,
      icon: Terminal,
      keywords: ['npm', 'yarn', 'pnpm', 'composer', 'script', 'run', 'task'],
      // No `run`: with a list this long there is no one script worth defaulting
      // to, so Enter opens the choice rather than guessing at it.
      primaryActionLabel: 'Choose',
      actions: () => scripts.map(script => scriptAction(project, script, deps)),
    },
  ];
};

const scriptAction = (
  project: ProjectWithDetails,
  script: RunnableScript,
  deps: ScriptCommandDeps
): Command => ({
  // The directory and source both belong in the id: a root and a workspace can
  // each define `build`, and so can package.json and composer.json.
  id: `script:${project.id}:${script.source}:${script.relativeDir}:${script.name}`,
  // Just the name -- the manifest it came from is the group heading above it,
  // the way the project page lists scripts.
  title: script.name,
  // The script body, which is what tells two similarly-named scripts apart.
  subtitle: script.script,
  group: 'processes' as const,
  // One section per manifest: forty scripts in one flat list is unreadable, and
  // a workspace's `build` needs to be distinguishable from the root's.
  groupLabel: `${script.manifest} Scripts`,
  // Bodies run to hundreds of characters; set opposite the name they leave
  // nothing of it.
  stackSubtitle: true,
  icon: SquareTerminal,
  keywords: [script.command, script.source, script.relativeDir, script.manifest].filter(Boolean),
  primaryActionLabel: 'Run',
  // Stays open, so several scripts can be started in a row -- and because a
  // script that fails to launch would otherwise close the palette as if it had
  // worked.
  run: async (ctx: CommandContext) => {
    const cwd = script.relativeDir ? `${project.path}/${script.relativeDir}` : project.path;
    try {
      await deps.runScript(project.id, cwd, script.command);
      ctx.status(`Started ${script.name}`);
    } catch {
      ctx.status(`Could not start ${script.name}`, 'error');
    }
  },
});
