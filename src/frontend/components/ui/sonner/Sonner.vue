<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner';
import { Toaster as Sonner } from 'vue-sonner';

const props = defineProps<ToasterProps>();
</script>

<template>
  <Sonner
    class="toaster group"
    v-bind="props"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--success-bg': 'hsl(142.1 70.6% 45.3%)',
      '--success-text': 'hsl(0 0% 100%)',
      '--success-border': 'var(--color-emerald-400)',
      '--info-bg': 'var(--color-sky-800)',
      '--info-text': 'var(--primary-foreground)',
      '--info-border': 'var(--color-sky-500)',
      '--error-bg': 'var(--destructive)',
      '--error-text': 'var(--destructive-foreground)',
      '--error-border': 'var(--destructive)',
      '--warning-bg': 'hsl(38 92% 50%)',
      '--warning-text': 'hsl(0 0% 100%)',
      '--warning-border': 'var(--color-amber-500)',
    }"
  />
</template>

<style>
/* Variant-specific toast styling */
[data-sonner-toast][data-type='success'] {
  /*
  background-color: var(--success-bg) !important;
  color: var(--success-text) !important;
  */
  border-color: var(--success-border) !important;
  border-bottom: 5px solid var(--success-border) !important;
}

/* Success icon color */
[data-sonner-toast][data-type='success'] [data-icon] {
  color: var(--color-emerald-500) !important;
}

[data-sonner-toast][data-type='info'] {
  /*
  background-color: var(--info-bg) !important;
  color: var(--info-text) !important;
  */
  border-color: var(--info-border) !important;
  border-bottom: 5px solid var(--info-border) !important;
}

[data-sonner-toast][data-type='error'] {
  /*
  background-color: var(--error-bg) !important;
  color: var(--error-text) !important;
  */
  border-color: var(--error-border) !important;
  border-bottom: 5px solid var(--error-border) !important;
}

[data-sonner-toast][data-type='warning'] {
  /*
  background-color: var(--warning-bg) !important;
  color: var(--warning-text) !important;
  */
  border-color: var(--warning-border) !important;
  border-bottom: 5px solid var(--warning-border) !important;
}
</style>
