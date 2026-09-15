<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { Switch } from '../../ui/switch';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const showDashboardStats = ref<boolean>(true);
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const dashboardStatsSetting = newData.find(s => s.key === 'showDashboardStats');
      if (dashboardStatsSetting) {
        // Setting values are stored as strings, convert to boolean
        showDashboardStats.value = String(dashboardStatsSetting.value) === 'true';
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(showDashboardStats, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    await updateSettingMutation.mutateAsync({
      key: 'showDashboardStats',
      value: newValue,
      type: 'boolean',
    });
  }
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
