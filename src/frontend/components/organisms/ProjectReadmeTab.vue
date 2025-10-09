<script setup lang="ts">
import DOMPurify from 'dompurify';
import { FileText } from 'lucide-vue-next';
import { marked } from 'marked';
import { computed } from 'vue';
import { useQueries } from '../../composables/useQueries';

interface Props {
  projectId: string;
}

const props = defineProps<Props>();

const { useProjectReadmeQuery } = useQueries();
const { data: readme, isLoading } = useProjectReadmeQuery(props.projectId);

const htmlContent = computed(() => {
  if (!readme.value) return null;
  const rawHtml = marked(readme.value) as string;
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
    class="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-slate-100 p-6"
    v-html="htmlContent"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>
