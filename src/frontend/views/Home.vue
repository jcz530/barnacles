<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ProjectWithDetails } from '../../shared/types/api';
import ProjectCard from '../components/molecules/ProjectCard.vue';
import { useQueries } from '@/composables/useQueries';

const router = useRouter();
const {
  useProjectsQuery,
  useDeleteProjectMutation,
  useToggleFavoriteMutation,
  useProcessStatusQuery,
} = useQueries();

// Get all projects
const { data: allProjects, isLoading } = useProjectsQuery({
  search: ref(''),
  technologies: ref([]),
  includeArchived: ref(false),
});

// Get all process statuses (no project filter)
const { data: allProcessStatuses } = useProcessStatusQuery(undefined, {
  enabled: true,
  refetchInterval: 2000,
});

// Favorite projects
const favoriteProjects = computed(() => {
  if (!allProjects.value) return [];
  return allProjects.value.filter(p => p.isFavorite).slice(0, 6);
});

// Recently modified projects (excluding favorites to avoid duplication)
const recentProjects = computed(() => {
  if (!allProjects.value) return [];
  return allProjects.value
    .filter(p => !p.isFavorite)
    .sort((a, b) => {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 6);
});

// Mutations
const deleteMutation = useDeleteProjectMutation();
const toggleFavoriteMutation = useToggleFavoriteMutation();

// Handlers
const handleOpenProject = (project: ProjectWithDetails) => {
  router.push(`/projects/${project.id}`);
};

const handleDeleteProject = async (projectId: string) => {
  try {
    await deleteMutation.mutateAsync(projectId);
  } catch (error) {
    console.error('Failed to delete project:', error);
    alert('Failed to delete project. Please try again.');
  }
};

const handleToggleFavorite = async (projectId: string) => {
  try {
    await toggleFavoriteMutation.mutateAsync(projectId);
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    alert('Failed to toggle favorite. Please try again.');
  }
};
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <!-- Header -->
    <div class="border-b p-6">
      <h1 class="text-3xl font-bold text-slate-800">Dashboard</h1>
      <p class="mt-1 text-sm text-slate-600">Quick access to your projects</p>
    </div>

    <!-- Content -->
    <div class="flex-1 p-6">
      <div v-if="isLoading" class="py-12 text-center">
        <p class="text-slate-500">Loading projects...</p>
      </div>

      <div v-else class="space-y-8">
        <!-- Favorite Projects Section -->
        <div v-if="favoriteProjects.length > 0">
          <div class="mb-4">
            <h2 class="text-xl font-semibold text-slate-800">Favorite Projects</h2>
            <p class="text-sm text-slate-600">Your starred projects for quick access</p>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ProjectCard
              v-for="project in favoriteProjects"
              :key="project.id"
              :project="project"
              :process-statuses="allProcessStatuses"
              @delete="handleDeleteProject"
              @open="handleOpenProject"
              @toggle-favorite="handleToggleFavorite"
            />
          </div>
        </div>

        <!-- Recently Modified Projects Section -->
        <div v-if="recentProjects.length > 0">
          <div class="mb-4">
            <h2 class="text-xl font-semibold text-slate-800">Recently Modified</h2>
            <p class="text-sm text-slate-600">Projects you've worked on recently</p>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ProjectCard
              v-for="project in recentProjects"
              :key="project.id"
              :project="project"
              :process-statuses="allProcessStatuses"
              @delete="handleDeleteProject"
              @open="handleOpenProject"
              @toggle-favorite="handleToggleFavorite"
            />
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="!isLoading && favoriteProjects.length === 0 && recentProjects.length === 0"
          class="py-12 text-center"
        >
          <p class="text-slate-600">No projects found. Try scanning for projects.</p>
        </div>
      </div>
    </div>
  </div>
</template>
