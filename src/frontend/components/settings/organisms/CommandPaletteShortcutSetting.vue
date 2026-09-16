<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
import { Switch } from '../../ui/switch';
import ShortcutRecorder from '../molecules/ShortcutRecorder.vue';
import { isRiskyAccelerator } from '@/utils/accelerator';
import { SETTING_KEYS } from '../../../../shared/types/api';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

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

const { value: enabled } = usePersistedSetting<boolean>(() => settingsQuery.data.value, {
  read: data => {
    const stored = data.find(
      setting => setting.key === SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED
    );
    return stored === undefined ? undefined : String(stored.value) === 'true';
  },
  write: async value => {
    await updateSettingMutation.mutateAsync({
      key: SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED,
      value,
      type: 'boolean',
    });
    await refreshStatus();
  },
  initial: false,
});

const { value: accelerator } = usePersistedSetting<string>(() => settingsQuery.data.value, {
  read: data => {
    const stored = data.find(setting => setting.key === SETTING_KEYS.COMMAND_PALETTE_SHORTCUT);
    return stored === undefined ? undefined : String(stored.value);
  },
  write: async value => {
    await updateSettingMutation.mutateAsync({
      key: SETTING_KEYS.COMMAND_PALETTE_SHORTCUT,
      value,
      type: 'string',
    });
    await refreshStatus();
  },
  initial: '',
});

// The shortcut may have failed to register back at startup, so reflect the real
// binding once the stored values are known -- not only after an edit.
watch(
  () => settingsQuery.data.value,
  () => void refreshStatus(),
  { immediate: true }
);
</script>

<template>
  <div class="space-y-3">
    <SettingRow
      layout="inline"
      label-for="command-palette-shortcut"
      label="Global command palette shortcut"
      description="Open the command palette from any app, without switching to Barnacles first"
    >
      <Switch
        id="command-palette-shortcut"
        aria-labelledby="command-palette-shortcut-label"
        v-model="enabled"
      />
    </SettingRow>

    <div class="flex items-start justify-between gap-4">
      <div class="text-muted-foreground text-sm">
        Press the button and type the combination you want to use.
      </div>
      <ShortcutRecorder v-model="accelerator" :disabled="!enabled" />
    </div>

    <p v-if="registrationError" class="text-danger-600">
      {{ registrationError }} Try another combination — the in-app shortcut still works.
    </p>
    <p v-else-if="enabled && isRiskyAccelerator(accelerator)" class="text-muted-foreground text-sm">
      This combination is often used by the system or other apps and may not reach Barnacles.
    </p>
  </div>
</template>
