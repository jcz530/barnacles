<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { computed, inject, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import * as shiki from 'shiki';
import { Skeleton } from '../../ui/skeleton';
import { Button } from '../../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import {
  Code,
  Copy,
  FileCheck,
  FileText,
  FolderOpen,
  Image,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  WrapText,
  X,
} from 'lucide-vue-next';
import { formatFileSize, getFileTypeInfo } from '@/utils/file-types';
import { RUNTIME_CONFIG } from '../../../../shared/constants';
import { useDark, useLocalStorage } from '@vueuse/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import FileEditor from './FileEditor.vue';
import { resolveShikiLanguage, SHIKI_LANGUAGES } from '@/utils/file-language';
import { toastDanger, toastSuccess } from '../../ui/sonner';
import type { FileEncoding } from '@/types/window';

interface Props {
  filePath?: string | null;
  projectPath: string;
  /** Whether this surface offers in-app editing. */
  editable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  filePath: null,
  editable: true,
});

const emit = defineEmits<{
  /** Mirrors unsaved-changes state so parents can guard navigation away. */
  'update:dirty': [dirty: boolean];
}>();
const projectId = inject<ComputedRef<string> | undefined>('projectId', undefined);

const isLoading = ref(false);
const fileContent = ref<string | null>(null);
const fileType = ref<'text' | 'binary' | 'media' | null>(null);
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

// Get the filename (last part of path) for config file detection
const fileName = computed(() => {
  if (!props.filePath) return undefined;
  const parts = props.filePath.split('/');
  return parts[parts.length - 1];
});

// Determine the language for syntax highlighting. Shared with the editor so
// view and edit modes never disagree about what a file is.
const detectedLanguage = computed(() => resolveShikiLanguage(props.filePath));

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
      langs: [...SHIKI_LANGUAGES],
    });
  } catch (err) {
    console.error('Failed to initialize syntax highlighter:', err);
  }
});

// --- Editing state -------------------------------------------------------
// Editing goes through a separate IPC read (files:read-file-for-edit) because a
// safe save needs the file's encoding details plus the mtime/size identity used
// to detect a conflicting write.

const isEditing = ref(false);
const editedContent = ref('');
const originalContent = ref('');
const fileEncoding = ref<FileEncoding | null>(null);
const expectedMtimeMs = ref<number | undefined>(undefined);
const expectedSize = ref<number | undefined>(undefined);
const isSaving = ref(false);
// Soft wrap is on by default so long lines never need horizontal scrolling;
// persisted so the choice survives switching files and restarting the app.
const wrapLines = useLocalStorage('barnacles:editor-wrap-lines', true);
const editBlockedReason = ref<string | null>(null);
const showSensitiveWarning = ref(false);
const showConflictDialog = ref(false);
const showDiscardDialog = ref(false);
const pendingSensitivePath = ref<string | null>(null);

const isDirty = computed(() => isEditing.value && editedContent.value !== originalContent.value);

watch(isDirty, dirty => emit('update:dirty', dirty));

/** Resolves the path to read/write, matching loadFile's resolution. */
const resolveFullPath = (): string | null => {
  if (!props.filePath) return null;
  if (props.filePath.startsWith('/') || props.filePath.startsWith('~')) return props.filePath;
  return props.projectPath ? `${props.projectPath}/${props.filePath}` : props.filePath;
};

/** Editing is only offered for text we can round-trip safely. */
const canEdit = computed(() => {
  if (!props.editable || !props.filePath || isLoading.value || error.value) return false;
  // Media and images are read-only; SVG is editable as text.
  const category = fileTypeInfo.value.category;
  if (category === 'video' || category === 'audio') return false;
  if (category === 'image' && !isSvgFile.value) return false;
  return true;
});

const NOT_EDITABLE_MESSAGES: Record<string, string> = {
  binary: 'This file contains binary data and cannot be edited safely.',
  'not-utf8': 'This file is not valid UTF-8 and cannot be edited without corrupting it.',
  'too-large': 'This file is too large to edit.',
  'ambiguous-line-endings':
    'This file mixes carriage returns in a way that cannot be edited without ' +
    'changing bytes you did not touch. Open it in an external editor instead.',
};

/** Reads the file for editing and enters edit mode, or explains why it cannot. */
const isOpeningEditor = ref(false);

const beginEditing = async (skipSensitiveCheck = false) => {
  const fullPath = resolveFullPath();
  // Re-entrancy guard: double-clicking Edit would otherwise issue two reads and
  // let the slower one set the conflict baseline from a different snapshot.
  if (!fullPath || isOpeningEditor.value) return;
  isOpeningEditor.value = true;
  try {
    await openForEditing(fullPath, skipSensitiveCheck);
  } finally {
    isOpeningEditor.value = false;
  }
};

const openForEditing = async (fullPath: string, skipSensitiveCheck: boolean) => {
  editBlockedReason.value = null;

  let result: Awaited<ReturnType<typeof window.electron.files.readFileForEdit>>;
  try {
    result = await window.electron.files.readFileForEdit(fullPath);
  } catch (err) {
    // Without this the rejection is unhandled and the button looks inert --
    // the same invisible-failure mode as the structured-clone bug on save.
    console.error('Failed to open file for editing:', err);
    toastDanger('Could not open this file for editing', {
      description: err instanceof Error ? err.message : 'Unexpected error',
    });
    return;
  }

  if (!result.success || !result.data) {
    editBlockedReason.value = result.error || 'Could not open this file for editing';
    return;
  }

  const data = result.data;

  if (!data.editable) {
    editBlockedReason.value =
      NOT_EDITABLE_MESSAGES[data.reason || ''] || 'This file cannot be edited.';
    return;
  }

  // Credential files get a warning before the editor opens.
  if (data.isSensitive && !skipSensitiveCheck) {
    pendingSensitivePath.value = data.realPath || fullPath;
    showSensitiveWarning.value = true;
    return;
  }

  originalContent.value = data.content || '';
  editedContent.value = data.content || '';
  fileEncoding.value = data.encoding || null;
  expectedMtimeMs.value = data.mtimeMs;
  expectedSize.value = data.size;
  isEditing.value = true;
};

const confirmSensitiveEdit = async () => {
  showSensitiveWarning.value = false;
  pendingSensitivePath.value = null;
  await beginEditing(true);
};

// Escape and overlay clicks close the dialog without firing Cancel's handler,
// which would otherwise leave a stale credential path to show in the next one.
watch(showSensitiveWarning, open => {
  if (!open) pendingSensitivePath.value = null;
});

/** Writes the buffer back to disk. `force` skips the conflict check. */
const saveFile = async (force = false) => {
  const fullPath = resolveFullPath();
  if (!fullPath || !fileEncoding.value || isSaving.value) return;

  isSaving.value = true;
  try {
    const result = await window.electron.files.writeFile({
      filePath: fullPath,
      content: editedContent.value,
      // toRaw + spread: ipcRenderer.invoke serializes with structured clone,
      // which throws on Vue's reactive Proxy ("An object could not be cloned").
      encoding: { ...toRaw(fileEncoding.value) },
      expectedMtimeMs: expectedMtimeMs.value,
      expectedSize: expectedSize.value,
      force,
    });

    if (!result.success) {
      if (result.reason === 'conflict') {
        showConflictDialog.value = true;
        return;
      }
      toastDanger('Could not save the file', {
        description: result.error || 'Unknown error',
      });
      return;
    }

    // Re-baseline so the buffer is no longer dirty and the next save has a
    // current identity to check against.
    originalContent.value = editedContent.value;
    expectedMtimeMs.value = result.data?.mtimeMs;
    expectedSize.value = result.data?.size;
    isEditing.value = false;

    toastSuccess('Saved', { description: fileName.value });

    // Refresh the read-only view so it reflects what is now on disk.
    await loadFile(viewAsText.value);
  } catch (err) {
    console.error('Failed to save file:', err);
    toastDanger('Could not save the file', {
      description: err instanceof Error ? err.message : 'Unexpected error',
    });
  } finally {
    isSaving.value = false;
  }
};

/** Discards the buffer and returns to the read-only view. */
const cancelEditing = () => {
  isEditing.value = false;
  editedContent.value = originalContent.value;
  showDiscardDialog.value = false;
};

// Exposed so a parent guarding navigation can discard the buffer for real.
// The parent must not clear its own dirty mirror: that value is only corrected
// by the isDirty watcher, which does not fire if the buffer never changes --
// leaving the guard permanently disarmed.
defineExpose({
  discardEdits: () => {
    isEditing.value = false;
    editedContent.value = originalContent.value;
  },
});

// --- File actions -------------------------------------------------------
// These mirror the file tree's right-click menu (FileTreeItem.vue) so the same
// actions are reachable from the header without going back to the tree.

const openInFinder = () => {
  const fullPath = resolveFullPath();
  if (!fullPath) return;
  window.electron?.shell.showItemInFolder(fullPath);
};

const copyFileToClipboard = async () => {
  const fullPath = resolveFullPath();
  if (!fullPath) return;
  try {
    const result = await window.electron?.clipboard.writeFile(fullPath);
    if (!result?.success) {
      toastDanger('Could not copy the file', { description: result?.error });
      return;
    }
    toastSuccess('File copied');
  } catch (err) {
    toastDanger('Could not copy the file', {
      description: err instanceof Error ? err.message : 'Unexpected error',
    });
  }
};

const copyPath = async () => {
  const fullPath = resolveFullPath();
  if (!fullPath) return;
  try {
    await navigator.clipboard.writeText(fullPath);
    toastSuccess('Path copied');
  } catch (err) {
    toastDanger('Could not copy the path', {
      description: err instanceof Error ? err.message : 'Unexpected error',
    });
  }
};

const requestCancelEditing = () => {
  if (isDirty.value) {
    showDiscardDialog.value = true;
    return;
  }
  cancelEditing();
};

/** Conflict resolution: take what is on disk and discard the buffer. */
const reloadFromDisk = async () => {
  showConflictDialog.value = false;
  isEditing.value = false;
  await beginEditing(true);
};

const overwriteOnDisk = async () => {
  showConflictDialog.value = false;
  await saveFile(true);
};

// Leaving the app with unsaved work should prompt.
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (isDirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
};

// Cmd/Ctrl+S is also bound inside CodeMirror, but that keymap only sees events
// routed through the editor's DOM -- clicking any header button moves focus out
// and silently breaks the shortcut. This window-level handler covers that.
const handleSaveShortcut = (event: KeyboardEvent) => {
  if (!isEditing.value) return;
  if (event.key !== 's' || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  if (isDirty.value && !isSaving.value) void saveFile(false);
};

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('keydown', handleSaveShortcut);
});
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('keydown', handleSaveShortcut);
});

// Switching files drops any in-progress edit; the parent guards the confirm.
watch(
  () => props.filePath,
  () => {
    isEditing.value = false;
    editedContent.value = '';
    originalContent.value = '';
    editBlockedReason.value = null;
    // Reset the save identity too: leaving file A's encoding/mtime in place
    // while file B is shown means any save that skips beginEditing would write
    // B with A's line endings and check the conflict baseline against A.
    fileEncoding.value = null;
    expectedMtimeMs.value = undefined;
    expectedSize.value = undefined;
  }
);

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
    <!-- `!== null` not truthiness: a 0-byte file is a valid, editable file, and
         `''` would fall through to the no-header plain-text branch. -->
    <div v-else-if="fileContent !== null" class="flex h-full flex-col overflow-hidden">
      <!-- File info header -->
      <!-- shrink-0 keeps the header (and the Save/Cancel buttons) pinned no
           matter how wide the content below is. -->
      <div class="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-3">
        <div class="flex items-center justify-between gap-4">
          <h3 class="flex min-w-0 items-center gap-2 font-medium text-slate-900">
            <!-- A long path truncates rather than pushing the buttons away. -->
            <span class="truncate" :title="filePath || undefined">{{ filePath }}</span>
            <span v-if="isDirty" class="text-primary-600 shrink-0 text-xs font-normal">
              • Unsaved
            </span>
          </h3>
          <!-- Ghost is the only variant without a shadow, and matches the
               flat treatment used in the file tree. -->
          <div class="flex shrink-0 items-center gap-1">
            <!-- Edit / Save controls -->
            <template v-if="isEditing">
              <Button
                variant="ghost"
                size="sm"
                :title="wrapLines ? 'Disable line wrapping' : 'Enable line wrapping'"
                :aria-pressed="wrapLines"
                @click="wrapLines = !wrapLines"
              >
                <WrapText class="h-4 w-4" :class="wrapLines ? '' : 'text-slate-400'" />
              </Button>
              <Button variant="ghost" size="sm" :disabled="isSaving" @click="requestCancelEditing">
                <X class="h-4 w-4" />
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-primary-600 hover:text-primary-700 font-medium"
                :disabled="!isDirty || isSaving"
                @click="saveFile(false)"
              >
                {{ isSaving ? 'Saving...' : 'Save' }}
              </Button>
            </template>
            <Button
              v-else-if="canEdit"
              variant="ghost"
              size="sm"
              class="gap-2"
              title="Edit this file"
              @click="beginEditing(false)"
            >
              <Pencil class="h-4 w-4" />
              Edit
            </Button>

            <!-- SVG view toggle button -->
            <Button
              v-if="isSvgFile"
              variant="ghost"
              size="sm"
              @click="toggleViewMode"
              class="gap-2"
              :title="viewAsText ? 'View as Image' : 'View as Text'"
            >
              <component :is="viewAsText ? Image : Code" class="h-4 w-4" />
            </Button>
            <!-- Copy raw content button -->
            <Button
              variant="ghost"
              size="sm"
              @click="copyToClipboard"
              class="gap-2"
              title="Copy raw file contents"
              :class="{ 'text-success-600': copySuccess }"
            >
              <Copy class="h-4 w-4" />
              {{ copySuccess ? 'Copied!' : 'Raw' }}
            </Button>

            <!-- Same actions as right-clicking the file in the tree -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="sm" title="More actions">
                  <MoreHorizontal class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="openInFinder">
                  <FolderOpen class="h-4 w-4" />
                  View in Finder
                </DropdownMenuItem>
                <DropdownMenuItem @click="copyFileToClipboard">
                  <FileCheck class="h-4 w-4" />
                  Copy File
                </DropdownMenuItem>
                <DropdownMenuItem @click="copyPath">
                  <Copy class="h-4 w-4" />
                  Copy Path
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <span class="ml-1 text-xs text-slate-500">{{ formatFileSize(fileSize) }}</span>
          </div>
        </div>
      </div>

      <!-- Why this file cannot be edited -->
      <div
        v-if="editBlockedReason"
        class="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-2"
      >
        <p class="text-xs text-slate-600">{{ editBlockedReason }}</p>
      </div>

      <!-- Mixed line endings get normalized on save, so say so up front -->
      <div
        v-if="isEditing && fileEncoding?.mixedLineEndings"
        class="shrink-0 border-b border-slate-200 bg-slate-50 px-6 py-2"
      >
        <p class="text-xs text-slate-600">
          This file mixes CRLF and LF line endings. Saving normalizes them to
          {{ fileEncoding.lineEnding === 'crlf' ? 'CRLF' : 'LF' }}.
        </p>
      </div>

      <!-- Editor -->
      <div v-if="isEditing" class="min-h-0 min-w-0 flex-1 overflow-hidden">
        <FileEditor
          v-model="editedContent"
          :file-path="filePath"
          :wrap="wrapLines"
          @save="saveFile(false)"
        />
      </div>

      <!-- Content area -->
      <div v-else class="min-h-0 min-w-0 flex-1 overflow-auto">
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

        <!-- Markdown rendering: renderedMarkdown is sanitized via DOMPurify above -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-else-if="renderedMarkdown"
          class="prose prose-slate max-w-none p-6"
          v-html="renderedMarkdown"
        />
        <!-- eslint-enable vue/no-v-html -->

        <!-- Syntax highlighted code: highlightedCode is generated by Shiki, which escapes source text -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else-if="highlightedCode" class="text-sm" v-html="highlightedCode" />

        <!-- Plain text fallback -->
        <pre v-else class="p-6 font-mono text-sm break-words whitespace-pre-wrap text-slate-800">{{
          fileContent
        }}</pre>
      </div>
    </div>

    <!-- Credential files warn before opening the editor -->
    <AlertDialog v-model:open="showSensitiveWarning">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2">
            <ShieldAlert class="text-danger-600 h-5 w-5" />
            Edit a credentials file?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span class="font-mono text-xs">{{ pendingSensitivePath }}</span> holds key material or
            credentials. A bad edit can lock you out of servers or services. A backup is kept, but
            proceed carefully.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="pendingSensitivePath = null">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmSensitiveEdit">Edit anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- The file changed underneath us between opening and saving -->
    <AlertDialog v-model:open="showConflictDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>File changed on disk</AlertDialogTitle>
          <AlertDialogDescription>
            This file was modified by something else after you opened it. Reload to take the version
            on disk and lose your edits, or overwrite to keep yours.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="outline" @click="reloadFromDisk">Reload</Button>
          <AlertDialogAction @click="overwriteOnDisk">Overwrite</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- Cancelling with unsaved changes -->
    <AlertDialog v-model:open="showDiscardDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Your edits to {{ fileName }} have not been saved. Discarding cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction @click="cancelEditing">Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
