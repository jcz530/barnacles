<script setup lang="ts">
import type { Theme } from '@/../../shared/types/theme';

defineProps<{
  theme: Theme;
}>();
</script>

<template>
  <div class="flex flex-shrink-0 flex-wrap gap-1">
    <div
      class="h-6 w-6 rounded border"
      :style="{ backgroundColor: theme.primaryColor }"
      :title="`Primary: ${theme.primaryColor}`"
    />
    <div
      class="h-6 w-6 rounded border"
      :style="{ backgroundColor: theme.secondaryColor }"
      :title="`Secondary: ${theme.secondaryColor}`"
    />
    <div
      class="h-6 w-6 rounded border"
      :style="{ backgroundColor: theme.tertiaryColor }"
      :title="`Tertiary: ${theme.tertiaryColor}`"
    />
    <div
      class="h-6 w-6 rounded border"
      :style="{ backgroundColor: theme.slateColor }"
      :title="`Slate: ${theme.slateColor}`"
    />
    <div
      class="h-6 w-6 rounded border"
      :style="{ backgroundColor: theme.successColor }"
      :title="`Success: ${theme.successColor}`"
    />
    <div
      class="h-6 w-6 rounded border"
      :style="{ backgroundColor: theme.dangerColor }"
      :title="`Danger: ${theme.dangerColor}`"
    />
  </div>
</template>
