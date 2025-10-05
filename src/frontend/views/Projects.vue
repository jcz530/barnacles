<script setup lang="ts">
import type { SortingState } from '@tanstack/vue-table';
import { RefreshCw, Scan } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { ProjectWithDetails } from '../../shared/types/api';
import SortControl from '../components/atoms/SortControl.vue';
import ViewToggle from '../components/atoms/ViewToggle.vue';
import ProjectSearchBar from '../components/molecules/ProjectSearchBar.vue';
import TechnologyFilter from '../components/molecules/TechnologyFilter.vue';
import ProjectsTable from '../components/organisms/ProjectsTable.vue';
import { Button } from '../components/ui/button';
import { useFuzzySearch } from '../composables/useFuzzySearch';
import { useQueries } from '../composables/useQueries';

const router = useRouter();

const {
  useProjectsQuery,
  useTechnologiesQuery,
  useScanProjectsMutation,
  useDeleteProjectMutation,
} = useQueries();

// State
const searchQuery = ref('');
const selectedTechnologies = ref<string[]>([]);
const viewMode = ref<'table' | 'card'>('table');
const sortField = ref<'name' | 'lastModified' | 'size'>('lastModified');
const sortDirection = ref<'asc' | 'desc'>('desc');
const tableSorting = ref<SortingState>([{ id: 'lastModified', desc: true }]);

// Queries
const {
  data: allProjects,
  isLoading: projectsLoading,
  refetch: refetchProjects,
} = useProjectsQuery({
  search: ref(''), // Remove server-side search
  technologies: selectedTechnologies,
});

const { data: technologies, isLoading: technologiesLoading } = useTechnologiesQuery();

// Local fuzzy search
const { filteredItems: searchedProjects } = useFuzzySearch<ProjectWithDetails>({
  items: computed(() => allProjects.value || []),
  searchQuery,
  fuseOptions: {
    threshold: 0.3,
    keys: ['name', 'path', 'description'],
  },
});

// Sorted projects
const projects = computed(() => {
  const items = [...(searchedProjects.value || [])];

  items.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField.value) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'lastModified':
        aVal = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        bVal = b.lastModified ? new Date(b.lastModified).getTime() : 0;
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
const scanMutation = useScanProjectsMutation();
const deleteMutation = useDeleteProjectMutation();

// Computed
const isScanning = computed(() => scanMutation.isPending.value);

const hasActiveFilters = computed(
  () => searchQuery.value.trim() !== '' || selectedTechnologies.value.length > 0
);

const totalProjects = computed(() => allProjects.value?.length || 0);

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
    await scanMutation.mutateAsync();
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
  router.push(`/projects/${project.id}`);
};

const handleRefresh = () => {
  refetchProjects();
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
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="border-b bg-white p-6">
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
            {{ isScanning ? 'Scanning...' : 'Scan Projects' }}
          </Button>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-3">
        <ProjectSearchBar v-model="searchQuery" />
        <TechnologyFilter
          v-if="!technologiesLoading && technologies"
          :technologies="technologies"
          :selected-technologies="selectedTechnologies"
          @update:selected-technologies="selectedTechnologies = $event"
        />
        <SortControl
          v-if="viewMode === 'card'"
          :sort-field="sortField"
          :sort-direction="sortDirection"
          @update:sort-field="sortField = $event"
          @update:sort-direction="sortDirection = $event"
        />
        <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />
      </div>

      <!-- Results count -->
      <div v-if="!projectsLoading" class="mt-4 text-sm text-slate-600">
        {{ resultsText }}
      </div>
    </div>

    <!-- Projects Table/Grid -->
    <div class="flex-1 overflow-y-auto bg-slate-50 p-6">
      <ProjectsTable
        :projects="projects"
        :is-loading="projectsLoading"
        :view-mode="viewMode"
        :sorting="tableSorting"
        @update:sorting="tableSorting = $event"
        @delete="handleDeleteProject"
        @open="handleOpenProject"
      />
    </div>
  </div>
</template>
