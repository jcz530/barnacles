<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronsUpDown } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../../shared/types/api';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from '../../ui/combobox';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';

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

const clear = () => emit('update:modelValue', []);
</script>

<template>
  <Combobox
    v-model="selected"
    v-model:open="open"
    multiple
    :ignore-filter="false"
    :reset-search-term-on-select="false"
  >
    <!-- Anchor positions the list; Trigger is what actually toggles it open.
         The anchor alone is inert, which is why the button did nothing. -->
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child :disabled="isLoading">
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

          <ChevronsUpDown class="ml-2 size-4 shrink-0 text-slate-400" />
        </Button>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <!-- Width comes from --reka-combobox-trigger-width, so the list matches the
         trigger; don't set an explicit width here. -->
    <!-- The shared ComboboxInput ships a bordered, shadowed box meant for
         standalone use. Inside this panel it should read as a header, so the
         wrapper's border/shadow/rounding are dropped and replaced with a single
         rule below it. Scoped here via data-slot so other comboboxes keep the
         default treatment. -->
    <ComboboxList
      align="start"
      class="p-0 [&_[data-slot=command-input-wrapper]]:rounded-none [&_[data-slot=command-input-wrapper]]:border-0 [&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:border-slate-200 [&_[data-slot=command-input-wrapper]]:shadow-none dark:[&_[data-slot=command-input-wrapper]]:border-slate-700"
    >
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
          class="flex items-center gap-2"
        >
          <!-- Decorative: the item itself owns selection, so the checkbox must
               not steal the click or the focus ring. -->
          <Checkbox
            :model-value="modelValue.includes(project.id)"
            tabindex="-1"
            aria-hidden="true"
            class="pointer-events-none"
          />
          <span class="truncate">{{ project.name }}</span>
        </ComboboxItem>
      </div>

      <template v-if="modelValue.length">
        <!-- Matches the rule under the search input above. -->
        <ComboboxSeparator class="mx-0 bg-slate-200 dark:bg-slate-700" />
        <button
          type="button"
          class="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          @click="clear"
        >
          Clear filters
        </button>
      </template>
    </ComboboxList>
  </Combobox>
</template>
