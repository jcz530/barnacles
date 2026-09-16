<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { useUpdater } from '../../../composables/useUpdater';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { toastDanger } from '../../ui/sonner';
import SettingRow from '../molecules/SettingRow.vue';
import RestartToUpdateDialog from '../../organisms/RestartToUpdateDialog.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const { updateState, isCheckingForUpdates, checkForUpdates } = useUpdater();

const autoUpdate = ref<boolean>(true);
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const autoUpdateSetting = newData.find(s => s.key === 'autoUpdate');
      if (autoUpdateSetting) {
        // Setting values are stored as strings, convert to boolean
        autoUpdate.value = String(autoUpdateSetting.value) === 'true';
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(autoUpdate, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    try {
      await updateSettingMutation.mutateAsync({
        key: 'autoUpdate',
        value: newValue,
        type: 'boolean',
      });
    } catch (error) {
      toastDanger('Failed to update automatic updates', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      // Revert the toggle on error
      autoUpdate.value = !newValue;
    }
  }
});

/**
 * A plain-language reading of where the update sits right now.
 *
 * `idle` deliberately produces nothing: before the first check has run there is
 * no honest claim to make, and "Up to date" would be a guess.
 */
/** Avoids "Version undefined" when an event arrives without one. */
const versionLabel = computed(() =>
  updateState.value.updateInfo?.version
    ? `Version ${updateState.value.updateInfo.version}`
    : 'A new version'
);

const statusLabel = computed(() => {
  switch (updateState.value.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'available':
      return `${versionLabel.value} available`;
    case 'downloading': {
      const percent = updateState.value.downloadProgress?.percent ?? 0;
      return `Downloading ${versionLabel.value.toLowerCase()}… ${percent.toFixed(0)}%`;
    }
    case 'pending':
      // Explains why an explicit Check Now appeared to do nothing.
      return `${versionLabel.value} was just published and is not ready to install yet`;
    case 'not-available':
      return 'Up to date';
    case 'downloaded':
      return `${versionLabel.value} is ready`;
    case 'error':
      return updateState.value.error?.message ?? 'Could not check for updates';
    default:
      return '';
  }
});

const isReadyToInstall = computed(() => updateState.value.status === 'downloaded');
</script>

<template>
  <div class="space-y-4">
    <SettingRow
      layout="inline"
      label-for="auto-update"
      label="Automatic Updates"
      description="Download new versions in the background. Updates apply when you restart."
    >
      <Switch id="auto-update" aria-labelledby="auto-update-label" v-model="autoUpdate" />
    </SettingRow>

    <!-- The version and check controls sit below the toggle rather than inside
         the row, because they stay useful when automatic updates are off. -->
    <div class="border-border flex flex-wrap items-center gap-3 border-t pt-4">
      <div class="min-w-0 flex-1 space-y-1">
        <p class="text-foreground text-sm">
          Current version
          <span class="text-muted-foreground">{{ updateState.currentVersion }}</span>
        </p>
        <p
          v-if="statusLabel"
          :title="updateState.status === 'error' ? statusLabel : undefined"
          :class="[
            'text-xs leading-snug break-words',
            // Updater errors carry long unbroken file:// URLs; without a clamp
            // one can push the Check Now button off the row entirely.
            updateState.status === 'error'
              ? 'text-danger-600 line-clamp-2'
              : 'text-muted-foreground',
          ]"
        >
          <span
            v-if="isReadyToInstall"
            class="bg-success-500 mr-1.5 inline-block size-1.5 rounded-full align-middle"
          />
          {{ statusLabel }}
        </p>
      </div>

      <div class="flex shrink-0 gap-2">
        <RestartToUpdateDialog v-if="isReadyToInstall" :version="updateState.updateInfo?.version">
          <Button size="sm">Restart Now</Button>
        </RestartToUpdateDialog>
        <Button
          variant="outline"
          size="sm"
          :disabled="isCheckingForUpdates"
          @click="checkForUpdates"
        >
          {{ isCheckingForUpdates ? 'Checking…' : 'Check Now' }}
        </Button>
      </div>
    </div>
  </div>
</template>
