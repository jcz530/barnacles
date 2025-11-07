<script setup lang="ts">
import type { SortingState } from '@tanstack/vue-table';
import { RefreshCw, Scan, Star } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMagicKeys, whenever } from '@vueuse/core';
import dayjs from 'dayjs';
import type { ProjectWithDetails } from '../../shared/types/api';
import SortControl from '../components/atoms/SortControl.vue';
import ViewToggle from '../components/atoms/ViewToggle.vue';
import ProjectSearchBar from '../components/projects/molecules/ProjectSearchBar.vue';
import TechnologyFilter from '../components/projects/molecules/TechnologyFilter.vue';
import { RouteNames } from '@/router';
import DateFilter, {
  type DateFilterDirection,
  type DatePreset,
} from '../components/molecules/DateFilter.vue';
import ProjectsTable from '../components/projects/organisms/ProjectsTable.vue';
import { Button } from '../components/ui/button';
import { useBreadcrumbs } from '../composables/useBreadcrumbs';
import { useFuzzySearch } from '../composables/useFuzzySearch';
import { useQueries } from '../composables/useQueries';
import { useProjectScanWebSocket } from '../composables/useProjectScanWebSocket';
import { useViewMode } from '../composables/useViewMode';

const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'Projects', href: '/projects' }]);
const {
  useProjectsQuery,
  useTechnologiesQuery,
  useDeleteProjectMutation,
  useToggleFavoriteMutation,
  useProcessStatusQuery,
} = useQueries();

// WebSocket scanning
const {
  isConnected: wsConnected,
  isScanning: wsScanning,
  totalDiscovered,
  error: wsScanError,
  discoveredProjects,
  startScan: startWebSocketScan,
} = useProjectScanWebSocket();

// State
const searchQuery = ref('');
const selectedTechnologies = ref<string[]>([]);
const showFavoritesOnly = ref(false);
const datePreset = ref<DatePreset>('all');
const dateDirection = ref<DateFilterDirection>('within');
const viewMode = useViewMode('projects-view-mode', 'table');
const sortField = ref<'name' | 'lastModified' | 'size'>('lastModified');
const sortDirection = ref<'asc' | 'desc'>('desc');
const tableSorting = ref<SortingState>([{ id: 'lastModified', desc: true }]);
const searchBarRef = ref<InstanceType<typeof ProjectSearchBar> | null>(null);

// Queries
const {
  data: filteredProjects,
  isLoading: projectsLoading,
  refetch: refetchProjects,
} = useProjectsQuery({
  search: ref(''), // Remove server-side search
  technologies: selectedTechnologies,
});

// Get all projects for total count
const { data: allProjectsData } = useProjectsQuery({
  search: ref(''),
  technologies: ref([]),
});

const { data: technologies, isLoading: technologiesLoading } = useTechnologiesQuery();

// Get all process statuses (no project filter)
const { data: allProcessStatuses } = useProcessStatusQuery(undefined, {
  enabled: true,
  refetchInterval: 2000,
});

// Local fuzzy search
const { filteredItems: searchedProjects } = useFuzzySearch<ProjectWithDetails>({
  items: computed(() => filteredProjects.value || []),
  searchQuery,
  fuseOptions: {
    threshold: 0.3,
    keys: ['name', 'path', 'description'],
  },
});

// Sorted and filtered projects
const projects = computed(() => {
  let items = [...(searchedProjects.value || [])];

  // Filter by favorites if enabled
  if (showFavoritesOnly.value) {
    items = items.filter(project => project.isFavorite);
  }

  // Filter by date preset
  if (datePreset.value !== 'all') {
    let cutoffDate: dayjs.Dayjs;

    switch (datePreset.value) {
      case 'today':
        cutoffDate = dayjs().startOf('day');
        break;
      case 'week':
        cutoffDate = dayjs().subtract(7, 'day');
        break;
      case 'month':
        cutoffDate = dayjs().subtract(30, 'day');
        break;
      case 'quarter':
        cutoffDate = dayjs().subtract(90, 'day');
        break;
      case 'year':
        cutoffDate = dayjs().subtract(365, 'day');
        break;
      default:
        cutoffDate = dayjs(0);
    }

    items = items.filter(project => {
      if (!project.lastModified) return false;
      const projectDate = dayjs(project.lastModified);

      // Apply filter based on direction
      if (dateDirection.value === 'within') {
        return projectDate.isAfter(cutoffDate) || projectDate.isSame(cutoffDate);
      } else {
        // 'older' - show projects modified before the cutoff date
        return projectDate.isBefore(cutoffDate);
      }
    });
  }

  items.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField.value) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'lastModified':
        aVal = a.lastModified ? dayjs(a.lastModified).valueOf() : 0;
        bVal = b.lastModified ? dayjs(b.lastModified).valueOf() : 0;
        break;
      case 'size':
        aVal = a.size || 0;
        bVal = b.size || 0;
        break;
    }

    if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1;
    return 0;
  });

  return items;
});

// Mutations
const deleteMutation = useDeleteProjectMutation();
const toggleFavoriteMutation = useToggleFavoriteMutation();

// Computed
const isScanning = computed(() => wsScanning.value);

const hasActiveFilters = computed(
  () =>
    searchQuery.value.trim() !== '' ||
    selectedTechnologies.value.length > 0 ||
    showFavoritesOnly.value ||
    datePreset.value !== 'all'
);

const totalProjects = computed(() => allProjectsData.value?.length || 0);

const resultsText = computed(() => {
  const count = projects.value.length;
  const total = totalProjects.value;

  if (hasActiveFilters.value) {
    return `${count} of ${total} ${total === 1 ? 'project' : 'projects'}`;
  }

  return `${count} ${count === 1 ? 'project' : 'projects'}`;
});

// Methods
const handleScanProjects = async () => {
  try {
    // Use WebSocket scanning for real-time updates
    startWebSocketScan();
  } catch (error) {
    console.error('Failed to scan projects:', error);
    alert('Failed to scan projects. Please try again.');
  }
};

const handleDeleteProject = async (projectId: string) => {
  try {
    await deleteMutation.mutateAsync(projectId);
  } catch (error) {
    console.error('Failed to delete project:', error);
    alert('Failed to delete project. Please try again.');
  }
};

const handleOpenProject = (project: ProjectWithDetails) => {
  router.push({ name: RouteNames.ProjectOverview, params: { id: project.id } });
};

const handleRefresh = () => {
  refetchProjects();
};

const handleToggleFavorite = async (projectId: string) => {
  try {
    await toggleFavoriteMutation.mutateAsync(projectId);
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    alert('Failed to toggle favorite. Please try again.');
  }
};

// Sync table sorting with card sorting
watch(tableSorting, newSorting => {
  if (newSorting.length > 0) {
    const sort = newSorting[0];
    sortField.value = sort.id as 'name' | 'lastModified' | 'size';
    sortDirection.value = sort.desc ? 'desc' : 'asc';
  }
});

// Sync card sorting with table sorting
watch([sortField, sortDirection], () => {
  tableSorting.value = [{ id: sortField.value, desc: sortDirection.value === 'desc' }];
});

// Expose method for focusing search input
const focusSearch = () => {
  searchBarRef.value?.focus();
};

defineExpose({
  focusSearch,
});

// Setup keyboard shortcuts for this page
const keys = useMagicKeys();

// Cmd+K or Ctrl+K - Focus search input
whenever(keys['Meta+K'], () => {
  focusSearch();
});
whenever(keys['Ctrl+K'], () => {
  focusSearch();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-800">Projects</h1>
          <p class="mt-1 text-sm text-slate-600">Manage and explore your development projects</p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" @click="handleRefresh" :disabled="projectsLoading">
            <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': projectsLoading }" />
            Refresh
          </Button>
          <Button @click="handleScanProjects" :disabled="isScanning">
            <Scan class="mr-2 h-4 w-4" :class="{ 'animate-spin': isScanning }" />
            {{ isScanning ? `Scanning... (${totalDiscovered} found)` : 'Scan Projects' }}
          </Button>
        </div>
      </div>

      <!-- Filters -->
      <div class="grid grid-cols-2 gap-3">
        <ProjectSearchBar ref="searchBarRef" v-model="searchQuery" />
      </div>
      <div class="mt-4 flex items-center gap-3">
        <Button
          :variant="showFavoritesOnly ? 'default' : 'outline'"
          size="sm"
          @click="showFavoritesOnly = !showFavoritesOnly"
        >
          <Star class="mr-2 h-4 w-4" :fill="showFavoritesOnly ? 'currentColor' : 'none'" />
          Favorites
        </Button>
        <TechnologyFilter
          v-if="!technologiesLoading && technologies"
          :technologies="technologies"
          :selected-technologies="selectedTechnologies"
          @update:selected-technologies="selectedTechnologies = $event"
        />
        <DateFilter
          :selected-preset="datePreset"
          :direction="dateDirection"
          @update:selected-preset="datePreset = $event"
          @update:direction="dateDirection = $event"
        />
        <Button
          v-if="hasActiveFilters"
          variant="ghost"
          size="sm"
          @click="
            searchQuery = '';
            selectedTechnologies = [];
            showFavoritesOnly = false;
            datePreset = 'all';
            dateDirection = 'within';
          "
        >
          Clear Filters
        </Button>
        <div class="ml-auto flex items-center gap-3">
          <SortControl
            v-if="viewMode === 'card'"
            :sort-field="sortField"
            :sort-direction="sortDirection"
            @update:sort-field="sortField = $event"
            @update:sort-direction="sortDirection = $event"
          />
          <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />
        </div>
      </div>

      <!-- Results count and scan status -->
      <div class="mt-4 flex items-center gap-4">
        <div v-if="!projectsLoading" class="text-sm text-slate-600">
          {{ resultsText }}
        </div>
        <div
          v-if="isScanning"
          class="text-primary-700 bg-primary-400/20 flex items-center gap-2 rounded-md px-3 py-1 text-sm"
        >
          <Scan class="h-4 w-4 animate-spin" />
          <span>Discovering projects... {{ totalDiscovered }} found so far</span>
        </div>
        <div
          v-if="wsScanError"
          class="flex items-center gap-2 rounded-md bg-red-50 px-3 py-1 text-sm text-red-700"
        >
          <span>⚠️ {{ wsScanError }}</span>
        </div>
      </div>
    </div>

    <!-- Projects Table/Grid -->
    <div class="flex-1 overflow-y-auto pt-4">
      <ProjectsTable
        :projects="projects"
        :is-loading="projectsLoading"
        :view-mode="viewMode"
        :sorting="tableSorting"
        :process-statuses="allProcessStatuses"
        @update:sorting="tableSorting = $event"
        @delete="handleDeleteProject"
        @open="handleOpenProject"
        @toggle-favorite="handleToggleFavorite"
      />
    </div>
  </div>
</template>
