<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ComboboxGroup, ComboboxInput, ComboboxLabel, ComboboxRoot } from 'reka-ui';
import { SearchIcon } from 'lucide-vue-next';
import { useFuse } from '@vueuse/integrations/useFuse';
import type { Command } from '@/commands/types';
import { defaultCommands, groupRankedCommands, MAX_RESULTS } from '@/commands/ranking';
import CommandPaletteItem from '../molecules/CommandPaletteItem.vue';

const props = defineProps<{
  commands: Command[];
  /** Placeholder for the search input. */
  placeholder?: string;
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

const flatCommands = computed(() => groups.value.flatMap(group => group.commands));

/** Reka works in values; map the selected id back to its command. */
const onSelect = (id: unknown) => {
  const command = flatCommands.value.find(entry => entry.id === id);
  if (command) emit('select', command);
};

/** Each open should start clean rather than resuming the last search. */
const reset = () => {
  query.value = '';
};

defineExpose({ reset });

const selected = ref<string | undefined>(undefined);

// Keep the highlight on a real row as results change under the cursor.
watch(groups, () => {
  selected.value = undefined;
});
</script>

<template>
  <ComboboxRoot
    v-model="selected"
    :open="true"
    :ignore-filter="true"
    class="flex max-h-[60vh] flex-col overflow-hidden"
    @update:model-value="onSelect"
  >
    <div class="flex items-center gap-2 border-b px-4">
      <SearchIcon class="size-4 shrink-0 opacity-50" />
      <ComboboxInput
        v-model="query"
        :placeholder="placeholder ?? 'Search projects, ports, and commands…'"
        class="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-hidden"
        auto-focus
        @keydown.escape="emit('dismiss')"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <div v-if="groups.length === 0" class="text-muted-foreground px-3 py-8 text-center text-sm">
        <template v-if="query.trim()">No results for “{{ query }}”</template>
        <template v-else>Start typing to search</template>
      </div>

      <ComboboxGroup v-for="group in groups" :key="group.id" class="pb-1">
        <ComboboxLabel class="text-muted-foreground px-3 py-1.5 text-xs font-medium">
          {{ group.label }}
        </ComboboxLabel>
        <CommandPaletteItem
          v-for="command in group.commands"
          :key="command.id"
          :command="command"
        />
      </ComboboxGroup>
    </div>
  </ComboboxRoot>
</template>
