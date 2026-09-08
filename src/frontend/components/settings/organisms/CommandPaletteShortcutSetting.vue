<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import ShortcutRecorder from '../molecules/ShortcutRecorder.vue';
import { isRiskyAccelerator } from '@/utils/accelerator';
import { SETTING_KEYS } from '../../../../shared/types/api';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const enabled = ref(false);
const accelerator = ref('');
const isInitialized = ref(false);
/** Why the OS refused the combo, when it did. */
const registrationError = ref<string | null>(null);

/**
 * Ask the main process what actually got bound. The PUT response carries the
 * same information, but the shared settings mutation only surfaces `data`, and
 * this also covers a conflict that happened back at startup.
 */
const refreshStatus = async () => {
  if (!window.electron?.commandPalette) return;
  const status = await window.electron.commandPalette.getShortcutStatus();
  registrationError.value = enabled.value && !status.registered ? status.error : null;
};

watch(
  () => settingsQuery.data.value,
  newData => {
    if (!newData) return;

    const enabledSetting = newData.find(
      s => s.key === SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED
    );
    if (enabledSetting) {
      enabled.value = String(enabledSetting.value) === 'true';
    }

    const shortcutSetting = newData.find(s => s.key === SETTING_KEYS.COMMAND_PALETTE_SHORTCUT);
    if (shortcutSetting) {
      accelerator.value = String(shortcutSetting.value);
    }

    isInitialized.value = true;
    void refreshStatus();
  },
  { immediate: true }
);

const save = async (key: string, value: string | boolean, type: 'string' | 'boolean') => {
  if (!isInitialized.value) return;
  await updateSettingMutation.mutateAsync({ key, value, type });
  await refreshStatus();
};

watch(enabled, newValue => {
  void save(SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED, newValue, 'boolean');
});

watch(accelerator, newValue => {
  void save(SETTING_KEYS.COMMAND_PALETTE_SHORTCUT, newValue, 'string');
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label for="command-palette-shortcut">Global command palette shortcut</Label>
        <div class="text-muted-foreground text-sm">
          Open the command palette from any app, without switching to Barnacles first
        </div>
      </div>
      <Switch id="command-palette-shortcut" v-model="enabled" />
    </div>

    <div class="flex items-start justify-between gap-4">
      <div class="text-muted-foreground text-sm">
        Press the button and type the combination you want to use.
      </div>
      <ShortcutRecorder v-model="accelerator" :disabled="!enabled" />
    </div>

    <p v-if="registrationError" class="text-danger-600 dark:text-danger-400 text-sm">
      {{ registrationError }} Try another combination — the in-app shortcut still works.
    </p>
    <p v-else-if="enabled && isRiskyAccelerator(accelerator)" class="text-muted-foreground text-sm">
      This combination is often used by the system or other apps and may not reach Barnacles.
    </p>
  </div>
</template>
