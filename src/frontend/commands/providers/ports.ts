import { Clipboard, Link, Radio, Skull } from 'lucide-vue-next';
import type { PortEntry } from '../../../shared/types/api';
import type { Command } from '../types';

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
          icon: Clipboard,
          primaryActionLabel: 'Copy',
          run: async ctx => {
            await deps.copyText(String(entry.port));
            ctx.dismiss();
          },
        },
        {
          id: `port.copy-url:${entry.pid}:${entry.port}`,
          title: 'Copy URL',
          subtitle: url,
          group: 'ports' as const,
          icon: Link,
          primaryActionLabel: 'Copy',
          run: async ctx => {
            await deps.copyText(url);
            ctx.dismiss();
          },
        },
        {
          id: `port.kill:${entry.pid}:${entry.port}`,
          title: `Kill Port ${entry.port}`,
          subtitle: label,
          group: 'ports' as const,
          icon: Skull,
          primaryActionLabel: 'Kill',
          run: async ctx => {
            await deps.killPort(entry.pid);
            ctx.dismiss();
          },
        },
      ],
    };
  });
