import { useDropZone } from '@vueuse/core';
import { computed, type MaybeRef, type Ref } from 'vue';

interface UseFileDropOptions {
  onDrop: (files: string[]) => void;
  enabled?: MaybeRef<boolean>;
}

export const useFileDrop = (targetRef: Ref<HTMLElement | null>, options: UseFileDropOptions) => {
  const { isOverDropZone } = useDropZone(targetRef, {
    onDrop: files => {
      console.log('on drop', files);
      // Check if enabled
      const isEnabled =
        typeof options.enabled === 'object' && 'value' in options.enabled
          ? options.enabled.value
          : (options.enabled ?? true);
      console.log('isEnabled', isEnabled);
      if (!isEnabled) return;

      // Get file paths from dropped files
      const filePaths: string[] = [];

      if (files) {
        // In Electron, we can access the file paths directly
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // The path property is available in Electron
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const path = (file as any).path;
          if (path) {
            filePaths.push(path);
          }
        }
      }
      console.log('filePaths', filePaths);

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
