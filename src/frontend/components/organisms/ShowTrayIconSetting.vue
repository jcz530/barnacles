<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '../../composables/useQueries';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

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
  <div class="flex items-center justify-between">
    <div class="space-y-0.5">
      <Label for="show-tray-icon">Show Tray Icon</Label>
      <div class="text-muted-foreground text-sm">
        Display Barnacles icon in the system tray for quick access
      </div>
    </div>
    <Switch id="show-tray-icon" v-model="showTrayIcon" />
  </div>
</template>
