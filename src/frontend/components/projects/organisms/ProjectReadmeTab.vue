<script setup lang="ts">
import DOMPurify from 'dompurify';
import { FileText } from 'lucide-vue-next';
import { marked } from 'marked';
import type { ComputedRef } from 'vue';
import { computed, inject } from 'vue';
import { RUNTIME_CONFIG } from '../../../../shared/constants';
import { useQueries } from '../../../composables/useQueries';

const projectId = inject<ComputedRef<string>>('projectId');

const { useProjectReadmeQuery } = useQueries();
const { data: readme, isLoading } = useProjectReadmeQuery(projectId!);

/**
 * Transforms relative image paths in markdown to use the API endpoint
 * so they load correctly in the Electron renderer
 */
const transformedMarkdown = computed(() => {
  if (!readme.value) return null;

  // Replace relative image paths with API URLs
  // Matches: ![alt](./path), ![alt](../path), ![alt](path/to/file)
  // But NOT: ![alt](http://...), ![alt](https://...), ![alt](data:...)
  return readme.value.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, imagePath: string) => {
      // Skip absolute URLs
      if (
        imagePath.startsWith('http://') ||
        imagePath.startsWith('https://') ||
        imagePath.startsWith('data:')
      ) {
        return _match;
      }

      // Remove leading ./ if present
      const cleanPath = imagePath.startsWith('./') ? imagePath.slice(2) : imagePath;

      // Construct API URL to serve the file using runtime config with query parameter
      const apiUrl = `${RUNTIME_CONFIG.API_BASE_URL}/api/projects/${projectId!.value}/file?path=${encodeURIComponent(cleanPath)}`;
      return `![${alt}](${apiUrl})`;
    }
  );
});

const htmlContent = computed(() => {
  if (!transformedMarkdown.value) return null;
  const rawHtml = marked(transformedMarkdown.value) as string;
  return DOMPurify.sanitize(rawHtml);
});
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-12">
    <div class="text-sm text-slate-500">Loading README...</div>
  </div>
  <div
    v-else-if="!readme"
    class="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 py-12"
  >
    <FileText class="h-12 w-12 text-slate-400" />
    <div class="text-center">
      <p class="text-sm font-medium text-slate-900">No README.md found</p>
      <p class="mt-1 text-sm text-slate-500">This project doesn't have a README file</p>
    </div>
  </div>
  <!-- eslint-disable vue/no-v-html -->
  <div
    v-else
    class="prose max-w-none rounded-lg border border-slate-200 bg-slate-100 p-6"
    v-html="htmlContent"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
