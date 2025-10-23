<script setup lang="ts">
import type { Technology } from '../../../../shared/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

interface Props {
  technologies: Technology[];
}

defineProps<Props>();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Technologies</CardTitle>
      <CardDescription>Detected frameworks and tools</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="technologies.length > 0" class="flex flex-wrap gap-2">
        <span
          v-for="tech in technologies"
          :key="tech.id"
          class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
          :style="{
            borderColor: tech.color || '#cbd5e1',
            color: tech.color || '#475569',
            backgroundColor: tech.color ? `${tech.color}15` : '#f1f5f9',
          }"
        >
          <div
            v-if="tech.color"
            class="h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: tech.color }"
          />
          {{ tech.name }}
        </span>
      </div>
      <div v-else class="text-sm text-slate-500">No technologies detected</div>
    </CardContent>
  </Card>
</template>
