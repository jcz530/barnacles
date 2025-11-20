<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { computed, inject, onMounted, ref, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import * as shiki from 'shiki';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import { Code, Copy, FileText, Image } from 'lucide-vue-next';
import { formatFileSize, getFileTypeInfo } from '@/utils/file-types';
import { RUNTIME_CONFIG } from '../../../../shared/constants';
import { useDark } from '@vueuse/core';

interface Props {
  filePath?: string | null;
  projectPath: string;
}

const props = withDefaults(defineProps<Props>(), {
  filePath: null,
});
const projectId = inject<ComputedRef<string> | undefined>('projectId', undefined);

const isLoading = ref(false);
const fileContent = ref<string | null>(null);
const fileType = ref<'text' | 'binary' | 'media' | null>(null);
const fileSize = ref<number>(0);
const error = ref<string | null>(null);
const highlighter = ref<shiki.Highlighter | null>(null);
const viewAsText = ref(false); // Toggle for SVG view mode
const copySuccess = ref(false); // Track copy success for visual feedback

// Mapping for config files without extensions or with special names
const CONFIG_FILE_LANGUAGES: Record<string, string> = {
  '.npmrc': 'ini',
  '.bashrc': 'bash',
  '.bash_profile': 'bash',
  '.profile': 'bash',
  '.zshrc': 'bash',
  '.zsh_profile': 'bash',
  '.gitconfig': 'ini',
  '.editorconfig': 'ini',
  '.env': 'properties',
  '.prettierrc': 'json',
  '.eslintrc': 'json',
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  Rakefile: 'ruby',
  Gemfile: 'ruby',
  Podfile: 'ruby',
  '.dockerignore': 'plaintext',
  '.gitignore': 'plaintext',
  '.nvmrc': 'plaintext',
  'tsconfig.json': 'jsonc',
};

// Get file extension and type info
const extension = computed(() => {
  if (!props.filePath) return undefined;
  const parts = props.filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
});

// Get the filename (last part of path) for config file detection
const fileName = computed(() => {
  if (!props.filePath) return undefined;
  const parts = props.filePath.split('/');
  return parts[parts.length - 1];
});

// Determine the language for syntax highlighting
const detectedLanguage = computed(() => {
  // First check if it's a known config file
  if (fileName.value && CONFIG_FILE_LANGUAGES[fileName.value]) {
    return CONFIG_FILE_LANGUAGES[fileName.value];
  }

  // Otherwise use the file type info
  return getFileTypeInfo(extension.value).language;
});

const fileTypeInfo = computed(() => getFileTypeInfo(extension.value));

// File size limits
const MAX_PREVIEWABLE_SIZE = 50 * 1024 * 1024; // 50MB - max size for any preview
const MAX_TEXT_SIZE = 10 * 1024 * 1024; // 10MB - max size for text/code files

// Check if current file is SVG
const isSvgFile = computed(() => extension.value?.toLowerCase() === 'svg');
const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: 'light',
});
// Initialize Shiki highlighter
onMounted(async () => {
  try {
    highlighter.value = await shiki.createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'javascript',
        'typescript',
        'python',
        'html',
        'css',
        'json',
        'jsonc',
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
        'ini',
        'properties',
        'dockerfile',
        'makefile',
        'plaintext',
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

    // First, get file stats to check size before loading
    const statsResult = await window.electron.files.getFileStats(fullPath);

    if (!statsResult.success || !statsResult.data) {
      error.value = statsResult.error || 'Failed to get file information';
      fileContent.value = null;
      fileType.value = null;
      isLoading.value = false;
      return;
    }

    const fileSizeBytes = statsResult.data.size;
    fileSize.value = fileSizeBytes;

    // Check if file is too large to preview
    const category = fileTypeInfo.value.category;

    // For video and audio files, load as binary and create blob URL
    if (category === 'video' || category === 'audio') {
      // For media files, use API streaming (works for both project and non-project files)
      // Store the full path - will be used by mediaSrc to determine which endpoint to use
      fileContent.value = fullPath;
      fileType.value = 'media';
      isLoading.value = false;
      return;
    }

    // For text/code files, enforce stricter size limits
    if (category === 'code' || category === 'document' || forceText) {
      if (fileSizeBytes > MAX_TEXT_SIZE) {
        error.value = `File too large to preview (${formatFileSize(fileSizeBytes)}). Maximum size for text files: ${formatFileSize(MAX_TEXT_SIZE)}`;
        fileContent.value = null;
        fileType.value = null;
        isLoading.value = false;
        return;
      }
    }

    // For all other files, check against absolute max
    if (fileSizeBytes > MAX_PREVIEWABLE_SIZE) {
      error.value = `File too large to preview (${formatFileSize(fileSizeBytes)}). Maximum size: ${formatFileSize(MAX_PREVIEWABLE_SIZE)}`;
      fileContent.value = null;
      fileType.value = null;
      isLoading.value = false;
      return;
    }

    // File size is acceptable, proceed with loading
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
        theme: isDark.value ? 'github-dark' : 'github-light',
      });
    } catch (err) {
      console.error('Syntax highlighting error:', err);
      return null;
    }
  }

  // Use the detected language (handles config files and regular files)
  const lang = detectedLanguage.value;

  // Skip highlighting for documents (markdown is handled separately)
  if (!lang || fileTypeInfo.value.category === 'document') {
    return null;
  }

  try {
    return highlighter.value.codeToHtml(fileContent.value, {
      lang,
      theme: isDark.value ? 'github-dark' : 'github-light',
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

// Check if file is a video
const isVideo = computed(() => {
  return fileTypeInfo.value.category === 'video' && fileType.value === 'media';
});

// Check if file is audio
const isAudio = computed(() => {
  return fileTypeInfo.value.category === 'audio' && fileType.value === 'media';
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

// Get video/audio source URL for streaming
const mediaSrc = computed(() => {
  if ((!isVideo.value && !isAudio.value) || !fileContent.value) return null;

  // fileContent contains the file path for media files
  let filePath = fileContent.value;

  // If we have a projectId AND projectPath, use the project-specific endpoint
  if (projectId?.value && props.projectPath) {
    // If the path is absolute and we have projectPath, make it relative
    if (filePath.startsWith('/') && props.projectPath) {
      // Remove the project path prefix to make it relative
      const projectPathNormalized = props.projectPath.endsWith('/')
        ? props.projectPath
        : props.projectPath + '/';

      if (filePath.startsWith(projectPathNormalized)) {
        filePath = filePath.substring(projectPathNormalized.length);
      } else if (filePath.startsWith(props.projectPath)) {
        // Handle case where projectPath doesn't end with /
        filePath = filePath.substring(props.projectPath.length);
        if (filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
      }
    }

    return `${RUNTIME_CONFIG.API_BASE_URL}/api/projects/${projectId.value}/file?path=${encodeURIComponent(filePath)}`;
  }

  // Otherwise, use the generic file serving endpoint (for related files, config files, etc.)
  return `${RUNTIME_CONFIG.API_BASE_URL}/api/files/serve?path=${encodeURIComponent(filePath)}`;
});

// Get MIME type for video/audio elements
const mediaMimeType = computed(() => {
  if (!extension.value) return '';

  const videoMimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    m4v: 'video/mp4',
  };

  const audioMimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    opus: 'audio/opus',
  };

  const ext = extension.value.toLowerCase();
  return videoMimeTypes[ext] || audioMimeTypes[ext] || '';
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

    await navigator.clipboard.writeText(contentToCopy);
    copySuccess.value = true;

    // Reset success state after 2 seconds
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
      <div class="bg-danger-50 border-danger-200 rounded-lg border p-4">
        <p class="text-danger-700 text-sm">{{ error }}</p>
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
        <!-- Video player -->
        <div v-if="isVideo && mediaSrc" class="flex items-center justify-center bg-black/5 p-6">
          <video
            controls
            :src="mediaSrc"
            :type="mediaMimeType"
            class="h-[70vh] max-w-full rounded-lg shadow-lg"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <!-- Audio player -->
        <div v-else-if="isAudio && mediaSrc" class="flex items-center justify-center p-6">
          <audio controls :src="mediaSrc" :type="mediaMimeType" class="w-full max-w-2xl">
            Your browser does not support the audio tag.
          </audio>
        </div>

        <!-- Image preview -->
        <div v-else-if="isImage && imageSrc" class="p-6">
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
