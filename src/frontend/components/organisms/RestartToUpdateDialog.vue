<script setup lang="ts">
/*
 * Confirmation for the one action in this feature that cannot be undone.
 *
 * `quitAndInstall` closes the app immediately, and Barnacles' quit path runs
 * `processManagerService.cleanup()` -- so restarting also stops every dev server
 * and terminal it is supervising. That is a fine thing to do on purpose and a
 * bad thing to do by accident, and the trigger sits in the sidebar footer right
 * beside the (deliberately inert) user row.
 *
 * Shared by all three surfaces that offer the restart, so the warning cannot be
 * true in one place and missing in another. The process count comes from the
 * same query the sidebar already holds, so this costs no extra request.
 */
import { computed, ref } from 'vue';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useQueries } from '@/composables/useQueries';
import { useUpdater } from '@/composables/useUpdater';

const props = defineProps<{
  /** Shown in the dialog body so the user knows what they are moving to. */
  version?: string;
}>();

const { installUpdate } = useUpdater();
const { useProcessesQuery } = useQueries();
const { data: processes } = useProcessesQuery();

const isOpen = ref(false);

const runningCount = computed(
  () => processes.value?.filter(process => process.status === 'running').length ?? 0
);

const versionLabel = computed(() => (props.version ? `Version ${props.version}` : 'The update'));
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogTrigger as-child>
      <slot />
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Restart to update?</AlertDialogTitle>
        <AlertDialogDescription>
          {{ versionLabel }} installs when Barnacles restarts.
          <template v-if="runningCount > 0">
            {{ runningCount }} running
            {{ runningCount === 1 ? 'process' : 'processes' }}
            will be stopped.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="installUpdate">Restart now</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
