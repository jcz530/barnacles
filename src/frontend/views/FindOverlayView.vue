<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { onKeyStroke, useDebounceFn } from '@vueuse/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, ChevronUp, ChevronDown } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

const searchText = ref('');
const matchCase = ref(false);
const currentMatch = ref(0);
const totalMatches = ref(0);
const inputRef = ref<{ $el: HTMLInputElement } | null>(null);

const matchDisplay = computed(() => {
  if (!searchText.value) return '';
  if (totalMatches.value > 0) {
    return `${currentMatch.value} of ${totalMatches.value}`;
  }
  return 'No matches';
});

let cleanupListener: (() => void) | null = null;

// Setup find result listener
onMounted(() => {
  // Add body class for transparent background
  document.body.classList.add('find-overlay');

  window.electron.find.setupListener();
  cleanupListener = window.electron.find.onResult(result => {
    if (result.finalUpdate) {
      currentMatch.value = result.activeMatchOrdinal;
      totalMatches.value = result.matches;
    }
  });

  // Auto-focus the input
  setTimeout(() => {
    inputRef.value?.$el?.focus();
  }, 50);
});

onUnmounted(() => {
  if (cleanupListener) {
    cleanupListener();
  }
  document.body.classList.remove('find-overlay');
});

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
};

// Debounced search for typing - 150ms balances responsiveness with avoiding excessive IPC calls
const debouncedSearch = useDebounceFn(() => search(false), 150);

// Navigate to next match
const findNext = async () => {
  if (!searchText.value) return;
  await window.electron.find.start(searchText.value, {
    forward: true,
    findNext: true,
    matchCase: matchCase.value,
  });
};

// Navigate to previous match
const findPrevious = async () => {
  if (!searchText.value) return;
  await window.electron.find.start(searchText.value, {
    forward: false,
    findNext: true,
    matchCase: matchCase.value,
  });
};

// Toggle case sensitivity - must stop current search before restarting with new option
const toggleMatchCase = async () => {
  matchCase.value = !matchCase.value;
  if (searchText.value) {
    await window.electron.find.stop('clearSelection');
    await search(false);
  }
};

// Handle input change - trigger search as user types
const onInput = () => {
  debouncedSearch();
};

watch(searchText, () => {
  debouncedSearch();
});

// Handle close
const handleClose = () => {
  window.electron.find.close();
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
};

// Keyboard shortcuts
onKeyStroke('Escape', e => {
  e.preventDefault();
  handleClose();
});

onKeyStroke('g', e => {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    if (e.shiftKey) {
      findPrevious();
    } else {
      findNext();
    }
  }
});
</script>

<template>
  <div
    class="bg-background/95 supports-[backdrop-filter]:bg-background/80 flex items-center gap-2 rounded-lg border p-3 shadow-lg backdrop-blur"
  >
    <Input
      ref="inputRef"
      v-model="searchText"
      placeholder="Find in page..."
      class="h-8 w-64 text-sm"
      autocomplete="off"
      spellcheck="false"
      @input="onInput"
      @keydown.esc="handleClose"
      @keydown.enter.prevent="handleEnterKey"
    />

    <div class="flex items-center gap-1">
      <span v-if="matchDisplay" class="text-muted-foreground text-xs whitespace-nowrap">
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
      :class="cn('h-7 w-7', matchCase && 'bg-primary-400/50 ring-ring ring-1')"
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

<style>
/* Transparent background for find overlay window - keeps the BrowserWindow see-through
   while the component itself renders its own bg-background */
body.find-overlay {
  background: transparent !important;
}

body.find-overlay #app {
  background: transparent !important;
  min-height: auto;
  overflow: hidden;
}

body.find-overlay {
  overflow: hidden;
}
</style>
