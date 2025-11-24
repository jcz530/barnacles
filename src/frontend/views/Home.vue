<script setup lang="ts">
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import ProjectCard from '../components/projects/molecules/ProjectCard.vue';
import OnboardingOverlay from '../components/onboarding/organisms/OnboardingOverlay.vue';
import GitStatsOverview from '../components/projects/organisms/GitStatsOverview.vue';
import { useQueries } from '@/composables/useQueries';
import { provideProcessStatusContext } from '@/composables/useProcessStatusContext';
import { useFirstRunDetection } from '@/composables/useFirstRunDetection';
import { useProjectScanWebSocket } from '@/composables/useProjectScanWebSocket';
import { SquareDot, Star } from 'lucide-vue-next';

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

// Provide process status context to all child components
provideProcessStatusContext(allProcessStatuses);

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
      const aTime = a.lastModified ? dayjs(a.lastModified).valueOf() : 0;
      const bTime = b.lastModified ? dayjs(b.lastModified).valueOf() : 0;
      return bTime - aTime;
    })
    .slice(0, 6);
});

// Mutations
const deleteMutation = useDeleteProjectMutation();
const toggleFavoriteMutation = useToggleFavoriteMutation();

// Onboarding detection
const { needsOnboarding } = useFirstRunDetection();

// WebSocket for scan progress
const { startScan } = useProjectScanWebSocket();

// Handlers
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
    <!-- Content -->
    <div class="flex-1 p-6">
      <div v-if="isLoading" class="py-12 text-center">
        <p class="text-slate-500">Loading projects...</p>
      </div>

      <!-- Onboarding Empty State -->
      <div v-else-if="needsOnboarding" class="py-8">
        <OnboardingOverlay :start-scan="startScan" />
      </div>

      <div v-else class="space-y-8">
        <!-- Git Stats Section -->
        <GitStatsOverview />

        <!-- Favorite Projects Section -->
        <div v-if="favoriteProjects.length > 0">
          <div class="mb-4">
            <h2 class="flex gap-2 text-xl font-semibold text-slate-700">
              <Star class="text-primary-400" /> Favorite Projects
            </h2>
            <p class="text-sm text-slate-600">Your starred projects for quick access</p>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ProjectCard
              v-for="project in favoriteProjects"
              :key="project.id"
              :project="project"
              @delete="handleDeleteProject"
              @toggle-favorite="handleToggleFavorite"
            />
          </div>
        </div>

        <!-- Recently Modified Projects Section -->
        <div v-if="recentProjects.length > 0">
          <div class="mb-4">
            <h2 class="flex items-center gap-2 text-xl font-semibold text-slate-700">
              <SquareDot class="text-primary-400" />Recently Modified
            </h2>
            <p class="text-sm text-slate-600">Projects you've worked on recently</p>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ProjectCard
              v-for="project in recentProjects"
              :key="project.id"
              :project="project"
              @delete="handleDeleteProject"
              @toggle-favorite="handleToggleFavorite"
            />
          </div>
        </div>

        <!-- Empty State (when onboarding is complete but no projects) -->
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
