<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxLabel,
  ComboboxRoot,
} from 'reka-ui';
import { SearchIcon } from 'lucide-vue-next';
import { useFuse } from '@vueuse/integrations/useFuse';
import type { Command } from '@/commands/types';
import { defaultCommands, groupRankedCommands, MAX_RESULTS } from '@/commands/ranking';
import CommandPaletteItem from '../molecules/CommandPaletteItem.vue';

const props = defineProps<{
  commands: Command[];
  /** Placeholder for the search input. */
  placeholder?: string;
  /**
   * Height constraint for the list. The dialog caps against the viewport; the
   * floating window is already a fixed size and should fill it.
   */
  heightClass?: string;
}>();

const emit = defineEmits<{ select: [command: Command]; dismiss: [] }>();

const query = ref('');

const { results } = useFuse(query, () => props.commands, {
  fuseOptions: {
    threshold: 0.3,
    includeScore: true,
    // Matches anywhere in the string -- without this, a match late in a long
    // project path scores far worse than one at the start.
    ignoreLocation: true,
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'keywords', weight: 0.25 },
      { name: 'subtitle', weight: 0.15 },
    ],
  },
  matchAllWhenSearchEmpty: false,
});

const groups = computed(() => {
  if (!query.value.trim()) return defaultCommands(props.commands);
  return groupRankedCommands(
    results.value.slice(0, MAX_RESULTS).map(result => ({ item: result.item, score: result.score }))
  );
});

const inputRef = ref<InstanceType<typeof ComboboxInput> | null>(null);

/**
 * Put the caret in the search box.
 *
 * ComboboxInput's auto-focus only runs on mount, which is enough for the
 * in-app dialog (it mounts fresh every time) but not for the floating window,
 * which mounts once and is merely shown thereafter.
 */
const focusInput = () => {
  nextTick(() => {
    const el = inputRef.value?.$el as HTMLInputElement | undefined;
    el?.focus();
    el?.select();
  });
};

/** Each open should start clean rather than resuming the last search. */
const reset = () => {
  query.value = '';
  focusInput();
};

defineExpose({ reset, focusInput });

/**
 * Running a command is a one-shot action, not a value the palette holds, so
 * items report through their own select event and no selection is bound to the
 * root.
 *
 * Binding one is actively harmful here: ComboboxInput watches the root's model
 * value and writes it back into the search box (resetSearchTermOnSelect, on by
 * default), which stringifies a command id straight into the input. The
 * floating window outlives a single open, so that id then persisted across
 * every subsequent open.
 */
const runCommand = (command: Command) => {
  emit('select', command);
};
</script>

<template>
  <!--
    reset-search-term-on-select must be off. Selecting an item sets Reka's own
    model to that item's value -- ComboboxItem calls onValueChange(props.value)
    whether or not a v-model is bound -- and this flag then writes that value
    back into the search box, pasting a command id like
    "project.open:anla4gsy..." into the input. The floating window outlives a
    single open, so it persisted there until the window was rebuilt.
  -->
  <ComboboxRoot
    :open="true"
    :ignore-filter="true"
    :reset-search-term-on-select="false"
    :reset-search-term-on-blur="false"
    :class="['flex flex-col overflow-hidden', heightClass ?? 'max-h-[60vh]']"
  >
    <div class="flex items-center gap-2 border-b px-4">
      <SearchIcon class="size-4 shrink-0 opacity-50" />
      <ComboboxInput
        ref="inputRef"
        v-model="query"
        :placeholder="placeholder ?? 'Search projects, ports, and commands…'"
        class="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-hidden"
        auto-focus
        @keydown.escape="emit('dismiss')"
      />
    </div>

    <!--
      Items have to sit inside ComboboxContent for Reka to register them as
      navigable -- in a plain div the arrow keys do nothing. position="inline"
      keeps the list in flow rather than floating it as a dropdown.
    -->
    <ComboboxContent
      position="inline"
      class="min-h-0 flex-1 overflow-y-auto p-2"
      @escape-key-down="emit('dismiss')"
    >
      <ComboboxEmpty class="text-muted-foreground px-3 py-8 text-center text-sm">
        <template v-if="query.trim()">No results for “{{ query }}”</template>
        <template v-else>Start typing to search</template>
      </ComboboxEmpty>

      <ComboboxGroup v-for="group in groups" :key="group.id" class="pb-1">
        <ComboboxLabel class="text-muted-foreground px-3 py-1.5 text-xs font-medium">
          {{ group.label }}
        </ComboboxLabel>
        <CommandPaletteItem
          v-for="command in group.commands"
          :key="command.id"
          :command="command"
          @select="runCommand(command)"
        />
      </ComboboxGroup>
    </ComboboxContent>
  </ComboboxRoot>
</template>
