<script setup lang="ts">
import type { SortingState } from '@tanstack/vue-table';
import { useDebounce } from '@vueuse/core';
import { Code, RefreshCw, Search } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { RUNTIME_CONFIG } from '../../shared/constants';
import type { PortEntry, ProjectWithDetails } from '../../shared/types/api';
import ViewToggle from '../components/atoms/ViewToggle.vue';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import PortsTable from '../components/ports/organisms/PortsTable.vue';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';
import { useViewMode } from '@/composables/useViewMode';
import { usePortProbeWebSocket } from '@/composables/usePortProbeWebSocket';
import { isDevProcess } from '@/constants/processEnrichment';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'Ports' }]);

const { usePortsQuery, useKillPortMutation, useProjectsQuery } = useQueries();

const searchQuery = ref('');
const debouncedSearchQuery = useDebounce(searchQuery, 150);
const showDevOnly = ref(true);
const viewMode = useViewMode('ports-view-mode', 'table');
const tableSorting = ref<SortingState>([{ id: 'port', desc: false }]);

const { data: portsData, isLoading, refetch } = usePortsQuery({ enabled: true });
const { data: projectsData } = useProjectsQuery({ enabled: true });
const killPortMutation = useKillPortMutation();

const screenshotUrl = (fileName: string) =>
  `${RUNTIME_CONFIG.API_BASE_URL}/api/ports/screenshot/${fileName}`;

const probeTargets = computed(() =>
  (portsData.value || []).map(p => ({ port: p.port, processName: p.processName }))
);
const { probeResults, isProbing } = usePortProbeWebSocket(probeTargets);
const screenshots = ref<Map<number, string>>(new Map());
const capturingPorts = new Set<number>();

watch(probeResults, results => {
  for (const [port, info] of results.entries()) {
    if (!info.isHttp) continue;

    if (info.cachedScreenshot) {
      screenshots.value = new Map(screenshots.value).set(
        port,
        screenshotUrl(info.cachedScreenshot.fileName)
      );
      continue;
    }

    if (screenshots.value.has(port) || capturingPorts.has(port)) continue;

    const entry = (portsData.value || []).find(p => p.port === port);
    if (!entry) continue;

    capturingPorts.add(port);
    window.electron.screenshot
      .captureUrl({
        url: info.captureUrl,
        port,
        processName: entry.processName,
        signature: info.signature,
      })
      .then(result => {
        if (result.success && result.data) {
          screenshots.value = new Map(screenshots.value).set(
            port,
            screenshotUrl(result.data.fileName)
          );
        }
      })
      .finally(() => {
        capturingPorts.delete(port);
      });
  }
});

const projectByPath = computed(() => {
  const map = new Map<string, ProjectWithDetails>();
  for (const p of projectsData.value || []) {
    map.set(p.path, p);
  }
  return map;
});

const filteredPorts = computed<PortEntry[]>(() => {
  const ports = portsData.value || [];
  const q = debouncedSearchQuery.value.trim().toLowerCase();

  // Include ghosts in the base list so they sort into their original position
  const ghosts = Array.from(ghostPorts.value.values()).filter(
    g => dyingPids.value.has(g.pid) && !ports.find(p => p.pid === g.pid)
  );
  const all = [...ports, ...ghosts];

  // Sorting (for both table and card view) is handled by PortsTable's
  // TanStack Table instance, driven by the tableSorting state below.
  return all.filter(p => {
    if (dyingPids.value.has(p.pid)) return true; // always keep dying rows
    if (showDevOnly.value && !isDevProcess(p.processName)) return false;
    if (q && !p.processName.toLowerCase().includes(q) && !String(p.port).includes(q)) return false;
    return true;
  });
});

const totalCount = computed(() => (portsData.value || []).length);
const devCount = computed(
  () => (portsData.value || []).filter(p => isDevProcess(p.processName)).length
);

const killingPids = ref<Set<number>>(new Set());
const dyingPids = ref<Set<number>>(new Set());
const ghostPorts = ref<Map<number, PortEntry>>(new Map());

const handleKill = async (pid: number) => {
  killingPids.value = new Set(killingPids.value).add(pid);

  const entry = portsData.value?.find(p => p.pid === pid);
  if (entry) ghostPorts.value = new Map(ghostPorts.value).set(pid, entry);

  try {
    await killPortMutation.mutateAsync(pid);
  } finally {
    const nextKilling = new Set(killingPids.value);
    nextKilling.delete(pid);
    killingPids.value = nextKilling;

    dyingPids.value = new Set(dyingPids.value).add(pid);

    setTimeout(() => {
      const nextDying = new Set(dyingPids.value);
      nextDying.delete(pid);
      dyingPids.value = nextDying;

      const nextGhosts = new Map(ghostPorts.value);
      nextGhosts.delete(pid);
      ghostPorts.value = nextGhosts;
    }, 500);
  }
};
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-800">Ports</h1>
          <p class="mt-1 text-sm text-slate-600">TCP ports currently listening on this machine</p>
        </div>
        <Button variant="outline" size="sm" :disabled="isLoading" @click="() => refetch()">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': isLoading }" />
          Refresh
        </Button>
      </div>

      <!-- Search + Filters + View Toggle -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            v-model="searchQuery"
            placeholder="Search by port or process name..."
            class="pl-9"
          />
        </div>
        <Button
          :variant="showDevOnly ? 'default' : 'outline'"
          size="sm"
          class="shrink-0 gap-2"
          @click="showDevOnly = !showDevOnly"
        >
          <Code class="h-4 w-4" />
          Dev only
        </Button>
        <div class="ml-auto flex items-center gap-3">
          <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />
        </div>
      </div>

      <!-- Results count -->
      <div class="mt-4 text-sm text-slate-600">
        <span v-if="!isLoading">
          {{ filteredPorts.length }} {{ filteredPorts.length === 1 ? 'port' : 'ports' }}
          <span v-if="showDevOnly && !searchQuery">
            ({{ totalCount - devCount }} system processes hidden)</span
          >
          <span v-if="searchQuery"> matching "{{ searchQuery }}"</span>
        </span>
        <span v-else>Loading...</span>
      </div>
    </div>

    <!-- Table / Card -->
    <div class="flex-1 overflow-y-auto p-6 pt-0">
      <!-- Loading state -->
      <div v-if="isLoading" class="py-12 text-center text-slate-500">Loading ports...</div>

      <!-- Empty state -->
      <div v-else-if="filteredPorts.length === 0" class="py-12 text-center text-slate-500">
        <p v-if="searchQuery">No ports match "{{ searchQuery }}".</p>
        <p v-else>No listening ports found.</p>
      </div>

      <!-- Ports Table/Cards -->
      <PortsTable
        v-else
        :ports="filteredPorts"
        :view-mode="viewMode"
        :sorting="tableSorting"
        :project-by-path="projectByPath"
        :http-ports="probeResults"
        :screenshots="screenshots"
        :is-probing="isProbing"
        :killing-pids="killingPids"
        :dying-pids="dyingPids"
        @update:sorting="tableSorting = $event"
        @kill="handleKill"
      />
    </div>
  </div>
</template>
