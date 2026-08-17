<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, ChevronsUpDown, X } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../../shared/types/api';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
} from '../../ui/combobox';
import { Button } from '../../ui/button';

const props = withDefaults(
  defineProps<{
    /** Selected project ids; empty means every project. */
    modelValue: string[];
    projects: ProjectWithDetails[];
    isLoading?: boolean;
  }>(),
  { isLoading: false }
);

const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>();

const open = ref(false);

const selected = computed({
  get: () => props.modelValue,
  set: ids => emit('update:modelValue', ids),
});

const label = computed(() => {
  const count = props.modelValue.length;
  if (count === 0) return 'All projects';
  if (count === 1) {
    const project = props.projects.find(p => p.id === props.modelValue[0]);
    // Fall back to the id if the project list hasn't loaded yet.
    return project?.name ?? props.modelValue[0];
  }
  return `${count} projects`;
});

const clear = (event: Event) => {
  // The clear button lives inside the trigger, so stop it from toggling the list.
  event.stopPropagation();
  emit('update:modelValue', []);
};
</script>

<template>
  <Combobox
    v-model="selected"
    v-model:open="open"
    multiple
    :ignore-filter="false"
    :reset-search-term-on-select="false"
  >
    <ComboboxAnchor as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :disabled="isLoading"
        class="w-56 justify-between font-normal"
      >
        <span class="truncate" :class="modelValue.length ? '' : 'text-slate-500'">
          {{ label }}
        </span>

        <span class="ml-2 flex shrink-0 items-center gap-1">
          <X
            v-if="modelValue.length"
            class="size-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            role="button"
            aria-label="Clear project filter"
            @click="clear"
          />
          <ChevronsUpDown class="size-4 text-slate-400" />
        </span>
      </Button>
    </ComboboxAnchor>

    <ComboboxList class="w-56 p-0">
      <!-- reka-ui filters the items below against this input as you type. -->
      <ComboboxInput placeholder="Search projects..." />

      <ComboboxEmpty>No projects match</ComboboxEmpty>

      <div class="max-h-64 overflow-y-auto p-1">
        <!-- textValue drives the search: the item's value is an id, and its
             children aren't plain text, so without this you'd be filtering
             against ids rather than names. -->
        <ComboboxItem
          v-for="project in projects"
          :key="project.id"
          :value="project.id"
          :text-value="project.name"
          class="flex items-center justify-between gap-2"
        >
          <span class="truncate">{{ project.name }}</span>
          <ComboboxItemIndicator>
            <Check class="text-primary-500 size-4" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </div>
    </ComboboxList>
  </Combobox>
</template>
