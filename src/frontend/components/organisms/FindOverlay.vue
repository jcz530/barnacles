<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { onKeyStroke, useDebounceFn } from '@vueuse/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, ChevronUp, ChevronDown } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const searchText = ref('');
const matchCase = ref(false);
const currentMatch = ref(0);
const totalMatches = ref(0);
const inputRef = ref<{ $el: HTMLInputElement } | null>(null);

// Computed property for match display using zero-width characters to avoid being searchable
const matchDisplay = computed(() => {
  if (!searchText.value) return '';
  if (totalMatches.value > 0) {
    // Insert zero-width spaces between characters to make it less searchable
    return `${currentMatch.value}\u200B \u200Bof\u200B ${totalMatches.value}`;
  }
  return 'No\u200B matches';
});

let cleanupListener: (() => void) | null = null;

// Helper function to ensure input keeps focus
const ensureFocus = () => {
  // Use both nextTick and a small timeout to ensure focus is restored
  // after Electron's findInPage operation completes
  // nextTick(() => {
  //   setTimeout(() => {
  //     if (inputRef.value?.$el && document.activeElement !== inputRef.value.$el) {
  //       inputRef.value.$el.focus();
  //     }
  //   }, 50);
  // });
};

// Setup find result listener
onMounted(() => {
  window.electron.find.setupListener();
  cleanupListener = window.electron.find.onResult(result => {
    if (result.finalUpdate) {
      currentMatch.value = result.activeMatchOrdinal;
      totalMatches.value = result.matches;
    }
  });
});

onUnmounted(() => {
  if (cleanupListener) {
    cleanupListener();
  }
  handleClose();
});

// Focus input when overlay is shown
watch(
  () => props.show,
  newShow => {
    if (newShow) {
      // Use nextTick and a small delay to ensure DOM is updated
      nextTick(() => {
        setTimeout(() => {
          if (inputRef.value?.$el) {
            inputRef.value.$el.focus();
            inputRef.value.$el.select();
          }
        }, 100);
      });
    } else {
      // Clear selection when overlay is hidden
      window.electron.find.stop('clearSelection');
    }
  }
);

// Perform search
const search = async (findNext = false) => {
  if (!searchText.value) {
    await window.electron.find.stop('clearSelection');
    currentMatch.value = 0;
    totalMatches.value = 0;
    return;
  }

  await window.electron.find.start(searchText.value, {
    forward: true,
    findNext,
    matchCase: matchCase.value,
  });

  // Ensure input keeps focus after search
  ensureFocus();
};

// Debounced search for typing - prevents focus loss on every keystroke
const debouncedSearch = useDebounceFn(() => search(false), 300);

// Navigate to next match
const findNext = async () => {
  if (!searchText.value) return;

  // Store reference to input before search
  const input = inputRef.value?.$el;

  await window.electron.find.start(searchText.value, {
    forward: true,
    findNext: true,
    matchCase: matchCase.value,
  });

  // Immediately restore focus
  if (input) {
    input.focus();
  }
  ensureFocus();
};

// Navigate to previous match
const findPrevious = async () => {
  if (!searchText.value) return;

  // Store reference to input before search
  const input = inputRef.value?.$el;

  await window.electron.find.start(searchText.value, {
    forward: false,
    findNext: true,
    matchCase: matchCase.value,
  });

  // Immediately restore focus
  if (input) {
    input.focus();
  }
  ensureFocus();
};

// Toggle case sensitivity
const toggleMatchCase = () => {
  matchCase.value = !matchCase.value;
  if (searchText.value) {
    search(false);
  }
  // Restore focus after toggling
  ensureFocus();
};

// Handle input change - use debounced search to prevent focus loss
watch(searchText, () => {
  debouncedSearch();
});

// Handle close
const handleClose = async () => {
  await window.electron.find.stop('clearSelection');
  searchText.value = '';
  currentMatch.value = 0;
  totalMatches.value = 0;
  emit('close');
};

// Handle Enter key in input
const handleEnterKey = async (e: KeyboardEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (e.shiftKey) {
    await findPrevious();
  } else {
    await findNext();
  }

  // Aggressively restore focus immediately after navigation
  if (inputRef.value?.$el) {
    inputRef.value.$el.focus();
  }
};

// Keyboard shortcuts using VueUse
onKeyStroke('Escape', e => {
  if (props.show) {
    e.preventDefault();
    handleClose();
  }
});

onKeyStroke('g', e => {
  if (props.show && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (e.shiftKey) {
      findPrevious();
    } else {
      findNext();
    }
    // Ensure focus is maintained
    ensureFocus();
  }
});
</script>

<template>
  <div
    v-if="show"
    class="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed top-16 right-4 z-50 flex items-center gap-2 rounded-lg border p-3 shadow-lg backdrop-blur select-none"
    style="user-select: none; -webkit-user-select: none"
    aria-hidden="true"
  >
    <Input
      ref="inputRef"
      v-model="searchText"
      placeholder="Find in page..."
      class="h-8 w-64 text-sm"
      autocomplete="off"
      spellcheck="false"
      @keydown.esc="handleClose"
      @keydown.enter.prevent="handleEnterKey"
    />

    <div class="flex items-center gap-1">
      <span
        v-if="matchDisplay"
        class="text-muted-foreground text-xs whitespace-nowrap"
        aria-hidden="true"
      >
        {{ matchDisplay }}
      </span>
    </div>

    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :disabled="!searchText || totalMatches === 0"
        @click="findPrevious"
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp class="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :disabled="!searchText || totalMatches === 0"
        @click="findNext"
        title="Next match (Enter)"
      >
        <ChevronDown class="h-4 w-4" />
      </Button>
    </div>

    <Button
      variant="ghost"
      size="icon"
      :class="cn('h-7 w-7', matchCase && 'bg-accent')"
      @click="toggleMatchCase"
      title="Match case"
    >
      <span class="text-xs font-semibold">Aa</span>
    </Button>

    <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleClose" title="Close (Esc)">
      <X class="h-4 w-4" />
    </Button>
  </div>
</template>
