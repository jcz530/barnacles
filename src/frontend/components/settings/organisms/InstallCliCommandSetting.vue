<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { toastDanger, toastSuccess } from '../../ui/sonner';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const installCliCommand = ref<boolean>(true);
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const cliSetting = newData.find(s => s.key === 'installCliCommand');
      if (cliSetting) {
        // Setting values are stored as strings, convert to boolean
        installCliCommand.value = String(cliSetting.value) === 'true';
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(installCliCommand, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    try {
      await updateSettingMutation.mutateAsync({
        key: 'installCliCommand',
        value: newValue,
        type: 'boolean',
      });

      if (newValue) {
        toastSuccess('CLI command installed', {
          description: 'The "barnacles" command is now available in your terminal',
        });
      } else {
        toastSuccess('CLI command uninstalled', {
          description: 'The "barnacles" command has been removed from your terminal',
        });
      }
    } catch (error) {
      toastDanger('Failed to update CLI installation', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      // Revert the toggle on error
      installCliCommand.value = !newValue;
    }
  }
});
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="space-y-0.5">
      <Label for="install-cli-command">Install CLI Command</Label>
      <div class="text-muted-foreground text-sm">
        Install the "barnacles" command for use in your terminal
      </div>
    </div>
    <Switch id="install-cli-command" v-model="installCliCommand" />
  </div>
</template>
