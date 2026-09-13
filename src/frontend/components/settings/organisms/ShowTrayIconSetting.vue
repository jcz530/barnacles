<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { Switch } from '../../ui/switch';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const showTrayIcon = ref<boolean>(false);
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const trayIconSetting = newData.find(s => s.key === 'showTrayIcon');
      if (trayIconSetting) {
        // Setting values are stored as strings, convert to boolean
        showTrayIcon.value = String(trayIconSetting.value) === 'true';
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(showTrayIcon, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    await updateSettingMutation.mutateAsync({
      key: 'showTrayIcon',
      value: newValue,
      type: 'boolean',
    });
  }
});
</script>

<template>
  <SettingRow
    layout="inline"
    label-for="show-tray-icon"
    label="Show Tray Icon"
    description="Display Barnacles icon in the system tray for quick access"
  >
    <Switch id="show-tray-icon" v-model="showTrayIcon" />
  </SettingRow>
</template>
