<script setup lang="ts">
/*
 * The standing "a new version is waiting" indicator.
 *
 * Lives in the sidebar footer rather than in a toast because a toast is a
 * moment and this is a state: the update sits on disk until the user restarts,
 * which may be days. Dismissing the toast deliberately does not clear this --
 * `useUpdater`'s `isDismissed` silences the interruption, while the badge keeps
 * reading `status` so the update is never actually lost.
 *
 * Progress is shown only for a download the user asked for. An automatic one is
 * meant to feel like it already happened: narrating it turns background work
 * into something to watch, and the update should simply turn up ready.
 *
 * With automatic updates off, a found-but-unfetched update also shows here. It
 * is the one state that needs the user to act before anything else happens, and
 * without it dismissing the toast left no trace of the update anywhere.
 */
import { computed } from 'vue';
import { useUpdater } from '@/composables/useUpdater';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import RestartToUpdateDialog from '@/components/organisms/RestartToUpdateDialog.vue';
import type { UpdateState } from '../../../../shared/types/updater';

const props = withDefaults(
  defineProps<{
    /**
     * Overrides the shared updater state. Only the UpdateTest harness passes
     * this: the real state is driven by the main process, which cannot be made
     * to produce a download on demand without cutting a release.
     */
    stateOverride?: UpdateState;
    /**
     * When false, a found update waits for the user to start the download, so
     * the badge offers that as its action.
     */
    autoUpdateEnabled?: boolean;
  }>(),
  { autoUpdateEnabled: true }
);

// The restart is owned by RestartToUpdateDialog, which confirms before quitting.
const {
  updateState: sharedState,
  isUserInitiatedDownload,
  checkForUpdates,
  downloadUpdate,
} = useUpdater();

const updateState = computed(() => props.stateOverride ?? sharedState.value);

/**
 * A found update that nothing is going to fetch on its own.
 *
 * With automatic updates on this state resolves into a download by itself, so
 * showing it would be noise. With them off it is the one thing standing between
 * the user and the update, and the toast may well have been dismissed.
 */
const isAvailable = computed(
  () => updateState.value.status === 'available' && !props.autoUpdateEnabled
);

// Only a download the user started reports progress; an automatic one stays
// silent until it is ready to install.
const isDownloading = computed(
  () => updateState.value.status === 'downloading' && isUserInitiatedDownload.value
);
const isReady = computed(() => updateState.value.status === 'downloaded');

/*
 * A failed update has to leave a trace here too.
 *
 * The toast reports the error but can be dismissed, and the badge is the
 * surface that persists -- without this, a download that fails silently strands
 * the user on an old version with nothing left on screen to say so.
 */
const isError = computed(() => updateState.value.status === 'error');

const isVisible = computed(
  () => isAvailable.value || isDownloading.value || isReady.value || isError.value
);

const version = computed(() => updateState.value.updateInfo?.version ?? '');

const percent = computed(() => updateState.value.downloadProgress?.percent ?? 0);

/**
 * The badge's own headline, subtitle, action and dot colour, per state.
 *
 * `detail` is visible text, so it is also what the accessible name is built
 * from -- no aria-label overrides it. Overriding would leave a voice-control
 * user unable to activate the control by the words they can see (WCAG 2.5.3).
 */
const display = computed(() => {
  if (isError.value) {
    return {
      title: 'Update failed',
      detail: 'Try again',
      dotClass: 'bg-danger-500',
      // Re-check rather than re-download. The failure may have come from the
      // check itself, in which case there is no update info to download from
      // and retrying the download just fails again -- a loop the user cannot
      // escape. A check re-establishes what a download needs.
      action: checkForUpdates,
      needsConfirm: false,
    };
  }

  if (isReady.value) {
    return {
      title: 'Update ready',
      detail: version.value ? `Restart to update to ${version.value}` : 'Restart to update',
      dotClass: 'bg-success-500',
      // Routed through the confirmation dialog rather than called directly.
      action: undefined,
      needsConfirm: true,
    };
  }

  if (isDownloading.value) {
    return {
      title: 'Downloading update',
      detail: `${percent.value.toFixed(0)}%`,
      dotClass: 'bg-primary-500 is-downloading',
      action: undefined,
      needsConfirm: false,
    };
  }

  return {
    title: 'Update available',
    detail: version.value ? `Download ${version.value}` : 'Download now',
    dotClass: 'bg-primary-500',
    action: downloadUpdate,
    needsConfirm: false,
  };
});

/** Downloading is the one state with nothing to click. */
const isInert = computed(() => !display.value.action && !display.value.needsConfirm);
</script>

<template>
  <!-- aria-live so the badge turning up mid-session, or flipping from
       downloading to ready, is announced rather than appearing silently. -->
  <SidebarMenu v-if="isVisible" class="px-2" aria-live="polite">
    <SidebarMenuItem>
      <!-- The ready state quits the app, so it goes through a confirmation;
           every other state acts directly. -->
      <RestartToUpdateDialog v-if="display.needsConfirm" :version="version">
        <SidebarMenuButton size="lg" class="cursor-pointer">
          <span class="flex size-4 shrink-0 items-center justify-center">
            <span :class="['update-dot size-2 rounded-full', display.dotClass]" />
          </span>
          <div class="grid flex-1 text-left text-sm leading-tight">
            <span class="truncate font-medium">{{ display.title }}</span>
            <span class="text-muted-foreground truncate text-xs">{{ display.detail }}</span>
          </div>
        </SidebarMenuButton>
      </RestartToUpdateDialog>

      <SidebarMenuButton
        v-else
        size="lg"
        :disabled="isInert"
        :class="isInert ? 'cursor-default' : 'cursor-pointer'"
        @click="display.action?.()"
      >
        <!-- Stands in for an icon, so the button keeps its shape when the
             sidebar collapses to icons and only this dot remains. -->
        <span class="flex size-4 shrink-0 items-center justify-center">
          <span :class="['update-dot size-2 rounded-full', display.dotClass]" />
        </span>

        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-medium">{{ display.title }}</span>
          <span class="text-muted-foreground truncate text-xs">{{ display.detail }}</span>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped>
/*
 * The pulse says "still working" while bytes come down. It is decoration, not
 * information -- the percentage beside it carries the actual state -- so it is
 * the first thing to go when motion is turned down.
 *
 * `:root:not(.no-reduce-motion)` mirrors CopyButton and ProcessStateIcon: it
 * lets an explicit 'never' preference out-specify the OS media query, which
 * nothing in CSS can otherwise switch off.
 */
@media (prefers-reduced-motion: no-preference) {
  :root:not(.no-reduce-motion) .update-dot.is-downloading {
    animation: update-dot-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
}

:root.no-reduce-motion .update-dot.is-downloading {
  animation: update-dot-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

:root.reduce-motion .update-dot.is-downloading {
  animation: none;
}

@keyframes update-dot-pulse {
  50% {
    opacity: 0.4;
  }
}
</style>
