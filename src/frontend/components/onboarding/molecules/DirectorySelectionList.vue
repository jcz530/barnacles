<script setup lang="ts">
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
import { FolderOpen } from 'lucide-vue-next';
import { ref, watch } from 'vue';

interface Props {
  directories: string[];
  modelValue: string[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

// Local state for selected directories
const selectedDirs = ref<Set<string>>(new Set(props.modelValue));

// Sync with modelValue prop
watch(
  () => props.modelValue,
  newValue => {
    selectedDirs.value = new Set(newValue);
  }
);

const isChecked = (dir: string) => {
  return selectedDirs.value.has(dir);
};

const toggleDirectory = (dir: string) => {
  const newSet = new Set(selectedDirs.value);
  if (newSet.has(dir)) {
    newSet.delete(dir);
  } else {
    newSet.add(dir);
  }
  selectedDirs.value = newSet;
  emit('update:modelValue', Array.from(newSet));
};
</script>

<template>
  <div class="flex flex-col gap-2">
    <Label
      v-for="dir in directories"
      :key="dir"
      class="flex cursor-pointer items-center gap-3 rounded-lg border-1 border-slate-300 bg-slate-100 px-4 py-3 transition-colors hover:border-slate-400 hover:bg-slate-100"
    >
      <Checkbox
        :model-value="isChecked(dir)"
        @update:model-value="() => toggleDirectory(dir)"
        class="cursor-pointer"
      />
      <FolderOpen :size="18" class="text-muted-foreground" />
      <span class="flex-1 cursor-pointer font-mono text-sm select-none">{{ dir }}</span>
    </Label>
  </div>
</template>
