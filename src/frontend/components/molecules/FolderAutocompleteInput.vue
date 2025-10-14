<script setup lang="ts">
import { watchDebounced } from '@vueuse/core';
import { FolderOpen } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { useQueries } from '@/composables/useQueries';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../ui/combobox';

interface Props {
  modelValue?: string;
  placeholder?: string;
  maxDepth?: number;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Type to search directories...',
  maxDepth: 3,
});

const emit = defineEmits<Emits>();

const { useSearchDirectoriesQuery } = useQueries();

const selectedValue = ref(props.modelValue || '');
const inputValue = ref(props.modelValue || '');
const debouncedInputValue = ref('');

// Watch for external modelValue changes
watch(
  () => props.modelValue,
  newValue => {
    selectedValue.value = newValue || '';
    inputValue.value = newValue || '';
  }
);

// Watch selected value changes and emit
watch(selectedValue, newValue => {
  emit('update:modelValue', newValue);
  // Also update input value when selection changes
  inputValue.value = newValue;
});

// Watch inputValue and update debouncedInputValue with a delay
watchDebounced(
  inputValue,
  newValue => {
    debouncedInputValue.value = newValue;
  },
  { debounce: 300 }
);

// Query directories based on debounced search
const directoriesQuery = useSearchDirectoriesQuery(debouncedInputValue, {
  enabled: computed(() => debouncedInputValue.value.length >= 1),
  maxDepth: props.maxDepth,
});

const suggestions = computed(() => {
  return directoriesQuery.data.value || [];
});

const isLoading = computed(() => {
  return directoriesQuery.isFetching.value && inputValue.value.length >= 1;
});
</script>

<template>
  <Combobox v-model="selectedValue" class="w-full">
    <ComboboxAnchor class="w-full">
      <ComboboxInput
        v-model="inputValue"
        :display-value="val => val ?? ''"
        :placeholder="placeholder"
      />
    </ComboboxAnchor>
    <ComboboxList class="w-[var(--reka-combobox-trigger-width)]">
      <ComboboxEmpty v-if="!isLoading">
        {{ inputValue.length < 1 ? 'Type to search for directories' : 'No directories found' }}
      </ComboboxEmpty>
      <ComboboxEmpty v-else> Searching... </ComboboxEmpty>
      <ComboboxGroup v-if="suggestions.length > 0" class="max-h-60 overflow-y-scroll">
        <ComboboxItem v-for="suggestion in suggestions" :key="suggestion" :value="suggestion">
          <FolderOpen :size="14" class="text-muted-foreground mr-2" />
          {{ suggestion }}
        </ComboboxItem>
      </ComboboxGroup>
    </ComboboxList>
  </Combobox>
</template>
