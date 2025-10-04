<script setup lang="ts">
import { RefreshCw, Scan } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ProjectWithDetails } from '../../shared/types/api';
import ViewToggle from '../components/atoms/ViewToggle.vue';
import ProjectSearchBar from '../components/molecules/ProjectSearchBar.vue';
import TechnologyFilter from '../components/molecules/TechnologyFilter.vue';
import ProjectsTable from '../components/organisms/ProjectsTable.vue';
import { Button } from '../components/ui/button';
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

// Queries
const {
  data: projects,
  isLoading: projectsLoading,
  refetch: refetchProjects,
} = useProjectsQuery({
  search: searchQuery,
  technologies: selectedTechnologies,
});

const { data: technologies, isLoading: technologiesLoading } = useTechnologiesQuery();

// Mutations
const scanMutation = useScanProjectsMutation();
const deleteMutation = useDeleteProjectMutation();

// Computed
const isScanning = computed(() => scanMutation.isPending.value);

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
        <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />
      </div>

      <!-- Results count -->
      <div v-if="!projectsLoading && projects" class="mt-4 text-sm text-slate-600">
        {{ projects.length }} {{ projects.length === 1 ? 'project' : 'projects' }}
        <span v-if="searchQuery || selectedTechnologies.length > 0"> found</span>
      </div>
    </div>

    <!-- Projects Table/Grid -->
    <div class="flex-1 overflow-y-auto bg-slate-50 p-6">
      <ProjectsTable
        :projects="projects || []"
        :is-loading="projectsLoading"
        :view-mode="viewMode"
        @delete="handleDeleteProject"
        @open="handleOpenProject"
      />
    </div>
  </div>
</template>
