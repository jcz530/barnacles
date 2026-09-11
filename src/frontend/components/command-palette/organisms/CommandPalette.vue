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
import { Check, CircleAlert, SearchIcon } from 'lucide-vue-next';
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
import { useCommandStatus } from '@/commands/useCommandStatus';
import { useIsMac } from '@/composables/useIsMac';
import { usePointerMoved } from '@/composables/usePointerMoved';
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
const isMac = useIsMac();
const { moved: pointerMoved, arm: armPointerGate } = usePointerMoved();
const { status, report, clear: clearStatus } = useCommandStatus();
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

  // A placeholder is not a result. It stands in for rows still arriving, which
  // is worth showing in the empty state but never worth matching a search.
  return groupRankedCommands(
    results.value
      .slice(0, MAX_RESULTS)
      .filter(result => !result.item.loading)
      .map(result => ({ item: result.item, score: result.score })),
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
  // The floating window is shown *before* the main process sends the message
  // that gets us here, so this cannot be what beats the synthetic pointermove --
  // usePointerMoved keeps the pointer's last position across opens for that.
  // This only clears the verdict, so a move made during the last open does not
  // count as one made during this.
  armPointerGate();
  stack.reset();
  clearStatus();
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

/**
 * Back out a level, if there is one, and put the caret back.
 *
 * A no-op at the root -- see CommandContext.pop. Commands use this to finish
 * without closing, so it has to be safe to call from any depth.
 */
const popLevel = () => {
  stack.pop();
  focusInput();
};

const buildContext = (): CommandContext => ({
  surface: 'in-app',
  navigate: () => {},
  dismiss: () => emit('dismiss'),
  pop: popLevel,
  status: report,
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
  // A placeholder is not rendered as a selectable row, so this should be
  // unreachable -- but it costs a line and keeps a future refactor honest.
  if (item.loading) return;

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
 * Inside a level it backs out one and stops there. At the root it asks the host
 * to close, rather than letting the key travel and hoping something catches it:
 * the combobox consumes Escape of its own accord, so reka's dismissable layer
 * never saw it and the in-app dialog simply stayed open.
 *
 * The floating window's host intercepts Escape in the main process before this
 * renderer runs at all, so it is unaffected either way.
 */
const handleEscapeKey = (event: KeyboardEvent) => {
  event.preventDefault();
  if (!goBack()) emit('dismiss');
};

/**
 * Ctrl+C closes outright, from any depth.
 *
 * Escape backs out one level at a time, which is right when you are stepping
 * through actions but tedious when you are three levels down and simply done.
 * Ctrl+C is what a developer's hands already reach for to mean "get me out of
 * this" -- it is SIGINT in every shell on every platform.
 *
 * The exception is copying. In a GUI text field Windows and Linux use Ctrl+C
 * for copy, so with a selection in the search box the key is left alone and
 * the browser copies as usual. macOS copies with Cmd+C, so Ctrl+C is
 * unambiguous there and closes whatever is selected.
 */
const handleCtrlC = (event: KeyboardEvent) => {
  if (!isMac.value && hasSelection(event)) return;

  event.preventDefault();
  emit('dismiss');
};

// goBack is exposed because the in-app dialog owns Escape: reka's dismissable
// layer listens on the document, so the palette cannot intercept it locally.
//
// report and popLevel are exposed for a different reason: a host builds the
// real CommandContext (only it has a router, or the IPC to close a window), but
// the status line and the level stack live here. This is how what a command
// reports gets back in.
defineExpose({ reset, focusInput, goBack, report, popLevel });

/**
 * Is the caret at `edge`, with nothing selected?
 *
 * The arrows double as navigation only where they cannot mean "move the
 * caret" -- at the far end of what has been typed, and never across a
 * selection. An empty box satisfies both edges, which is the common case.
 */
/** Is any of the search box's text selected? */
const hasSelection = (event: KeyboardEvent): boolean => {
  const input = event.target as HTMLInputElement | null;
  if (!input) return false;

  const { selectionStart, selectionEnd } = input;
  return selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd;
};

const caretAt = (event: KeyboardEvent, edge: 'start' | 'end'): boolean => {
  const input = event.target as HTMLInputElement | null;
  if (!input) return false;

  const { selectionStart, selectionEnd, value } = input;
  if (selectionStart === null || selectionStart !== selectionEnd) return false;

  return edge === 'start' ? selectionStart === 0 : selectionStart === value.length;
};

/**
 * Left backs out a level, but only from the start of the box where it cannot
 * mean "move the caret" -- and never closes the palette. Like Shift+Tab, it is
 * a navigation key: closing on it at the root would be a surprise.
 */
const backFromCaretStart = (event: KeyboardEvent) => {
  if (caretAt(event, 'start') && goBack()) event.preventDefault();
};

/**
 * Right opens the highlighted row's actions, mirroring Left -- and only from
 * the end of the box, where it cannot mean "move the caret".
 *
 * The same gesture as a file tree: Left goes out, Right goes in.
 */
const openFromCaretEnd = (event: KeyboardEvent) => {
  if (caretAt(event, 'end') && openActions(highlighted.value)) event.preventDefault();
};

// The host needs to know how deep we are: in the floating window the main
// process decides whether Escape closes the window, and at depth it must not.
watch(depth, value => emit('depthChange', value), { immediate: true });

/**
 * Typing means the person has moved on from whatever was reported.
 *
 * Bound to the input's own event rather than watching `activeQuery`. That is a
 * computed over each level's saved query, so it changes when a level is pushed
 * or popped as well as when a key is pressed -- and clearing on that would take
 * the message with it in exactly the two cases it matters most: "Set Default",
 * which pops as it reports, and killing a port, which collapses the level the
 * kill was run from. A message has to outlive the level that raised it.
 */
const handleQueryInput = () => clearStatus();
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
  <!--
    highlight-on-hover stays off until the mouse actually moves. reka highlights
    a row on pointermove rather than pointerenter, and the floating window opens
    centred on the cursor's own display -- so it appears under a stationary
    pointer, which fires one synthetic pointermove and handed the highlight to
    whichever row landed beneath it instead of the first. See usePointerMoved.
  -->
  <ComboboxRoot
    :open="true"
    :ignore-filter="true"
    :reset-search-term-on-select="false"
    :reset-search-term-on-blur="false"
    :highlight-on-hover="pointerMoved"
    :class="['flex flex-col overflow-hidden', heightClass ?? 'max-h-[60vh]']"
    @highlight="highlightedId = ($event?.value as string) ?? null"
  >
    <!--
      A step darker than the default border token, which is slate-100: this rule
      separates the search box from the results rather than dividing rows within
      a list, and at slate-100 it read as a seam rather than an edge.
    -->
    <div class="flex items-center gap-2 border-b border-b-slate-400/60 px-4">
      <SearchIcon class="size-4 shrink-0 opacity-50" />
      <ComboboxInput
        ref="inputRef"
        v-model="activeQuery"
        :placeholder="
          stack.placeholder.value ?? placeholder ?? 'Search projects, ports, and commands…'
        "
        class="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-hidden"
        auto-focus
        @input="handleQueryInput"
        @keydown.escape="handleEscapeKey"
        @keydown.ctrl.c.exact="handleCtrlC"
        @keydown.left="backFromCaretStart"
        @keydown.right="openFromCaretEnd"
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

      <!--
        Keyed on the label too: several groups can share an id now that a row
        can name its own heading, and the id alone would repeat.
      -->
      <ComboboxGroup v-for="group in groups" :key="`${group.id}:${group.label}`" class="pb-1">
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

    <!--
      What the last command did, directly above the footer.

      Below the list rather than under the search box: up there it displaced
      every row on screen, and the list is the thing being read. Down here the
      only thing it moves is itself and the footer, both already at the bottom
      edge -- and it sits beside the footer's own verb, which is where the
      result of pressing Enter belongs.

      Keyed on the status id so a repeat of the same message -- copying one path
      twice -- re-announces rather than sitting inert, and role="status" so a
      screen reader hears it without focus moving.
    -->
    <div
      v-if="status"
      :key="status.id"
      role="status"
      aria-live="polite"
      class="flex shrink-0 items-center gap-2 border-t border-t-slate-400/60 px-4 py-2 text-xs"
      :class="status.kind === 'error' ? 'text-danger-500' : 'text-success-500'"
    >
      <!--
        A bare check for success, but the circled alert for an error: the ring
        is doing work there, marking the one case worth stopping for.
      -->
      <component :is="status.kind === 'error' ? CircleAlert : Check" class="size-3.5" />
      <span class="truncate">{{ status.message }}</span>
    </div>

    <CommandPaletteFooter
      :breadcrumb="breadcrumb"
      :primary-label="highlighted?.primaryActionLabel"
      :has-actions="!!highlighted?.actions"
    />
  </ComboboxRoot>
</template>
