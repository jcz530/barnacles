<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { computed, inject, onMounted, ref, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import * as shiki from 'shiki';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import { Code, Copy, FileText, Image } from 'lucide-vue-next';
import { formatFileSize, getFileTypeInfo } from '../../../utils/file-types';
import { RUNTIME_CONFIG } from '../../../../shared/constants';

interface Props {
  filePath?: string | null;
  projectPath: string;
}

const props = withDefaults(defineProps<Props>(), {
  filePath: null,
});

const projectId = inject<ComputedRef<string>>('projectId');

const isLoading = ref(false);
const fileContent = ref<string | null>(null);
const fileType = ref<'text' | 'binary' | null>(null);
const fileSize = ref<number>(0);
const error = ref<string | null>(null);
const highlighter = ref<shiki.Highlighter | null>(null);
const viewAsText = ref(false); // Toggle for SVG view mode
const copySuccess = ref(false); // Track copy success for visual feedback

// Get file extension and type info
const extension = computed(() => {
  if (!props.filePath) return undefined;
  const parts = props.filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
});

const fileTypeInfo = computed(() => getFileTypeInfo(extension.value));

// Check if current file is SVG
const isSvgFile = computed(() => extension.value?.toLowerCase() === 'svg');

// Initialize Shiki highlighter
onMounted(async () => {
  try {
    highlighter.value = await shiki.createHighlighter({
      themes: ['github-light'],
      langs: [
        'javascript',
        'typescript',
        'python',
        'html',
        'css',
        'json',
        'markdown',
        'bash',
        'yaml',
        'rust',
        'go',
        'java',
        'php',
        'ruby',
        'vue',
        'xml',
      ],
    });
  } catch (err) {
    console.error('Failed to initialize syntax highlighter:', err);
  }
});

// Function to load file with optional forceText parameter
const loadFile = async (forceText = false) => {
  if (!props.filePath) {
    fileContent.value = null;
    fileType.value = null;
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    // Determine the full path:
    // - If filePath is absolute (starts with /), use it directly
    // - Otherwise, join with projectPath if available
    const fullPath = props.filePath.startsWith('/')
      ? props.filePath
      : props.projectPath
        ? `${props.projectPath}/${props.filePath}`
        : props.filePath;
    const result = await window.electron.files.readFile(fullPath, forceText);

    if (result.success && result.data) {
      fileContent.value = result.data.content;
      fileType.value = result.data.type;
      fileSize.value = result.data.size;
    } else {
      error.value = result.error || 'Failed to read file';
      fileContent.value = null;
      fileType.value = null;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    fileContent.value = null;
    fileType.value = null;
  } finally {
    isLoading.value = false;
  }
};

// Load file content when filePath changes
watch(
  () => props.filePath,
  () => {
    viewAsText.value = false; // Reset to image view when file changes
    loadFile();
  },
  { immediate: true }
);

// Toggle between image and text view for SVG files
const toggleViewMode = async () => {
  viewAsText.value = !viewAsText.value;
  await loadFile(viewAsText.value);
};

/**
 * Transforms relative image paths in markdown to use the API endpoint
 * so they load correctly in the Electron renderer
 */
const transformedMarkdown = computed(() => {
  if (!fileContent.value || fileTypeInfo.value.category !== 'document' || extension.value !== 'md')
    return null;

  if (!projectId) return fileContent.value;

  // Get the directory of the current markdown file
  const fileDir = props.filePath?.includes('/')
    ? props.filePath.substring(0, props.filePath.lastIndexOf('/'))
    : '';

  // Replace relative image paths with API URLs
  // Matches: ![alt](./path), ![alt](../path), ![alt](path/to/file)
  // But NOT: ![alt](http://...), ![alt](https://...), ![alt](data:...)
  return fileContent.value.replace(
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

      // Resolve relative path
      let resolvedPath = imagePath;
      if (imagePath.startsWith('./')) {
        // Same directory as markdown file
        resolvedPath = fileDir ? `${fileDir}/${imagePath.slice(2)}` : imagePath.slice(2);
      } else if (imagePath.startsWith('../')) {
        // Parent directory - need to resolve properly
        const parts = fileDir.split('/').filter(Boolean);
        const imageParts = imagePath.split('/');

        // Remove leading ../ and corresponding parent dirs
        while (imageParts[0] === '..' && parts.length > 0) {
          imageParts.shift();
          parts.pop();
        }

        resolvedPath = [...parts, ...imageParts].join('/');
      } else if (!imagePath.startsWith('/')) {
        // Relative to current file directory
        resolvedPath = fileDir ? `${fileDir}/${imagePath}` : imagePath;
      }

      // Construct API URL to serve the file using runtime config with query parameter
      const apiUrl = `${RUNTIME_CONFIG.API_BASE_URL}/api/projects/${projectId.value}/file?path=${encodeURIComponent(resolvedPath)}`;
      return `![${alt}](${apiUrl})`;
    }
  );
});

// Render markdown content
const renderedMarkdown = computed(() => {
  if (!transformedMarkdown.value) return null;

  const rawHtml = marked(transformedMarkdown.value) as string;
  return DOMPurify.sanitize(rawHtml);
});

// Syntax highlighted code
const highlightedCode = computed(() => {
  if (!fileContent.value || !highlighter.value) return null;

  // For SVG files viewed as text, use XML syntax highlighting
  if (isSvgFile.value && viewAsText.value && fileType.value === 'text') {
    try {
      return highlighter.value.codeToHtml(fileContent.value, {
        lang: 'xml',
        theme: 'github-light',
      });
    } catch (err) {
      console.error('Syntax highlighting error:', err);
      return null;
    }
  }

  // For other files, use the detected language
  if (!fileTypeInfo.value.language || fileTypeInfo.value.category === 'document') {
    return null;
  }

  try {
    return highlighter.value.codeToHtml(fileContent.value, {
      lang: fileTypeInfo.value.language,
      theme: 'github-light',
    });
  } catch (err) {
    console.error('Syntax highlighting error:', err);
    return null;
  }
});

// Check if file is an image (excluding SVG when viewed as text)
const isImage = computed(() => {
  if (isSvgFile.value && viewAsText.value) return false;
  return fileTypeInfo.value.category === 'image' && fileType.value === 'binary';
});

// Get image source for base64 images
const imageSrc = computed(() => {
  if (!isImage.value || !fileContent.value) return null;

  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    bmp: 'image/bmp',
  };

  const mimeType = extension.value ? mimeTypes[extension.value.toLowerCase()] : 'image/png';
  return `data:${mimeType};base64,${fileContent.value}`;
});

// Copy raw file content to clipboard
const copyToClipboard = async () => {
  if (!fileContent.value) return;

  try {
    let contentToCopy = fileContent.value;

    // For SVG files viewed as images, fetch the text content instead of copying base64
    if (isSvgFile.value && fileType.value === 'binary') {
      // Use same logic as loadFile to construct the full path
      const fullPath = props.filePath.startsWith('/')
        ? props.filePath
        : props.projectPath
          ? `${props.projectPath}/${props.filePath}`
          : props.filePath;
      const result = await window.electron.files.readFile(fullPath, true);

      if (result.success && result.data) {
        contentToCopy = result.data.content;
      }
    }

    // eslint-disable-next-line no-undef
    await navigator.clipboard.writeText(contentToCopy);
    copySuccess.value = true;

    // Reset success state after 2 seconds
    // eslint-disable-next-line no-undef
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
};
</script>

<template>
  <div class="flex h-full flex-col bg-slate-200/50">
    <!-- Empty state -->
    <div v-if="!filePath" class="flex h-full flex-col items-center justify-center text-slate-400">
      <FileText class="mb-4 h-16 w-16" />
      <p class="text-sm">Select a file to view its contents</p>
    </div>

    <!-- Loading state -->
    <div v-else-if="isLoading" class="space-y-4 p-6">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-3/4" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="p-6">
      <div class="rounded-lg border border-red-200 bg-red-50 p-4">
        <p class="text-sm text-red-700">{{ error }}</p>
      </div>
    </div>

    <!-- File content -->
    <div v-else-if="fileContent" class="flex h-full flex-col overflow-hidden">
      <!-- File info header -->
      <div class="border-b border-slate-200 bg-slate-50 px-6 py-3">
        <div class="flex items-center justify-between">
          <h3 class="font-medium text-slate-900">{{ filePath }}</h3>
          <div class="flex items-center gap-3">
            <!-- SVG view toggle button -->
            <Button
              v-if="isSvgFile"
              variant="outline"
              size="sm"
              @click="toggleViewMode"
              class="gap-2"
              :title="viewAsText ? 'View as Image' : 'View as Text'"
            >
              <component :is="viewAsText ? Image : Code" class="h-4 w-4" />
            </Button>
            <!-- Copy raw content button -->
            <Button
              variant="outline"
              size="sm"
              @click="copyToClipboard"
              class="gap-2"
              title="Copy raw file contents"
              :class="{ 'border-green-200 bg-green-50 text-green-600': copySuccess }"
            >
              <Copy class="h-4 w-4" />
              {{ copySuccess ? 'Copied!' : 'Raw' }}
            </Button>
            <span class="text-xs text-slate-500">{{ formatFileSize(fileSize) }}</span>
          </div>
        </div>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-auto">
        <!-- Image preview -->
        <div v-if="isImage && imageSrc" class="p-6">
          <img :src="imageSrc" :alt="filePath" class="h-auto max-w-full rounded-lg shadow-sm" />
        </div>

        <!-- Markdown rendering -->
        <div
          v-else-if="renderedMarkdown"
          class="prose prose-slate max-w-none p-6"
          v-html="renderedMarkdown"
        />

        <!-- Syntax highlighted code -->
        <div v-else-if="highlightedCode" class="text-sm" v-html="highlightedCode" />

        <!-- Plain text fallback -->
        <pre v-else class="p-6 font-mono text-sm break-words whitespace-pre-wrap text-slate-800">{{
          fileContent
        }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Override shiki styles for better integration */
:deep(.shiki) {
  padding: 1.5rem;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
}

:deep(.shiki code) {
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
