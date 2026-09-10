import { ALL_NAV_ITEMS } from '@/constants/navigation';
import type { Command } from '../types';

/**
 * Destinations worth offering before anything is typed.
 *
 * Five, which is what one group can show, so the empty palette is a useful
 * starting point rather than a hint that you should type something.
 */
const DEFAULT_VISIBLE = new Set(['/', '/projects', '/terminals', '/ports', '/utilities']);

/**
 * Pages the app already has a keyboard shortcut for, so the palette can show
 * the faster way of getting there rather than being it.
 *
 * Only shortcuts the menu genuinely registers belong here -- a hint for a key
 * that does nothing is worse than no hint. See src/main/menu.ts.
 */
const ACCELERATORS: Record<string, string> = {
  '/settings': 'CommandOrControl+,',
};

/**
 * One command per navigable page, sourced from the same constants the sidebar
 * renders, so a new page appears here without a second edit.
 */
export const navigationCommands = (): Command[] =>
  ALL_NAV_ITEMS.map(item => ({
    id: `nav${item.url === '/' ? '.home' : item.url.replace(/\//g, '.')}`,
    title: item.title,
    group: 'navigation' as const,
    icon: item.icon,
    keywords: [...(item.keywords ?? []), 'go to', 'open', 'navigate'],
    priority: DEFAULT_VISIBLE.has(item.url) ? 1 : 0,
    primaryActionLabel: 'Go To',
    accelerator: ACCELERATORS[item.url],
    run: ctx => ctx.navigate(item.url),
  }));
