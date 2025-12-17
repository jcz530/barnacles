<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue';
import { inject } from 'vue';
import FileExplorer from '../../files/organisms/FileExplorer.vue';

const projectPath = inject<ComputedRef<string | undefined>>('projectPath');
const projectId = inject<Ref<string>>('projectId');
</script>

<template>
  <div v-if="projectPath" class="h-[calc(100vh-16rem)] rounded-lg border border-slate-200">
    <FileExplorer :project-path="projectPath" :project-id="projectId" />
  </div>
  <div v-else class="flex h-64 items-center justify-center text-slate-500">
    <p>No project path available</p>
  </div>
</template>
