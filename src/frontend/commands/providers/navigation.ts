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
    run: ctx => ctx.navigate(item.url),
  }));
