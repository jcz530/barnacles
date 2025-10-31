<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, File as FileIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';

const props = defineProps<{
  file: File | null;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const imageUrl = ref<string>('');

watch(
  () => props.file,
  newFile => {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
    }

    if (newFile) {
      imageUrl.value = URL.createObjectURL(newFile);
    } else {
      imageUrl.value = '';
    }
  },
  { immediate: true }
);

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
</script>

<template>
  <div v-if="file" class="space-y-4">
    <div class="bg-muted relative overflow-hidden rounded-lg border">
      <img :src="imageUrl" :alt="file.name" class="h-auto max-h-96 w-full object-contain" />
      <Button @click="emit('clear')" variant="secondary" size="icon" class="absolute top-2 right-2">
        <X class="h-4 w-4" />
      </Button>
    </div>

    <div class="bg-card space-y-2 rounded-lg border p-4">
      <div class="flex items-start gap-2">
        <FileIcon class="text-muted-foreground mt-0.5 h-4 w-4" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ file.name }}</p>
          <div class="text-muted-foreground mt-1 flex gap-3 text-xs">
            <span>{{ file.type || 'Unknown type' }}</span>
            <span>{{ formatFileSize(file.size) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
