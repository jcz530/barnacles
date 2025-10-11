<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Button } from '../../ui/button';

const router = useRouter();

// Check if we can go back or forward
const canGoBack = computed(() => window.history.length > 1);
const canGoForward = computed(() => {
  // Vue Router doesn't expose forward state directly, so we'll track it
  return false; // Will be always false for now, can enhance later
});

const goBack = () => {
  router.back();
};

const goForward = () => {
  router.forward();
};

// Detect platform
const isMac = navigator.platform.toLowerCase().includes('mac');
</script>

<template>
  <div
    class="title-bar bg-sidebar fixed top-0 right-0 left-0 z-[1000] flex h-10 items-center"
    :class="{ 'pl-20': isMac, 'pl-2': !isMac }"
  >
    <!-- Back/Forward Navigation Buttons -->
    <div class="relative items-center gap-1 px-2">
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 hover:bg-slate-200"
        :disabled="!canGoBack"
        @click="goBack"
      >
        <ChevronLeft class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 hover:bg-slate-200"
        :disabled="!canGoForward"
        @click="goForward"
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>

    <!-- Draggable area for window movement -->
    <div class="drag-region flex-1" />
  </div>
</template>

<style scoped>
.title-bar {
  -webkit-app-region: drag;
  user-select: none;
}

/* Make buttons clickable in drag region */
button {
  -webkit-app-region: no-drag;
}
</style>
