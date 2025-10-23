<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import Button from '../../ui/button/Button.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

const { useSettingsQuery, useUpdateSettingMutation, useDetectedIDEsQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const idesQuery = useDetectedIDEsQuery({ enabled: true });

const defaultIdeId = ref<string>('');
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const defaultIdeSetting = newData.find(s => s.key === 'defaultIde');
      if (defaultIdeSetting) {
        defaultIdeId.value = defaultIdeSetting.value;
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(defaultIdeId, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value && newValue) {
    await updateSettingMutation.mutateAsync({
      key: 'defaultIde',
      value: newValue,
      type: 'string',
    });
  }
});

const resetToDefault = () => {
  defaultIdeId.value = '';
};

const isDefaultValue = computed(() => !defaultIdeId.value);
const isSaving = computed(() => updateSettingMutation.isPending.value);

const installedIDEs = computed(() => idesQuery.data.value?.filter(ide => ide.installed) || []);

const selectedIde = computed(() => {
  if (!defaultIdeId.value) return null;
  return installedIDEs.value.find(ide => ide.id === defaultIdeId.value);
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <label for="defaultIde" class="text-sm font-medium">Default IDE</label>
    <p class="text-muted-foreground text-sm">
      Choose which IDE to use when opening projects. This will be used as the default when clicking
      "Open in IDE".
    </p>
    <div class="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            :class="['w-64 justify-start', isDefaultValue ? 'text-muted-foreground' : '']"
          >
            {{ selectedIde ? selectedIde.name : 'None (Ask each time)' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-64">
          <DropdownMenuRadioGroup v-model="defaultIdeId">
            <DropdownMenuRadioItem value=""> None (Ask each time) </DropdownMenuRadioItem>
            <DropdownMenuRadioItem v-for="ide in installedIDEs" :key="ide.id" :value="ide.id">
              {{ ide.name }}
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
      Default: None (Ask each time) • Current: {{ selectedIde ? selectedIde.name : 'None' }}
    </p>
  </div>
</template>
