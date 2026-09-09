<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue';
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
import type { CommandContext, PaletteItem } from '@/commands/types';
import {
  defaultCommands,
  groupRankedCommands,
  LEVEL_LIMITS,
  levelDefaultItems,
  MAX_RESULTS,
} from '@/commands/ranking';
import { useLevelStack } from '@/commands/useLevelStack';
import CommandPaletteItem from '../molecules/CommandPaletteItem.vue';
import CommandPaletteFooter from '../molecules/CommandPaletteFooter.vue';

const props = defineProps<{
  commands: PaletteItem[];
  /** Placeholder for the search input. */
  placeholder?: string;
  /**
   * Height constraint for the list. The dialog caps against the viewport; the
   * floating window is already a fixed size and should fill it.
   */
  heightClass?: string;
}>();

const emit = defineEmits<{
  select: [command: PaletteItem];
  dismiss: [];
  /** Depth of the action stack, so the host can tell "go back" from "close". */
  depthChange: [depth: number];
}>();

const stack = useLevelStack(toRef(props, 'commands'));
const { activeItems, activeQuery, breadcrumb, depth } = stack;

const { results } = useFuse(activeQuery, activeItems, {
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
  const inLevel = depth.value > 0;

  if (!activeQuery.value.trim()) {
    // A level is a short curated list, so it shows everything; the root would
    // be hundreds of rows and shows only what it ranks highest.
    return inLevel ? levelDefaultItems(activeItems.value) : defaultCommands(activeItems.value);
  }

  return groupRankedCommands(
    results.value.slice(0, MAX_RESULTS).map(result => ({ item: result.item, score: result.score })),
    inLevel ? LEVEL_LIMITS : undefined
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
  stack.reset();
  focusInput();
};

/**
 * The row the keyboard is on.
 *
 * Tracked from Reka's own highlight event rather than by binding a model to
 * ComboboxRoot: selecting an item sets the root's model, and ComboboxInput
 * writes that value back into the search box, which pastes a command id like
 * "project.open:anla4gsy..." into the input. See the template comment below.
 */
const highlightedId = ref<string | null>(null);

const highlighted = computed<PaletteItem | null>(
  () => activeItems.value.find(item => item.id === highlightedId.value) ?? null
);

const buildContext = (): CommandContext => ({
  surface: 'in-app',
  navigate: () => {},
  dismiss: () => emit('dismiss'),
  pop: () => {
    stack.pop();
    focusInput();
  },
});

/**
 * Open an item's actions.
 *
 * The context handed to `actions` is only used to build the list, never to run
 * anything, so the navigate/dismiss it carries are the palette's own; running
 * an action still goes out through `select` so the host supplies the real one.
 */
const openActions = (item: PaletteItem | null) => {
  if (!item?.actions) return false;

  const opened = stack.push(item, () => item.actions?.(buildContext()) ?? []);
  if (opened) {
    highlightedId.value = null;
    focusInput();
  }
  return opened;
};

/**
 * Enter. An item with no verb of its own opens its actions instead, which is
 * how "no preferred IDE is set" behaves -- the choice is the action.
 */
const activate = (item: PaletteItem) => {
  if (item.run) {
    emit('select', item);
    return;
  }
  openActions(item);
};

/**
 * Back out one level, or report that there was nowhere to go.
 *
 * Returns whether it handled the gesture so a host that owns the key -- the
 * dialog's Escape, say -- can tell "went back" from "should close".
 */
const goBack = (): boolean => {
  if (!stack.pop()) return false;

  highlightedId.value = null;
  focusInput();
  return true;
};

/**
 * Escape from inside the search box.
 *
 * Backing out of a level consumes the key, so whatever would otherwise close
 * the surface doesn't: reka's dismissable layer dismisses only when the event
 * was not already handled, and the floating window's host checks the same
 * thing before telling the main process to hide.
 *
 * At the root it does nothing and lets the event through, because closing is
 * the surface's business -- a dialog and a panel close differently.
 */
const handleEscapeKey = (event: KeyboardEvent) => {
  if (goBack()) event.preventDefault();
};

// goBack is exposed because the in-app dialog owns Escape: reka's dismissable
// layer listens on the document, so the palette cannot intercept it locally.
defineExpose({ reset, focusInput, goBack });

/**
 * Left backs out a level, but only from the start of the box where it cannot
 * mean "move the caret" -- and never closes the palette. Like Shift+Tab, it is
 * a navigation key: closing on it at the root would be a surprise.
 */
const backFromCaretStart = (event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement | null;
  if (input && input.selectionStart === 0 && input.selectionEnd === 0) {
    if (goBack()) event.preventDefault();
  }
};

// The host needs to know how deep we are: in the floating window the main
// process decides whether Escape closes the window, and at depth it must not.
watch(depth, value => emit('depthChange', value), { immediate: true });
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
    @highlight="highlightedId = ($event?.value as string) ?? null"
  >
    <div class="flex items-center gap-2 border-b px-4">
      <SearchIcon class="size-4 shrink-0 opacity-50" />
      <ComboboxInput
        ref="inputRef"
        v-model="activeQuery"
        :placeholder="
          stack.placeholder.value ?? placeholder ?? 'Search projects, ports, and commands…'
        "
        class="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-hidden"
        auto-focus
        @keydown.escape="handleEscapeKey"
        @keydown.left="backFromCaretStart"
        @keydown.meta.k.prevent="openActions(highlighted)"
        @keydown.ctrl.k.prevent="openActions(highlighted)"
        @keydown.tab.exact.prevent="openActions(highlighted)"
        @keydown.tab.shift.prevent="goBack()"
      />
    </div>

    <!--
      Items have to sit inside ComboboxContent for Reka to register them as
      navigable -- in a plain div the arrow keys do nothing. position="inline"
      keeps the list in flow rather than floating it as a dropdown.
    -->
    <!--
      Escape is handled on the input alone. Wiring it here as well made one
      press pop two levels, since both fire for the same keystroke.
    -->
    <ComboboxContent position="inline" class="min-h-0 flex-1 overflow-y-auto p-2">
      <ComboboxEmpty class="text-muted-foreground px-3 py-8 text-center text-sm">
        <template v-if="activeQuery.trim()">No results for “{{ activeQuery }}”</template>
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
          @select="activate(command)"
        />
      </ComboboxGroup>
    </ComboboxContent>

    <CommandPaletteFooter
      :breadcrumb="breadcrumb"
      :primary-label="highlighted?.primaryActionLabel"
      :has-actions="!!highlighted?.actions"
    />
  </ComboboxRoot>
</template>
