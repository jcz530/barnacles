<script setup lang="ts">
import Button from '../../ui/button/Button.vue';
import { FolderOpen, X } from 'lucide-vue-next';

interface Props {
  directories: string[];
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  remove: [index: number];
}>();

const handleRemove = (index: number) => {
  emit('remove', index);
};
</script>

<template>
  <div class="mt-2 flex flex-wrap gap-2">
    <div
      v-for="(dir, index) in directories"
      :key="index"
      class="flex items-center gap-1 rounded-md border-1 border-slate-400 bg-slate-200 px-3 py-1 text-sm"
    >
      <FolderOpen :size="14" class="text-muted-foreground" />
      <span>{{ dir }}</span>
      <Button
        size="icon"
        variant="ghost"
        @click="handleRemove(index)"
        class="hover:text-destructive ml-1 size-4 transition-colors"
        :disabled="disabled"
      >
        <X :size="14" />
      </Button>
    </div>
  </div>
</template>
