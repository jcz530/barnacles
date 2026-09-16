<script setup lang="ts">
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
import { Switch } from '../../ui/switch';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const { value: showDashboardStats } = usePersistedSetting<boolean>(() => settingsQuery.data.value, {
  // Setting values are stored as strings, convert to boolean
  read: data => {
    const stored = data.find(setting => setting.key === 'showDashboardStats');
    return stored === undefined ? undefined : String(stored.value) === 'true';
  },
  write: value =>
    updateSettingMutation.mutateAsync({ key: 'showDashboardStats', value, type: 'boolean' }),
  initial: true,
});
</script>

<template>
  <SettingRow
    layout="inline"
    label-for="show-dashboard-stats"
    label="Show Git Statistics on Dashboard"
    description="Display your git commit statistics and streaks on the dashboard"
  >
    <Switch
      id="show-dashboard-stats"
      aria-labelledby="show-dashboard-stats-label"
      v-model="showDashboardStats"
    />
  </SettingRow>
</template>
