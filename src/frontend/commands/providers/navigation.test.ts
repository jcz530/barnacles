import { describe, expect, it } from 'vitest';
import { navigationCommands } from './navigation';

const find = (id: string) => navigationCommands().find(command => command.id === id);

describe('navigationCommands', () => {
  it('shows the shortcut for a page the app already binds one for', () => {
    // Settings is reachable by Cmd+, from the menu; the palette should point at
    // the faster route rather than pretending to be the only one.
    expect(find('nav.settings')?.accelerator).toBe('CommandOrControl+,');
  });

  it('leaves pages without a shortcut unmarked', () => {
    // A hint for a key that does nothing is worse than no hint at all.
    expect(find('nav.ports')?.accelerator).toBeUndefined();
    expect(find('nav.home')?.accelerator).toBeUndefined();
  });

  it('still navigates to every page it lists', () => {
    const commands = navigationCommands();

    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every(command => typeof command.run === 'function')).toBe(true);
  });
});
