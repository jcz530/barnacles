<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDropZone } from '@vueuse/core';
import { Upload, ImageIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

const emit = defineEmits<{
  fileSelected: [file: File];
}>();

const dropZoneRef = ref<HTMLDivElement>();
const fileInputRef = ref<HTMLInputElement>();

const acceptedFormats = 'image/jpeg,image/jpg,image/png,image/tiff,image/heic,image/heif';

const isValidImageFile = (file: File): boolean => {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/heic',
    'image/heif',
  ];
  return validTypes.includes(file.type);
};

// Use VueUse's useDropZone for drag-and-drop
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop: files => {
    if (files && files.length > 0) {
      const file = files[0];
      if (isValidImageFile(file)) {
        emit('fileSelected', file);
      }
    }
  },
});

const handleFileInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (isValidImageFile(file)) {
      emit('fileSelected', file);
    }
  }
};

const openFilePicker = () => {
  fileInputRef.value?.click();
};

const borderClass = computed(() => {
  return isOverDropZone.value
    ? 'border-primary bg-primary/5'
    : 'border-border hover:border-primary/50';
});
</script>

<template>
  <div
    ref="dropZoneRef"
    :class="[
      'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
      borderClass,
    ]"
  >
    <div class="flex flex-col items-center text-center">
      <div
        :class="[
          'mb-4 rounded-full p-3 transition-colors',
          isOverDropZone ? 'bg-primary/10' : 'bg-muted',
        ]"
      >
        <ImageIcon v-if="!isOverDropZone" class="text-muted-foreground h-8 w-8" />
        <Upload v-else class="text-primary h-8 w-8" />
      </div>

      <h3 class="mb-2 text-lg font-semibold">
        {{ isOverDropZone ? 'Drop image here' : 'Upload an image' }}
      </h3>

      <p class="text-muted-foreground mb-4 text-sm">
        Drag and drop an image file, or click to browse
      </p>

      <Button @click="openFilePicker" variant="outline" size="sm">
        <Upload class="mr-2 h-4 w-4" />
        Select Image
      </Button>

      <p class="text-muted-foreground mt-4 text-xs">Supports: JPEG, PNG, TIFF, HEIC</p>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      :accept="acceptedFormats"
      class="hidden"
      @change="handleFileInput"
    />
  </div>
</template>
