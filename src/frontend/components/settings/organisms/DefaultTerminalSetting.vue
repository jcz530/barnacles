<script setup lang="ts">
import { computed } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
import Button from '../../ui/button/Button.vue';
import SettingRow from '../molecules/SettingRow.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

const { useSettingsQuery, useUpdateSettingMutation, useDetectedTerminalsQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const terminalsQuery = useDetectedTerminalsQuery();

const { value: defaultTerminalId } = usePersistedSetting<string>(() => settingsQuery.data.value, {
  read: data => data.find(setting => setting.key === 'defaultTerminal')?.value,
  // An empty value means "ask each time", which is stored like any other.
  write: value =>
    updateSettingMutation.mutateAsync({ key: 'defaultTerminal', value, type: 'string' }),
  initial: '',
});

const resetToDefault = () => {
  defaultTerminalId.value = '';
};

const isDefaultValue = computed(() => !defaultTerminalId.value);
const isSaving = computed(() => updateSettingMutation.isPending.value);

const installedTerminals = computed(
  () => terminalsQuery.data.value?.filter(terminal => terminal.installed) || []
);

const selectedTerminal = computed(() => {
  if (!defaultTerminalId.value) return null;
  return installedTerminals.value.find(terminal => terminal.id === defaultTerminalId.value);
});
</script>

<template>
  <SettingRow
    label-for="defaultTerminal"
    label="Default Terminal"
    description='Choose which terminal to use when opening project directories. This will be used as the default when clicking "Open Terminal".'
  >
    <div class="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            id="defaultTerminal"
            variant="outline"
            :class="['w-64 justify-start', isDefaultValue ? 'text-muted-foreground' : '']"
          >
            {{ selectedTerminal ? selectedTerminal.name : 'None (Ask each time)' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-64">
          <DropdownMenuRadioGroup v-model="defaultTerminalId">
            <DropdownMenuRadioItem value=""> None (Ask each time) </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              v-for="terminal in installedTerminals"
              :key="terminal.id"
              :value="terminal.id"
            >
              {{ terminal.name }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        @click="resetToDefault"
        variant="outline"
        size="sm"
        :disabled="isDefaultValue || isSaving"
        class="flex items-center gap-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Reset to Default
      </Button>
      <span v-if="isSaving" class="text-muted-foreground text-sm">Saving...</span>
    </div>
    <p class="text-muted-foreground mt-2 text-xs">
      Default: None (Ask each time) • Current:
      {{ selectedTerminal ? selectedTerminal.name : 'None' }}
    </p>
  </SettingRow>
</template>
