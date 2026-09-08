import { Sparkles } from 'lucide-vue-next';
import { utilityRegistry } from '@/utilities';
import type { Command } from '../types';

/**
 * One command per registered utility, sourced from the utility registry so new
 * utilities appear in the palette without a second edit.
 */
export const utilityCommands = (): Command[] =>
  utilityRegistry.getAllMetadata().map(utility => ({
    id: `utility.${utility.id}`,
    title: utility.name,
    subtitle: utility.description,
    group: 'utilities' as const,
    icon: Sparkles,
    keywords: [...(utility.tags ?? []), utility.category ?? '', 'utility', 'tool'].filter(Boolean),
    run: ctx => ctx.navigate(utility.route),
  }));
