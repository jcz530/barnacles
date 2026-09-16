<script setup lang="ts">
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
import { Switch } from '../../ui/switch';
import { toastDanger, toastSuccess } from '../../ui/sonner';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const { value: installCliCommand } = usePersistedSetting<boolean>(() => settingsQuery.data.value, {
  // Setting values are stored as strings, convert to boolean
  read: data => {
    const stored = data.find(setting => setting.key === 'installCliCommand');
    return stored === undefined ? undefined : String(stored.value) === 'true';
  },
  write: async value => {
    await updateSettingMutation.mutateAsync({
      key: 'installCliCommand',
      value,
      type: 'boolean',
    });

    if (value) {
      toastSuccess('CLI command installed', {
        description: 'The "barnacles" command is now available in your terminal',
      });
    } else {
      toastSuccess('CLI command uninstalled', {
        description: 'The "barnacles" command has been removed from your terminal',
      });
    }
  },
  initial: true,
  onError: (error, value) => {
    toastDanger('Failed to update CLI installation', {
      description: error instanceof Error ? error.message : 'Unknown error',
    });
    // Revert the toggle on error
    installCliCommand.value = !value;
  },
});
</script>

<template>
  <SettingRow
    layout="inline"
    label-for="install-cli-command"
    label="Install CLI Command"
    description='Install the "barnacles" command for use in your terminal'
  >
    <Switch
      id="install-cli-command"
      aria-labelledby="install-cli-command-label"
      v-model="installCliCommand"
    />
  </SettingRow>
</template>
