import { Copy, Radio, Skull } from 'lucide-vue-next';
import type { PortEntry } from '../../../shared/types/api';
import { truncateValue } from '../useCommandStatus';
import type { Command, CommandContext } from '../types';

export interface PortCommandDeps {
  killPort: (pid: number) => void | Promise<void>;
  copyText: (text: string) => void | Promise<void>;
  openExternal: (url: string) => void | Promise<void>;
}

/**
 * Commands for ports currently being listened on.
 *
 * One row per port, with its verbs behind that row's actions. Killing lives
 * there rather than on the row itself: it is the destructive one, and as a
 * top-level entry it sat one Enter away from a fuzzy match on a number.
 *
 * "Kill port 3000" from another app, without raising the window, is still one
 * of the strongest reasons for the global hotkey to exist -- it is now two
 * keystrokes rather than one.
 *
 * Ids carry the port as well as the pid: one process commonly holds several
 * ports (IPv4 and IPv6 for the same server, or a dev server plus its HMR
 * socket), and keying on pid alone produces duplicates.
 */
/**
 * Copy, and say what happened either way.
 *
 * The palette stays open for these, so a failure has somewhere to be reported
 * -- and must be, or the row would look like it had simply ignored the press.
 */
const copyAction = async (
  ctx: CommandContext,
  copy: () => void | Promise<void>,
  label: string
): Promise<void> => {
  try {
    await copy();
    ctx.status(`Copied ${label}`);
  } catch {
    ctx.status(`Could not copy ${label}`, 'error');
  }
};

export const portCommands = (ports: PortEntry[], deps: PortCommandDeps): Command[] =>
  ports.map(entry => {
    const label = entry.scriptName || entry.processName;
    const url = `http://localhost:${entry.port}`;

    return {
      id: `port:${entry.pid}:${entry.port}`,
      title: `Port ${entry.port}`,
      subtitle: label,
      group: 'ports' as const,
      icon: Radio,
      keywords: [
        String(entry.port),
        entry.processName,
        entry.cwd ?? '',
        'kill',
        'stop',
        'free',
        'release',
        'browser',
        'url',
        'localhost',
      ].filter(Boolean),
      primaryActionLabel: 'Open in Browser',
      run: async ctx => {
        await deps.openExternal(url);
        ctx.dismiss();
      },
      actions: () => [
        {
          id: `port.open:${entry.pid}:${entry.port}`,
          title: `Open localhost:${entry.port}`,
          group: 'ports' as const,
          icon: Radio,
          primaryActionLabel: 'Open in Browser',
          run: async ctx => {
            await deps.openExternal(url);
            ctx.dismiss();
          },
        },
        {
          id: `port.copy:${entry.pid}:${entry.port}`,
          title: 'Copy Port Number',
          subtitle: String(entry.port),
          group: 'ports' as const,
          icon: Copy,
          primaryActionLabel: 'Copy',
          // Stays open. Nothing on screen changes when you copy, so closing
          // leaves no evidence it happened at all; the message is the whole
          // confirmation, and it needs somewhere to live.
          run: ctx => copyAction(ctx, () => deps.copyText(String(entry.port)), String(entry.port)),
        },
        {
          id: `port.copy-url:${entry.pid}:${entry.port}`,
          title: 'Copy URL',
          subtitle: url,
          group: 'ports' as const,
          // Copy rather than a link glyph: every row that puts something on the
          // clipboard draws the same thing, whatever the something is. The link
          // glyph belongs to rows that go somewhere -- see Open URL in processes.
          icon: Copy,
          primaryActionLabel: 'Copy',
          run: ctx => copyAction(ctx, () => deps.copyText(url), truncateValue(url)),
        },
        {
          id: `port.kill:${entry.pid}:${entry.port}`,
          title: `Kill Port ${entry.port}`,
          subtitle: label,
          group: 'ports' as const,
          icon: Skull,
          primaryActionLabel: 'Kill',
          // Stays open: the row leaving the list is the confirmation, and this
          // is the one command where "did that work?" is worth answering --
          // killing something that outlived the request is the whole point.
          //
          // The level this is run from collapses as the port disappears (its
          // subject is gone), which is why the status line does not clear on a
          // level change. See useCommandStatus.
          run: async ctx => {
            try {
              await deps.killPort(entry.pid);
              ctx.status(`Killed port ${entry.port}`);
            } catch {
              ctx.status(`Could not kill port ${entry.port}`, 'error');
            }
          },
        },
      ],
    };
  });
