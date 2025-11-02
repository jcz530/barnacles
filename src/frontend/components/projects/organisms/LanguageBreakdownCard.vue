<script setup lang="ts">
import { BarChart3, Code, FileCode2, Files, Grid3x3 } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { ProjectWithDetails } from '../../../../shared/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import PercentageGridChart from '../../ui/atoms/PercentageGridChart.vue';

interface Props {
  project: ProjectWithDetails;
}

interface LanguageStatsItem {
  fileCount: number;
  percentage: number;
  linesOfCode: number;
}

type LanguageStats = Record<string, LanguageStatsItem>;

const props = defineProps<Props>();

const showGridView = ref(true);

const languageStats = computed<LanguageStats | null>(() => {
  return props.project.stats?.languageStats || null;
});

const chartData = computed(() => {
  if (!languageStats.value) return [];

  return Object.entries(languageStats.value).map(([techSlug, stats]) => {
    const technology = props.project.technologies.find(t => t.slug === techSlug);
    return {
      color: technology?.color || '#94a3b8',
      percentage: stats.percentage,
      label: technology?.name || techSlug.charAt(0).toUpperCase() + techSlug.slice(1),
    };
  });
});
</script>

<template>
  <Card v-if="languageStats">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="flex items-center gap-2">
            <Code class="h-5 w-5" />
            Language Breakdown
          </CardTitle>
          <CardDescription>Code composition by language</CardDescription>
        </div>
        <Button variant="outline" size="icon" @click="showGridView = !showGridView" class="h-8 w-8">
          <Grid3x3 v-if="!showGridView" class="h-4 w-4" />
          <BarChart3 v-else class="h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div v-if="showGridView" class="space-y-6">
        <PercentageGridChart
          :data="chartData"
          :gap="8"
          :circle-size="8"
          :total-dots="200"
          full-width
          fixed-gap
        >
          <template #legend="{ onHover }">
            <div class="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <div
                v-for="[techSlug, stats] in Object.entries(languageStats)"
                :key="techSlug"
                class="flex cursor-pointer flex-col items-center transition-opacity"
                @mouseenter="
                  onHover(
                    project.technologies.find(t => t.slug === techSlug)?.name ||
                      techSlug.charAt(0).toUpperCase() + techSlug.slice(1)
                  )
                "
                @mouseleave="onHover(null)"
              >
                <div
                  class="h-3 w-3 rounded-full"
                  :style="{
                    backgroundColor:
                      project.technologies.find(t => t.slug === techSlug)?.color || '#94a3b8',
                  }"
                />
                <span class="text-sm text-slate-700">
                  {{
                    project.technologies.find(t => t.slug === techSlug)?.name ||
                    techSlug.charAt(0).toUpperCase() + techSlug.slice(1)
                  }}
                </span>
                <span class="flex items-center text-xs text-slate-500">
                  {{ stats.fileCount }}
                  <FileCode2 v-if="stats.fileCount === 1" class="ml-0.5 size-3" />
                  <Files v-if="stats.fileCount > 1" class="ml-0.5 size-3" />
                  <span class="px-1">·</span>{{ stats.percentage }}%
                </span>
              </div>
            </div>
          </template>
        </PercentageGridChart>
      </div>

      <div v-else class="space-y-3">
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
