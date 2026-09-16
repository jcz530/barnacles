<script setup lang="ts">
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
import { Switch } from '../../ui/switch';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const { value: showTrayIcon } = usePersistedSetting<boolean>(() => settingsQuery.data.value, {
  // Setting values are stored as strings, convert to boolean
  read: data => {
    const stored = data.find(setting => setting.key === 'showTrayIcon');
    return stored === undefined ? undefined : String(stored.value) === 'true';
  },
  write: value =>
    updateSettingMutation.mutateAsync({ key: 'showTrayIcon', value, type: 'boolean' }),
  initial: false,
});
</script>

<template>
  <SettingRow
    layout="inline"
    label-for="show-tray-icon"
    label="Show Tray Icon"
    description="Display Barnacles icon in the system tray for quick access"
  >
    <Switch id="show-tray-icon" aria-labelledby="show-tray-icon-label" v-model="showTrayIcon" />
  </SettingRow>
</template>
