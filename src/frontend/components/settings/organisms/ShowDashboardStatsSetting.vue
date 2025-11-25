<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';

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
  <div class="flex items-center justify-between">
    <div class="space-y-0.5">
      <Label for="show-dashboard-stats">Show Git Statistics on Dashboard</Label>
      <div class="text-muted-foreground text-sm">
        Display your git commit statistics and streaks on the dashboard
      </div>
    </div>
    <Switch id="show-dashboard-stats" v-model="showDashboardStats" />
  </div>
</template>
