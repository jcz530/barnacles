<script setup lang="ts">
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import PaletteSearchButton from './PaletteSearchButton.vue';

const router = useRouter();

// Track navigation history manually
const historyStack = ref<string[]>([router.currentRoute.value.fullPath]);
const currentIndex = ref(0);

// Check if we can go back or forward
const canGoBack = ref(false);
const canGoForward = ref(false);

const updateNavigationButtons = () => {
  canGoBack.value = currentIndex.value > 0;
  canGoForward.value = currentIndex.value < historyStack.value.length - 1;
};

// Track route changes
router.afterEach(to => {
  const toPath = to.fullPath;

  // Check if this is a back/forward navigation
  const backIndex = historyStack.value.lastIndexOf(toPath, currentIndex.value - 1);
  const forwardIndex = historyStack.value.indexOf(toPath, currentIndex.value + 1);

  if (backIndex !== -1 && backIndex === currentIndex.value - 1) {
    // User went back
    currentIndex.value = backIndex;
  } else if (forwardIndex !== -1 && forwardIndex === currentIndex.value + 1) {
    // User went forward
    currentIndex.value = forwardIndex;
  } else {
    // New navigation - truncate forward history and add new entry
    historyStack.value = historyStack.value.slice(0, currentIndex.value + 1);
    historyStack.value.push(toPath);
    currentIndex.value = historyStack.value.length - 1;
  }

  updateNavigationButtons();
});

const goBack = () => {
  if (canGoBack.value) {
    router.back();
  }
};

const goForward = () => {
  if (canGoForward.value) {
    router.forward();
  }
};

// Detect platform
const isMac = window.navigator.userAgent.toLowerCase().includes('mac');

// Initialize
updateNavigationButtons();
</script>

<template>
  <div
    class="title-bar bg-sidebar fixed top-0 right-0 left-0 z-[1000] flex h-10 items-center"
    :class="{ 'pl-20': isMac, 'pl-2': !isMac }"
  >
    <div class="ml-12 flex gap-4">
      <SidebarTrigger />
      <!-- Back/Forward Navigation Buttons -->
      <div class="relative items-center gap-1 px-2">
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 hover:bg-slate-50"
          :disabled="!canGoBack"
          @click="goBack"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 hover:bg-slate-50"
          :disabled="!canGoForward"
          @click="goForward"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Draggable area for window movement -->
    <div class="drag-region flex-1" />

    <!--
      The only on-screen way in to the palette. Without it both the shortcut and
      the palette itself are invisible unless somebody already knows.

      Centred on the window rather than set against the right edge, where it sat
      in the fixed bar's right:0 -- that edge is the viewport's, and the
      viewport widens by the scrollbar's width whenever a dialog locks
      scrolling, so the button drifted every time the palette opened.

      Positioned out of flow rather than balanced between two drag regions: the
      nav group on the left is far wider than anything on the right, so sharing
      the leftover space would centre it in that remainder rather than in the
      window.

      Centred on 100vw rather than the bar's own width. vw is the viewport
      including its scrollbar, so it does not change when one is taken away --
      the bar itself does, and centring within it would drift by half the
      scrollbar's width instead of all of it.
    -->
    <PaletteSearchButton class="palette-search absolute" />
  </div>
</template>

<style scoped>
.title-bar {
  -webkit-app-region: drag;
  user-select: none;
}

/*
 * Centred on the viewport's full width, scrollbar included, so that locking
 * scroll for a dialog -- which removes the scrollbar and widens the layout
 * viewport -- moves nothing.
 */
.palette-search {
  top: 50%;
  left: 50vw;
  transform: translate(-50%, -50%);
}

/* Make buttons clickable in drag region */
button {
  -webkit-app-region: no-drag;
}
</style>
