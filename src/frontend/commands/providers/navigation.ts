import { ALL_NAV_ITEMS } from '@/constants/navigation';
import type { Command } from '../types';

/** Top-level destinations worth showing before anything is typed. */
const DEFAULT_VISIBLE = new Set(['/projects', '/ports', '/terminals']);

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
    run: ctx => ctx.navigate(item.url),
  }));
