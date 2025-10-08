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
} from '../ui/combobox';

interface Props {
  modelValue?: string;
  suggestions: string[];
  placeholder?: string;
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
  return props.suggestions.filter(cmd =>
    cmd.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});
useVModel(props, 'modelValue', emit);
</script>

<template>
  <Combobox v-bind:model-value="modelValue" by="" class="w-full">
    <ComboboxAnchor class="w-full">
      <ComboboxInput :display-value="val => val ?? ''" :placeholder="placeholder || 'Search...'" />
    </ComboboxAnchor>
    <ComboboxList>
      <ComboboxEmpty> No framework found. </ComboboxEmpty>
      <ComboboxGroup class="max-h-60 overflow-y-scroll">
        <ComboboxItem
          v-for="suggestion in filteredSuggestions"
          :key="suggestion"
          :value="suggestion"
        >
          {{ suggestion }}
          <ComboboxItemIndicator>
            <Check class="ml-auto size-4" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxGroup>
    </ComboboxList>
  </Combobox>
  <!-- <Combobox v-model:open="open" v-model:searchTerm="searchTerm">
    <ComboboxAnchor
      as-child
      :class="
        cn(
          'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden'
        )
      "
    >
      <ComboboxInput
        :placeholder="placeholder || 'Type a command...'"
        :model-value="modelValue"
        @update:model-value="handleInputChange"
        @focus="handleFocus"
        @blur="handleBlur"
      />
    </ComboboxAnchor>

    <ComboboxViewport
      v-if="open && filteredSuggestions.length > 0"
      :class="
        cn(
          'bg-popover text-popover-foreground absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-md'
        )
      "
    >
      <ComboboxEmpty class="py-6 text-center text-sm">No commands found.</ComboboxEmpty>

      <ComboboxItem
        v-for="suggestion in filteredSuggestions"
        :key="suggestion"
        :value="suggestion"
        @select="handleSelect(suggestion)"
        :class="
          cn(
            'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none'
          )
        "
      >
        <Check
          :class="cn('mr-2 h-4 w-4', modelValue === suggestion ? 'opacity-100' : 'opacity-0')"
        />
        {{ suggestion }}
        <ComboboxItemIndicator />
      </ComboboxItem>
    </ComboboxViewport>
  </Combobox> -->
</template>
