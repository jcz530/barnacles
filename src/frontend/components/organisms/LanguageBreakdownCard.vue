<script setup lang="ts">
import { Code } from 'lucide-vue-next';
import { computed } from 'vue';
import type { ProjectWithDetails } from '../../../shared/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface Props {
  project: ProjectWithDetails;
}

interface LanguageStatsItem {
  fileCount: number;
  percentage: number;
}

type LanguageStats = Record<string, LanguageStatsItem>;

const props = defineProps<Props>();

const languageStats = computed<LanguageStats | null>(() => {
  if (!props.project.stats?.languageStats) return null;
  try {
    const parsed = JSON.parse(props.project.stats.languageStats);
    // Validate the structure
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as LanguageStats;
    }
    return null;
  } catch {
    return null;
  }
});
</script>

<template>
  <Card v-if="languageStats">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Code class="h-5 w-5" />
        Language Breakdown
      </CardTitle>
      <CardDescription>Code composition by language</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="space-y-3">
        <div
          v-for="[techSlug, stats] in Object.entries(languageStats)"
          :key="techSlug"
          class="space-y-1.5"
        >
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
              <div
                class="h-3 w-3 rounded-full"
                :style="{
                  backgroundColor:
                    project.technologies.find(t => t.slug === techSlug)?.color || '#94a3b8',
                }"
              />
              <span class="font-medium text-slate-700">
                {{
                  project.technologies.find(t => t.slug === techSlug)?.name ||
                  techSlug.charAt(0).toUpperCase() + techSlug.slice(1)
                }}
              </span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-500">
                {{ stats.fileCount }} {{ stats.fileCount === 1 ? 'file' : 'files' }}
              </span>
              <span class="font-semibold text-slate-900">{{ stats.percentage }}%</span>
            </div>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full transition-all"
              :style="{
                width: `${stats.percentage}%`,
                backgroundColor:
                  project.technologies.find(t => t.slug === techSlug)?.color || '#94a3b8',
              }"
            />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
