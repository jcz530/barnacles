<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import type { Component } from 'vue';
import { computed, ref, watch } from 'vue';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
} from '../ui/combobox';

interface Props {
  modelValue?: string;
  suggestions: string[];
  placeholder?: string;
  emptyMessage?: string;
  icon?: Component;
}

interface Emits {
  (e: 'update:modelValue', value: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// searchTerm is the free-text the user is typing; it is the source of truth
// for the emitted value. Selecting a suggestion below also updates it.
const searchTerm = ref(props.modelValue ?? '');

watch(
  () => props.modelValue,
  value => {
    if (value !== searchTerm.value) {
      searchTerm.value = value ?? '';
    }
  }
);

watch(searchTerm, value => {
  emit('update:modelValue', value);
});

const filteredSuggestions = computed(() => {
  if (!searchTerm.value) {
    return props.suggestions;
  }
  return props.suggestions.filter(cmd =>
    cmd.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});

const handleSelect = (suggestion: string) => {
  searchTerm.value = suggestion;
};

// Show a "use as custom value" option whenever the typed text doesn't
// exactly match an existing suggestion, so it's clear the typed value is
// usable rather than implying it'll be discarded like a normal "no matches".
const showCustomValueOption = computed(
  () => !!searchTerm.value && !props.suggestions.includes(searchTerm.value)
);
</script>

<template>
  <Combobox :model-value="searchTerm" by="" ignore-filter class="w-full">
    <ComboboxAnchor class="w-full">
      <ComboboxInput
        v-model="searchTerm"
        :display-value="val => val ?? ''"
        :placeholder="placeholder || 'Search...'"
        :icon="icon"
      />
    </ComboboxAnchor>
    <ComboboxList>
      <div
        v-if="!showCustomValueOption && filteredSuggestions.length === 0"
        class="text-muted-foreground py-6 text-center text-sm"
      >
        {{ emptyMessage || 'No matches found' }}
      </div>
      <ComboboxGroup class="max-h-60 overflow-y-scroll">
        <ComboboxItem
          v-if="showCustomValueOption"
          :value="searchTerm"
          @select="handleSelect(searchTerm)"
        >
          Use "{{ searchTerm }}"
        </ComboboxItem>
        <ComboboxItem
          v-for="suggestion in filteredSuggestions"
          :key="suggestion"
          :value="suggestion"
          @select="handleSelect(suggestion)"
        >
          {{ suggestion }}
          <ComboboxItemIndicator>
            <Check class="ml-auto size-4" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxGroup>
    </ComboboxList>
  </Combobox>
</template>
