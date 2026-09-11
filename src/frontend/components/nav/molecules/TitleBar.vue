<script setup lang="ts">
import { SidebarTrigger } from '@/components/ui/sidebar';
import LogoMark from '@/components/nav/atoms/LogoMark.vue';
import { useConfigs } from '@/composables/useConfigs';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button } from '@/components/ui/button';
import PaletteSearchButton from './PaletteSearchButton.vue';

const router = useRouter();
const config = useConfigs();

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
    :style="{ '--controls-end': isMac ? '22rem' : '17.5rem' }"
  >
    <div class="ml- flex items-center gap-4">
      <RouterLink to="/" class="no-drag mx-4 flex items-center gap-2 text-slate-600">
        <LogoMark :width="20" :height="20" />
        <span class="truncate text-sm font-semibold">{{ config.appName }}</span>
      </RouterLink>
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
 *
 * Centring is expressed as an explicit left edge (50vw minus half the button's
 * 16rem width) rather than a -50% translate, so that it can be clamped: being
 * out of flow, the button is invisible to the controls on its left and would
 * otherwise slide straight over the back/forward arrows as the window narrows.
 * max() holds it clear of them, so it sits centred while there is room and
 * saddles up beside them once there is not. The floor tracks where those
 * controls actually end, which differs by platform: the bar reserves 80px for
 * the traffic lights on macOS and 8px elsewhere.
 */
.palette-search {
  top: 50%;
  left: max(var(--controls-end), 50vw - 8rem);
  transform: translateY(-50%);
}

/* Make buttons clickable in drag region */
button,
.no-drag {
  -webkit-app-region: no-drag;
}
</style>
