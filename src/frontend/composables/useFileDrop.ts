import { useDropZone } from '@vueuse/core';
import { computed, type MaybeRef, type Ref } from 'vue';

interface UseFileDropOptions {
  onDrop: (files: string[]) => void;
  enabled?: MaybeRef<boolean>;
}

export const useFileDrop = (targetRef: Ref<HTMLElement | null>, options: UseFileDropOptions) => {
  const { isOverDropZone } = useDropZone(targetRef, {
    onDrop: files => {
      // Check if enabled
      const isEnabled =
        typeof options.enabled === 'object' && 'value' in options.enabled
          ? options.enabled.value
          : (options.enabled ?? true);

      if (!isEnabled) return;

      // Get file paths from dropped files using Electron's webUtils
      const filePaths: string[] = [];

      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
            // Use Electron's webUtils.getPathForFile to get the actual file path
            const path = window.electron.files.getPathForFile(file);
            if (path) {
              filePaths.push(path);
            }
          } catch (error) {
            console.error('Failed to get path for file:', error);
          }
        }
      }

      if (filePaths.length > 0) {
        options.onDrop(filePaths);
      }
    },
    // dataTypes: ['Files'],
  });

  // Only show dragging state when enabled
  const isDragging = computed(() => {
    const isEnabled =
      typeof options.enabled === 'object' && 'value' in options.enabled
        ? options.enabled.value
        : (options.enabled ?? true);

    return isEnabled && isOverDropZone.value;
  });

  return {
    isDragging,
    isOverDropZone,
  };
};
