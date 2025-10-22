<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../composables/useQueries';
import Button from '../ui/button/Button.vue';
import FolderAutocompleteInput from '../molecules/FolderAutocompleteInput.vue';
import DirectoryTagList from '../molecules/DirectoryTagList.vue';
import { Plus, RotateCcw } from 'lucide-vue-next';

const { useSettingsQuery, useUpdateSettingMutation, useDefaultSettingQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const defaultSettingQuery = useDefaultSettingQuery('scanIncludedDirectories', { enabled: true });

const DEFAULT_INCLUDED_DIRECTORIES = ref<string[]>([]);
const includedDirectories = ref<string[]>([]);
const newDirectory = ref('');
const isInitialized = ref(false);
const hasLoadedFromSettings = ref(false);

// Update default directories when loaded from backend
watch(
  () => defaultSettingQuery.data.value,
  newData => {
    if (newData && Array.isArray(newData)) {
      DEFAULT_INCLUDED_DIRECTORIES.value = newData;
      // Initialize includedDirectories if not yet loaded from settings
      if (!hasLoadedFromSettings.value && includedDirectories.value.length === 0) {
        includedDirectories.value = [...newData];
      }
    }
  },
  { immediate: true }
);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const includedDirsSetting = newData.find(s => s.key === 'scanIncludedDirectories');
      if (includedDirsSetting) {
        try {
          const parsed = JSON.parse(includedDirsSetting.value);
          if (Array.isArray(parsed)) {
            includedDirectories.value = parsed;
          }
        } catch {
          // If parsing fails, use default
          includedDirectories.value = [...DEFAULT_INCLUDED_DIRECTORIES.value];
        }
      }
      hasLoadedFromSettings.value = true;
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
// Skip the first change which happens when loading from settings
let isFirstChange = true;
watch(
  includedDirectories,
  async newValue => {
    // Skip the first change when loading from settings
    if (isFirstChange && hasLoadedFromSettings.value) {
      isFirstChange = false;
      return;
    }

    if (
      isInitialized.value &&
      !updateSettingMutation.isPending.value &&
      Array.isArray(newValue) &&
      newValue.length > 0
    ) {
      try {
        await updateSettingMutation.mutateAsync({
          key: 'scanIncludedDirectories',
          value: newValue,
          type: 'json',
        });
      } catch (error) {
        console.error('Failed to save included directories:', error);
      }
    }
  },
  { deep: true }
);

const addDirectory = () => {
  const trimmed = newDirectory.value.trim();
  if (trimmed && !includedDirectories.value.includes(trimmed)) {
    includedDirectories.value = [...includedDirectories.value, trimmed];
    newDirectory.value = '';
  }
};

const removeDirectory = (index: number) => {
  includedDirectories.value = includedDirectories.value.filter((_, i) => i !== index);
};

const resetToDefault = () => {
  includedDirectories.value = [...DEFAULT_INCLUDED_DIRECTORIES.value];
};

const isDefaultValue = computed(() => {
  if (includedDirectories.value.length !== DEFAULT_INCLUDED_DIRECTORIES.value.length) {
    return false;
  }
  const sorted1 = [...includedDirectories.value].sort();
  const sorted2 = [...DEFAULT_INCLUDED_DIRECTORIES.value].sort();
  return sorted1.every((dir, i) => dir === sorted2[i]);
});

const isSaving = computed(() => updateSettingMutation.isPending.value);
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium">Scan Directories</label>
    <p class="text-muted-foreground text-sm">
      Base directories to scan for projects. The scanner will search these locations for projects up
      to the configured maximum depth. Use
      <code class="bg-muted rounded px-1 py-0.5 text-xs">~</code> for your home directory.
    </p>

    <!-- List of included directories -->
    <DirectoryTagList
      :directories="includedDirectories"
      :disabled="isSaving"
      @remove="removeDirectory"
    />

    <!-- Add new directory -->
    <div class="mt-2 flex items-center gap-2">
      <FolderAutocompleteInput
        v-model="newDirectory"
        placeholder="Add directory path (e.g., ~/MyProjects)..."
        class="flex-1"
        :max-depth="3"
      />
      <Button @click="addDirectory" variant="outline" size="sm" :disabled="!newDirectory.trim()">
        <Plus :size="16" class="mr-1" />
        Add
      </Button>
    </div>

    <!-- Reset button -->
    <div class="mt-2 flex items-center gap-4">
      <Button
        @click="resetToDefault"
        variant="outline"
        size="sm"
        :disabled="isDefaultValue || isSaving"
        class="flex items-center gap-2"
      >
        <RotateCcw />
        Reset to Default
      </Button>
      <span v-if="isSaving" class="text-muted-foreground text-sm">Saving...</span>
    </div>

    <p class="text-muted-foreground mt-2 text-xs">
      {{ includedDirectories.length }}
      {{ includedDirectories.length === 1 ? 'directory' : 'directories' }} will be scanned
    </p>
  </div>
</template>
