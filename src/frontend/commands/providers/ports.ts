import { Clipboard, Radio, Skull } from 'lucide-vue-next';
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
 * "Kill port 3000" from another app, without raising the window, is one of the
 * strongest reasons for the global hotkey to exist.
 */
export const portCommands = (ports: PortEntry[], deps: PortCommandDeps): Command[] =>
  ports.flatMap(entry => {
    const label = entry.scriptName || entry.processName;
    const keywords = [String(entry.port), entry.processName, entry.cwd ?? ''].filter(Boolean);

    return [
      {
        id: `port.kill:${entry.pid}`,
        title: `Kill port ${entry.port}`,
        subtitle: label,
        group: 'ports' as const,
        icon: Skull,
        keywords: [...keywords, 'stop', 'free', 'release'],
        run: async ctx => {
          await deps.killPort(entry.pid);
          ctx.dismiss();
        },
      },
      {
        id: `port.copy:${entry.pid}`,
        title: `Copy port ${entry.port}`,
        subtitle: label,
        group: 'ports' as const,
        icon: Clipboard,
        keywords: [...keywords, 'clipboard', 'number'],
        run: async ctx => {
          await deps.copyText(String(entry.port));
          ctx.dismiss();
        },
      },
      {
        id: `port.open:${entry.pid}`,
        title: `Open localhost:${entry.port}`,
        subtitle: label,
        group: 'ports' as const,
        icon: Radio,
        keywords: [...keywords, 'browser', 'url', 'visit'],
        run: async ctx => {
          await deps.openExternal(`http://localhost:${entry.port}`);
          ctx.dismiss();
        },
      },
    ];
  });
