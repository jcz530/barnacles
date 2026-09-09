import { describe, expect, it, vi } from 'vitest';
import type { CommandContext, PaletteItem } from './types';

const ctx = (): CommandContext => ({
  surface: 'in-app',
  navigate: vi.fn(),
  dismiss: vi.fn(),
  pop: vi.fn(),
});

describe('PaletteItem', () => {
  it('lets an item carry a default verb and its own actions at once', () => {
    // "Open in IDE" is both: Enter opens the preferred editor, and the actions
    // level offers the others. Neither field implies the absence of the other.
    const item: PaletteItem = {
      id: 'project.open-ide:1',
      title: 'Open in Cursor',
      group: 'projects',
      run: vi.fn(),
      actions: () => [],
    };

    expect(item.run).toBeDefined();
    expect(item.actions).toBeDefined();
  });

  it('builds its actions only when asked', () => {
    // The registry rebuilds every item whenever projects or ports change, so
    // actions stay a function -- a level nobody opened costs nothing.
    const build = vi.fn(() => []);
    const item: PaletteItem = {
      id: 'project:1',
      title: 'Barnacles',
      group: 'projects',
      actions: build,
    };

    expect(build).not.toHaveBeenCalled();
    item.actions?.(ctx());
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('allows an item with actions but no default verb', () => {
    // How "no preferred IDE" is expressed: there is nothing to default to, so
    // Enter should open the choice rather than guess at one.
    const item: PaletteItem = {
      id: 'project.open-ide:1',
      title: 'Open in IDE',
      group: 'projects',
      actions: () => [],
    };

    expect(item.run).toBeUndefined();
  });
});
