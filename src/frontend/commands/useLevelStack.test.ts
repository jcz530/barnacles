import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
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

  it('asks an item to prepare its data as the level opens', () => {
    const prepare = vi.fn();
    const parent = item('barnacles', { actions: () => [item('reveal')], prepare });
    const { push } = stack([parent]);

    push(parent, () => [item('reveal')]);

    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('does not prepare an item that has no level to open', () => {
    // The actions guard runs first, so a row that cannot be drilled into never
    // kicks off a fetch for a level nobody will see.
    const prepare = vi.fn();
    const leaf = item('reveal', { prepare });
    const { push } = stack([leaf]);

    expect(push(leaf, () => [])).toBe(false);
    expect(prepare).not.toHaveBeenCalled();
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

  it('pops exactly one level per call', () => {
    // Escape was wired in two places at once, so a single press popped two
    // levels -- which looked like it working only when two levels deep.
    const a = withActions('a', [item('a1')]);
    const b = withActions('b', [item('b1')]);
    const s = stack([a]);

    s.push(a, () => [b]);
    s.push(b, () => [item('b1')]);
    expect(s.depth.value).toBe(2);

    s.pop();
    expect(s.depth.value).toBe(1);
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

    expect(s.breadcrumb.value.map(crumb => crumb.title)).toEqual(['Barnacles', 'Open in IDE']);
  });

  it('carries the drilled-into item’s icon into the breadcrumb', () => {
    // A project's actions should still read as that project's, which the name
    // alone does not convey once you are a level in.
    const projectIcon = { projectId: 'p1', projectName: 'Barnacles', hasIcon: true };
    const project = item('project:p1', {
      title: 'Barnacles',
      projectIcon,
      actions: () => [item('reveal')],
    });
    const s = stack([project]);

    s.push(project, () => [item('reveal')]);

    expect(s.breadcrumb.value[0].projectIcon).toEqual(projectIcon);
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

describe('keeping open levels current', () => {
  const port = (pid: number) =>
    item('port:3000', {
      title: 'Port 3000',
      actions: () => [item(`kill:${pid}`, { title: `Kill (pid ${pid})` })],
    });

  it('rebuilds an open level when the data behind it changes', async () => {
    // Ports refetch every few seconds. A picker left open across a refresh
    // would otherwise keep acting on the pid that was true when it opened --
    // and pids get reused, so that is not merely a stale label.
    const items = ref([port(100)]);
    const s = useLevelStack(items);

    s.push(items.value[0], () => items.value[0].actions!({} as never));
    expect(s.activeItems.value[0].id).toBe('kill:100');

    items.value = [port(200)];
    await nextTick();

    expect(s.activeItems.value[0].id).toBe('kill:200');
  });

  it('fills a level in when the data its actions read arrives', async () => {
    // The whole reason `actions` stays synchronous. A level built from a cache
    // that is still filling would, with an async builder, be replaced by the
    // sync result or dropped outright on the next root refresh -- and the root
    // refreshes every few seconds. Here the rebuild is what delivers the rows:
    // actions() reads the cache, so the refresh that follows the fetch is what
    // puts the loaded items on screen.
    const cache: { rows: PaletteItem[] } = { rows: [] };
    const project = (): PaletteItem =>
      item('project:1', {
        title: 'Barnacles',
        actions: () => [item('open'), ...cache.rows],
      });

    const items = ref([project()]);
    const s = useLevelStack(items);
    s.push(items.value[0], () => items.value[0].actions!({} as never));

    // Opens immediately with only the static action -- never blocked on a fetch.
    expect(s.depth.value).toBe(1);
    expect(s.activeItems.value.map(entry => entry.id)).toEqual(['open']);

    cache.rows = [item('process:web')];
    items.value = [project()];
    await nextTick();

    expect(s.depth.value).toBe(1);
    expect(s.activeItems.value.map(entry => entry.id)).toEqual(['open', 'process:web']);
  });

  it('keeps the level open and its search intact while rebuilding', async () => {
    const items = ref([port(100)]);
    const s = useLevelStack(items);
    s.push(items.value[0], () => items.value[0].actions!({} as never));
    s.activeQuery.value = 'kill';

    items.value = [port(200)];
    await nextTick();

    expect(s.depth.value).toBe(1);
    expect(s.activeQuery.value).toBe('kill');
  });

  it('drops the level when its subject disappears entirely', async () => {
    // The port closed, or the project was removed. There is nothing left to
    // act on, so staying in the level would offer actions that cannot work.
    const items = ref([port(100)]);
    const s = useLevelStack(items);
    s.push(items.value[0], () => items.value[0].actions!({} as never));

    items.value = [];
    await nextTick();

    expect(s.depth.value).toBe(0);
  });

  it('leaves the root alone when nothing is open', async () => {
    const items = ref([port(100)]);
    const s = useLevelStack(items);

    items.value = [port(200)];
    await nextTick();

    expect(s.depth.value).toBe(0);
    expect(s.activeItems.value[0].id).toBe('port:3000');
  });
});
