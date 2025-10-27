<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { inject } from 'vue';
import FileExplorer from '../../files/organisms/FileExplorer.vue';

const projectPath = inject<ComputedRef<string | undefined>>('projectPath');
</script>

<template>
  <div v-if="projectPath" class="h-[calc(100vh-16rem)] rounded-lg border border-slate-200">
    <FileExplorer :project-path="projectPath" />
  </div>
  <div v-else class="flex h-64 items-center justify-center text-slate-500">
    <p>No project path available</p>
  </div>
</template>
