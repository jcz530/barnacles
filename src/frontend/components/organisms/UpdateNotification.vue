<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import RestartToUpdateDialog from './RestartToUpdateDialog.vue';
import type { UpdateState } from '../../../shared/types/updater';

interface Props {
  updateState: UpdateState;
  /**
   * Whether the update was dismissed. Only this toast honours it -- the sidebar
   * badge keeps showing the update, so "Later" postpones the interruption
   * without losing track of it.
   */
  isDismissed?: boolean;
  /**
   * When automatic updates are on, downloading is background work and this
   * toast stays out of the way until there is something to act on. When they
   * are off, the user has to be asked before anything is fetched, so the
   * "available" prompt and its Download button come back.
   */
  autoUpdateEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isDismissed: false,
  autoUpdateEnabled: true,
});

const emit = defineEmits<{
  download: [];
  dismiss: [];
}>();

/*
 * Which states are worth interrupting for.
 *
 * 'downloaded' and 'error' always are: one needs a restart, the other needs to
 * be told. 'available' only matters when automatic updates are off, because
 * that is the one case where the download will not happen unless the user says
 * so. 'downloading' never shows -- the sidebar badge carries the progress.
 */
const showNotification = computed(() => {
  if (props.isDismissed) return false;

  const { status } = props.updateState;
  if (status === 'downloaded' || status === 'error') return true;
  return status === 'available' && !props.autoUpdateEnabled;
});

const title = computed(() => {
  switch (props.updateState.status) {
    case 'available':
      return 'Update Available';
    case 'downloaded':
      return 'Update Ready';
    case 'error':
      return 'Update Error';
    default:
      return '';
  }
});

/**
 * Updater errors are raw library text -- file:// URLs, code-signing jargon --
 * written for a log, not a toast. Lead with something a person can act on and
 * keep the original underneath for anyone who wants it.
 */
const errorDetail = computed(() => props.updateState.error?.message?.trim() ?? '');

/** "A new version" rather than "Version undefined" when the payload lacks one. */
const versionLabel = computed(() =>
  props.updateState.updateInfo?.version
    ? `Version ${props.updateState.updateInfo.version}`
    : 'A new version'
);

const description = computed(() => {
  switch (props.updateState.status) {
    case 'available':
      return `${versionLabel.value} is available. Would you like to download it?`;
    case 'downloaded':
      return `${versionLabel.value} is ready to install. Restart the app to apply the update.`;
    case 'error':
      return "Barnacles couldn't install the update. You can try again later.";
    default:
      return '';
  }
});

// The restart is handled by RestartToUpdateDialog, which confirms first; this
// is only the download, which needs no confirmation.
const showDownloadAction = computed(() => props.updateState.status === 'available');

const cardClass = computed(() => {
  const baseClass = 'fixed right-4 bottom-4 w-96 shadow-lg z-50';
  if (props.updateState.status === 'error') {
    return `${baseClass} border-danger-500`;
  }
  return `${baseClass} border-primary-500`;
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <Card v-if="showNotification" :class="cardClass">
      <CardHeader>
        <CardTitle class="text-lg">{{ title }}</CardTitle>
        <CardDescription class="break-words">{{ description }}</CardDescription>
      </CardHeader>

      <CardContent v-if="updateState.status === 'downloaded'" class="pb-4">
        <p class="text-muted-foreground text-sm">
          You can keep working — the update applies the next time Barnacles starts.
        </p>
      </CardContent>

      <!-- The raw message, clamped. `break-words` because these carry long
           unbroken file:// URLs that otherwise run straight out of the card. -->
      <CardContent v-else-if="updateState.status === 'error' && errorDetail" class="pb-4">
        <p class="text-muted-foreground line-clamp-3 text-xs break-words" :title="errorDetail">
          {{ errorDetail }}
        </p>
      </CardContent>

      <CardFooter class="gap-2">
        <!-- The restart quits the app, so it confirms first; the download does
             not, so it fires directly. -->
        <RestartToUpdateDialog
          v-if="updateState.status === 'downloaded'"
          :version="updateState.updateInfo?.version"
        >
          <Button>Restart Now</Button>
        </RestartToUpdateDialog>
        <Button v-else-if="showDownloadAction" @click="emit('download')"> Download </Button>
        <!-- Always offered: every state this toast shows is one the user is
             allowed to walk away from. -->
        <Button variant="outline" @click="emit('dismiss')"> Later </Button>
      </CardFooter>
    </Card>
  </Transition>
</template>
