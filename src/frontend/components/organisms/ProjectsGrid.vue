<script setup lang="ts">
import { ref } from 'vue';
import type { ProjectWithDetails } from '../../../shared/types/api';
import ProjectCard from '../molecules/ProjectCard.vue';
import { Skeleton } from '../ui/skeleton';

const props = defineProps<{
  projects: ProjectWithDetails[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  delete: [projectId: string];
  open: [project: ProjectWithDetails];
}>();

const handleDelete = (projectId: string) => {
  emit('delete', projectId);
};

const handleOpen = (project: ProjectWithDetails) => {
  emit('open', project);
};
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="i in 6" :key="i" class="h-48 w-full rounded-lg" />
    </div>

    <div v-else-if="projects.length === 0" class="py-12 text-center">
      <p class="text-slate-600">
        No projects found. Try scanning for projects or adjusting your filters.
      </p>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        @delete="handleDelete"
        @open="handleOpen"
      />
    </div>
  </div>
</template>
