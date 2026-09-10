import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/vue-query';
import { computed, nextTick, ref } from 'vue';
import type { PortEntry, ProjectWithDetails } from '../../shared/types/api';
import type { ProjectProcessStatus, StartProcess } from '../../shared/types/process';
import { portCommands } from './providers/ports';
import { processCommands } from './providers/processes';
import { useLevelStack } from './useLevelStack';
import type { Command } from './types';

/**
 * Does the palette's list actually update while it is open?
 *
 * The stay-open commands (barnacles-c5z) rest on this: killing a port is meant
 * to be confirmed by watching the row leave, and starting a process by watching
 * it flip to running. That only works if a mutation's cache write reaches the
 * command list without the palette being reopened.
 *
 * The chain has three links, and these tests cover the two that were unproven:
 * the mutation's own cache write, and the rebuild of an open action level. The
 * middle link -- `commands` being a computed over `ports.value` -- is Vue's,
 * and is modelled here by the same computed shape the registry uses.
 *
 * The mutations' onSuccess bodies are duplicated rather than imported because
 * useQueries pulls in window.electron and the whole API layer; what is being
 * checked is the cache write itself, which is small enough to state exactly.
 */

const port = (pid: number, portNumber: number): PortEntry => ({
  pid,
  port: portNumber,
  protocol: 'TCP',
  processName: 'node',
  state: 'LISTEN',
});

const project = (id: string, name: string): ProjectWithDetails =>
  ({ id, name, path: `/code/${name}` }) as ProjectWithDetails;

const configuredProcess = (id: string): StartProcess => ({ id, name: id }) as StartProcess;

const runningStatus = (projectId: string, processId: string): ProjectProcessStatus => ({
  projectId,
  processes: [{ processId, status: 'running' }],
});

const noopPortDeps = {
  killPort: () => {},
  copyText: () => {},
  openExternal: () => {},
};

const noopProcessDeps = {
  startProcesses: () => {},
  stopProcesses: () => {},
  startProcess: () => {},
  stopProcess: () => {},
  restartProcess: () => {},
  openExternal: () => {},
};

describe('the palette list refreshing while it stays open', () => {
  it('drops a killed port from the command list without a reopen', async () => {
    const client = new QueryClient();
    client.setQueryData<PortEntry[]>(['ports'], [port(100, 3000), port(200, 5432)]);

    // The registry builds its rows in a computed over the query's data, so a
    // cache write is what has to reach the list.
    const ports = ref(client.getQueryData<PortEntry[]>(['ports']));
    const commands = computed<Command[]>(() => portCommands(ports.value ?? [], noopPortDeps));

    expect(commands.value.map(command => command.title)).toEqual(['Port 3000', 'Port 5432']);

    // useKillPortMutation's onSuccess: an optimistic filter rather than an
    // invalidate, so the row goes as soon as the request resolves rather than
    // after a refetch of `lsof`.
    client.setQueryData<PortEntry[]>(['ports'], old => (old ?? []).filter(p => p.pid !== 100));
    ports.value = client.getQueryData<PortEntry[]>(['ports']);
    await nextTick();

    expect(commands.value.map(command => command.title)).toEqual(['Port 5432']);
  });

  it('flips a project row to Stop once its processes report running', async () => {
    const projects = [project('p1', 'barnacles')];
    const statuses = ref<ProjectProcessStatus[]>([]);
    const state = { configured: { p1: [configuredProcess('web')] }, loading: {} };

    const commands = computed<Command[]>(() =>
      processCommands(projects, statuses.value, state, noopProcessDeps)
    );

    expect(commands.value.map(command => command.title)).toEqual(['Start barnacles']);

    // What invalidating 'process-status-all' produces once the refetch lands.
    statuses.value = [runningStatus('p1', 'web')];
    await nextTick();

    expect(commands.value.map(command => command.title)).toEqual(['Stop barnacles']);
  });

  it('updates an open port level when the port behind it is killed', async () => {
    // The case the stay-open change actually creates: the kill is run from
    // inside that port's own actions, so the level's source row is the thing
    // being removed.
    const ports = ref<PortEntry[]>([port(100, 3000), port(200, 5432)]);
    const commands = computed<Command[]>(() => portCommands(ports.value, noopPortDeps));
    const stack = useLevelStack(commands);

    const target = commands.value[0];
    stack.push(target, () => target.actions?.({} as never) ?? []);
    expect(stack.depth.value).toBe(1);

    ports.value = ports.value.filter(entry => entry.pid !== 100);
    await nextTick();

    // The level's subject is gone, so the level goes with it -- there is
    // nothing left to act on. Worth pinning: it means a status message raised
    // by the kill has to survive being thrown back to the root.
    expect(stack.depth.value).toBe(0);
    expect(stack.activeItems.value.map(command => command.title)).toEqual(['Port 5432']);
  });
});
