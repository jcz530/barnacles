<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { RUNTIME_CONFIG } from '../../../shared/constants';
import type { ProjectWithDetails } from '../../../backend/services/project';

// Configure dayjs
dayjs.extend(relativeTime);

interface Props {
  project: ProjectWithDetails;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  openInIDE: [projectId: string];
  openTerminal: [projectId: string];
}>();

/**
 * Sanitize text using DOMPurify to prevent XSS attacks
 * Also removes invisible/control characters and limits length
 */
const sanitizeText = (text: string): string => {
  if (!text) return '';

  // First sanitize with DOMPurify (configured for text-only output)
  const sanitized = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No HTML tags allowed (text only)
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content
  });

  // Remove potentially problematic invisible characters and return cleaned text
  return (
    sanitized
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces, joiners, and byte order marks
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Control characters (tabs, newlines, etc.)
      .trim() // Remove leading/trailing whitespace
      .slice(0, 100)
  ); // Limit to 100 characters max
};

// Sanitized project name
const sanitizedProjectName = computed(() => {
  return sanitizeText(props.project.name) || 'Untitled Project';
});

// Sanitized git branch (from project stats)
const sanitizedGitBranch = computed(() => {
  const branch = props.project.stats?.gitBranch || 'main';
  return sanitizeText(branch);
});

// Format last modified date using dayjs
const formattedLastModified = computed(() => {
  if (!props.project.lastModified) return '';
  return dayjs(props.project.lastModified).fromNow();
});
</script>

<template>
  <div
    class="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-all hover:bg-black/4"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2.5">
      <div class="h-8 w-8 shrink-0">
        <img
          v-if="project.icon"
          :src="`${RUNTIME_CONFIG.API_BASE_URL}/api/projects/${project.id}/icon`"
          class="h-full w-full rounded-md object-cover"
          alt=""
          @error="e => ((e.target as HTMLImageElement).style.display = 'none')"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-pink-400 text-sm font-semibold text-white"
        >
          {{ sanitizedProjectName.charAt(0).toUpperCase() }}
        </div>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="truncate text-[13px] font-medium text-slate-900">
          {{ sanitizedProjectName }}
        </span>
        <span class="flex items-center gap-2 truncate text-[11px] text-slate-600">
          <span>{{ formattedLastModified }}</span>
          <span class="text-slate-400">•</span>
          <span class="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
            {{ sanitizedGitBranch }}
          </span>
        </span>
      </div>
    </div>
    <div class="flex gap-1 transition-opacity">
      <button
        @click.stop="emit('openInIDE', project.id)"
        class="flex items-center justify-center rounded-md bg-black/5 p-1.5 text-slate-900 transition-all hover:scale-105 hover:bg-black/10 active:scale-95"
        title="Open in IDE"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M16 18L22 12L16 6M8 6L2 12L8 18"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        @click.stop="emit('openTerminal', project.id)"
        class="flex items-center justify-center rounded-md bg-black/5 p-1.5 text-slate-900 transition-all hover:scale-105 hover:bg-black/10 active:scale-95"
        title="Open Terminal"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline
            points="4 17 10 11 4 5"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <line x1="12" y1="19" x2="20" y2="19" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>
