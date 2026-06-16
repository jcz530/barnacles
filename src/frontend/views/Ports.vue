<script setup lang="ts">
import type { SortingState } from '@tanstack/vue-table';
import { RefreshCw, Search } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import type { PortEntry } from '../../shared/types/api';
import ViewToggle from '../components/atoms/ViewToggle.vue';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import PortsTable from '../components/ports/organisms/PortsTable.vue';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';
import { useViewMode } from '@/composables/useViewMode';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'Ports' }]);

const { usePortsQuery, useKillPortMutation } = useQueries();

const searchQuery = ref('');
const viewMode = useViewMode('ports-view-mode', 'table');
const tableSorting = ref<SortingState>([{ id: 'port', desc: false }]);
const cardSortField = ref<'port' | 'processName' | 'pid'>('port');
const cardSortDirection = ref<'asc' | 'desc'>('asc');

const { data: portsData, isLoading, refetch } = usePortsQuery({ enabled: true });
const killPortMutation = useKillPortMutation();

const filteredPorts = computed<PortEntry[]>(() => {
  const ports = portsData.value || [];
  const q = searchQuery.value.trim().toLowerCase();

  let result = q
    ? ports.filter(p => p.processName.toLowerCase().includes(q) || String(p.port).includes(q))
    : ports;

  if (viewMode.value === 'card') {
    result = [...result].sort((a, b) => {
      const aVal = a[cardSortField.value];
      const bVal = b[cardSortField.value];
      const cmp =
        typeof aVal === 'string'
          ? aVal.localeCompare(String(bVal))
          : (aVal as number) - (bVal as number);
      return cardSortDirection.value === 'asc' ? cmp : -cmp;
    });
  }

  return result;
});

// Sync table sorting → card sort state
watch(tableSorting, newSorting => {
  if (newSorting.length > 0) {
    const sort = newSorting[0];
    cardSortField.value = sort.id as 'port' | 'processName' | 'pid';
    cardSortDirection.value = sort.desc ? 'desc' : 'asc';
  }
});

// Sync card sort state → table sorting
watch([cardSortField, cardSortDirection], () => {
  tableSorting.value = [{ id: cardSortField.value, desc: cardSortDirection.value === 'desc' }];
});

const handleKill = async (pid: number) => {
  await killPortMutation.mutateAsync(pid);
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

      <!-- Search + View Toggle -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1">
          <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            v-model="searchQuery"
            placeholder="Search by port or process name..."
            class="pl-9"
          />
        </div>
        <div class="ml-auto flex items-center gap-3">
          <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />
        </div>
      </div>

      <!-- Results count -->
      <div class="mt-4 text-sm text-slate-600">
        <span v-if="!isLoading">
          {{ filteredPorts.length }} {{ filteredPorts.length === 1 ? 'port' : 'ports' }}
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
        @update:sorting="tableSorting = $event"
        @kill="handleKill"
      />
    </div>
  </div>
</template>
