import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { PaletteItem } from './types';
import { useLevelStack } from './useLevelStack';

const item = (id: string, overrides: Partial<PaletteItem> = {}): PaletteItem => ({
  id,
  title: id,
  group: 'projects',
  ...overrides,
});

const withActions = (id: string, actions: PaletteItem[]) => item(id, { actions: () => actions });

const stack = (items: PaletteItem[] = []) => useLevelStack(ref(items));

describe('useLevelStack', () => {
  it('searches the root list until something is pushed', () => {
    const root = [item('barnacles')];
    const { activeItems, depth } = stack(root);

    expect(depth.value).toBe(0);
    expect(activeItems.value).toEqual(root);
  });

  it('switches to a level’s own items once pushed', () => {
    const actions = [item('open-ide'), item('reveal')];
    const parent = withActions('barnacles', actions);
    const { push, activeItems, depth } = stack([parent]);

    push(parent, () => actions);

    expect(depth.value).toBe(1);
    expect(activeItems.value).toEqual(actions);
  });

  it('starts each level with an empty search', () => {
    const parent = withActions('barnacles', [item('reveal')]);
    const s = stack([parent]);
    s.activeQuery.value = 'barn';

    s.push(parent, () => [item('reveal')]);

    expect(s.activeQuery.value).toBe('');
  });

  it('restores the interrupted search on the way back out', () => {
    // Backing out of a level should feel like undo, not like starting over.
    const parent = withActions('barnacles', [item('reveal')]);
    const s = stack([parent]);
    s.activeQuery.value = 'barn';
    s.push(parent, () => [item('reveal')]);
    s.activeQuery.value = 'rev';

    s.pop();

    expect(s.activeQuery.value).toBe('barn');
  });

  it('keeps each level’s search separate', () => {
    const a = withActions('a', [item('a1')]);
    const b = withActions('b', [item('b1')]);
    const s = stack([a]);

    s.push(a, () => [b]);
    s.activeQuery.value = 'first';
    s.push(b, () => [item('b1')]);
    s.activeQuery.value = 'second';

    expect(s.activeQuery.value).toBe('second');
    s.pop();
    expect(s.activeQuery.value).toBe('first');
  });

  it('builds a level’s items only when it is opened', () => {
    const build = vi.fn(() => [item('reveal')]);
    const parent = withActions('barnacles', [item('reveal')]);
    const { push } = stack([parent]);

    expect(build).not.toHaveBeenCalled();
    push(parent, build);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('refuses to push an item that has no actions', () => {
    const leaf = item('reveal');
    const { push, depth } = stack([leaf]);

    expect(push(leaf, () => [])).toBe(false);
    expect(depth.value).toBe(0);
  });

  it('refuses to push a level that would be empty', () => {
    // Nothing installed, say. An empty level is a dead end the person has to
    // back out of, so it is better not to enter it.
    const parent = withActions('barnacles', []);
    const { push, depth } = stack([parent]);

    expect(push(parent, () => [])).toBe(false);
    expect(depth.value).toBe(0);
  });

  it('reports whether it handled a pop, so the caller can dismiss instead', () => {
    const parent = withActions('barnacles', [item('reveal')]);
    const s = stack([parent]);

    expect(s.pop()).toBe(false);

    s.push(parent, () => [item('reveal')]);
    expect(s.pop()).toBe(true);
    expect(s.depth.value).toBe(0);
  });

  it('names each level for the breadcrumb', () => {
    const a = withActions('Barnacles', [item('a1')]);
    const b = withActions('Open in IDE', [item('b1')]);
    const s = stack([a]);

    s.push(a, () => [b]);
    s.push(b, () => [item('b1')]);

    expect(s.breadcrumb.value).toEqual(['Barnacles', 'Open in IDE']);
  });

  it('returns to the root on reset', () => {
    const parent = withActions('barnacles', [item('reveal')]);
    const s = stack([parent]);
    s.activeQuery.value = 'barn';
    s.push(parent, () => [item('reveal')]);

    s.reset();

    expect(s.depth.value).toBe(0);
    expect(s.activeQuery.value).toBe('');
  });
});
