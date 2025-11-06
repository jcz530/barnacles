<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import { Check } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
} from '../../ui/combobox';

interface Props {
  modelValue?: string;
  suggestions: string[];
  placeholder?: string;
  emptyMessage?: string;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const searchTerm = ref('');

const filteredSuggestions = computed(() => {
  if (!searchTerm.value) {
    return props.suggestions;
  }
  return props.suggestions.filter(font =>
    font.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});

const model = useVModel(props, 'modelValue', emit);
</script>

<template>
  <Combobox v-model="model" by="" class="w-full">
    <ComboboxAnchor class="w-full">
      <ComboboxInput :display-value="val => val ?? ''" :placeholder="placeholder || 'Search...'" />
    </ComboboxAnchor>
    <ComboboxList class="w-[var(--reka-combobox-trigger-width)]">
      <ComboboxEmpty> {{ emptyMessage || 'No matches found' }} </ComboboxEmpty>
      <ComboboxGroup class="max-h-60 overflow-y-scroll">
        <ComboboxItem
          v-for="suggestion in filteredSuggestions"
          :key="suggestion"
          :value="suggestion"
          class="flex items-center justify-between"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate" :style="{ fontFamily: suggestion }">
              {{ suggestion }}
            </p>
            <p class="text-muted-foreground truncate text-xs" :style="{ fontFamily: suggestion }">
              Like barnacles on a ship...
            </p>
          </div>
          <ComboboxItemIndicator>
            <Check class="ml-2 size-4 flex-shrink-0" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxGroup>
    </ComboboxList>
  </Combobox>
</template>
