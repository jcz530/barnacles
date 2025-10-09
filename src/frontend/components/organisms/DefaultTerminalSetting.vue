<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../composables/useQueries';
import Button from '../ui/button/Button.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const { useSettingsQuery, useUpdateSettingMutation, useDetectedTerminalsQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const terminalsQuery = useDetectedTerminalsQuery({ enabled: true });

const defaultTerminalId = ref<string>('');
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const defaultTerminalSetting = newData.find(s => s.key === 'defaultTerminal');
      if (defaultTerminalSetting) {
        defaultTerminalId.value = defaultTerminalSetting.value;
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(defaultTerminalId, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value && newValue) {
    await updateSettingMutation.mutateAsync({
      key: 'defaultTerminal',
      value: newValue,
      type: 'string',
    });
  }
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
  <div class="flex flex-col gap-2">
    <label for="defaultTerminal" class="text-sm font-medium">Default Terminal</label>
    <p class="text-muted-foreground text-sm">
      Choose which terminal to use when opening project directories. This will be used as the
      default when clicking "Open Terminal".
    </p>
    <div class="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
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
    <p class="text-muted-foreground text-xs">
      Default: None (Ask each time) • Current:
      {{ selectedTerminal ? selectedTerminal.name : 'None' }}
    </p>
  </div>
</template>
