<script setup lang="ts">
import type { DetectedIDE, DetectedTerminal, ProjectWithDetails } from '../../../shared/types/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Folder, Calendar, HardDrive, GitBranch, Star } from 'lucide-vue-next';
import { Button } from '../ui/button';
import ProjectIcon from '../atoms/ProjectIcon.vue';
import ProjectActionsDropdown from './ProjectActionsDropdown.vue';

const props = defineProps<{
  project: ProjectWithDetails;
  detectedIDEs?: DetectedIDE[];
  detectedTerminals?: DetectedTerminal[];
}>();

const emit = defineEmits<{
  delete: [projectId: string];
  open: [project: ProjectWithDetails];
  'toggle-favorite': [projectId: string];
}>();

const formatSize = (bytes: number | null | undefined): string => {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return 'Unknown';

  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return `${Math.floor(diffDays / 365)} years ago`;
};

const handleOpen = () => {
  emit('open', props.project);
};

const handleToggleFavorite = (e: Event) => {
  e.stopPropagation();
  emit('toggle-favorite', props.project.id);
};
</script>

<template>
  <Card
    class="cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-slate-200"
    @click="handleOpen"
  >
    <CardHeader class="pb-3">
      <div class="flex items-start justify-between">
        <div class="flex flex-1 items-start gap-3">
          <ProjectIcon
            :project-id="project.id"
            :project-name="project.name"
            :has-icon="!!project.icon"
            size="md"
          />
          <div class="flex-1">
            <CardTitle class="text-lg">{{ project.name }}</CardTitle>
            <CardDescription v-if="project.description" class="mt-1">
              {{ project.description }}
            </CardDescription>
          </div>
        </div>
        <div class="flex items-start gap-1">
          <Button
            variant="ghost"
            size="sm"
            class="h-8 w-8 p-0"
            :class="project.isFavorite ? 'text-yellow-500' : 'text-slate-300'"
            @click="handleToggleFavorite"
          >
            <Star class="h-4 w-4" :fill="project.isFavorite ? 'currentColor' : 'none'" />
          </Button>
          <ProjectActionsDropdown
            :project-id="project.id"
            :project-path="project.path"
            :project-name="project.name"
            :is-archived="!!project.archivedAt"
            :is-favorite="project.isFavorite"
            :git-remote-url="project.stats?.gitRemoteUrl"
            :third-party-size="project.stats?.thirdPartySize"
            :detected-i-d-es="detectedIDEs"
            :detected-terminals="detectedTerminals"
            :preferred-ide-id="project.preferredIde"
            :preferred-terminal-id="project.preferredTerminal"
            @click.stop
          />
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-3">
      <!-- Path -->
      <div class="flex items-center gap-2 text-sm text-slate-600">
        <Folder class="h-4 w-4 flex-shrink-0" />
        <span class="truncate font-mono text-xs">{{ project.path }}</span>
      </div>

      <!-- Technologies -->
      <div v-if="project.technologies.length > 0" class="flex flex-wrap gap-1.5">
        <span
          v-for="tech in project.technologies"
          :key="tech.id"
          class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
          :style="{
            borderColor: tech.color || '#cbd5e1',
            color: tech.color || '#475569',
            backgroundColor: tech.color ? `${tech.color}15` : '#f1f5f9',
          }"
        >
          <div
            v-if="tech.color"
            class="h-2 w-2 rounded-full"
            :style="{ backgroundColor: tech.color }"
          />
          {{ tech.name }}
        </span>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div class="flex items-center gap-1.5">
          <Calendar class="h-3.5 w-3.5" />
          <span>{{ formatDate(project.lastModified) }}</span>
        </div>

        <div class="flex items-center gap-1.5">
          <HardDrive class="h-3.5 w-3.5" />
          <span>{{ formatSize(project.size) }}</span>
        </div>

        <div v-if="project.stats?.gitBranch" class="col-span-2 flex items-center gap-1.5">
          <GitBranch class="h-3.5 w-3.5" />
          <span>{{ project.stats.gitBranch }}</span>
          <span
            v-if="project.stats.hasUncommittedChanges"
            class="ml-auto rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700"
          >
            Uncommitted changes
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
