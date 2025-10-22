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
const defaultSettingQuery = useDefaultSettingQuery('scanExcludedDirectories', { enabled: true });

const DEFAULT_EXCLUDED_DIRECTORIES = ref<string[]>([]);
const excludedDirectories = ref<string[]>([]);
const newDirectory = ref('');
const isInitialized = ref(false);
const hasLoadedFromSettings = ref(false);

// Update default directories when loaded from backend
watch(
  () => defaultSettingQuery.data.value,
  newData => {
    if (newData && Array.isArray(newData)) {
      DEFAULT_EXCLUDED_DIRECTORIES.value = newData;
      // Initialize excludedDirectories if not yet loaded from settings
      if (!hasLoadedFromSettings.value && excludedDirectories.value.length === 0) {
        excludedDirectories.value = [...newData];
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
      const excludedDirsSetting = newData.find(s => s.key === 'scanExcludedDirectories');
      if (excludedDirsSetting) {
        try {
          const parsed = JSON.parse(excludedDirsSetting.value);
          if (Array.isArray(parsed)) {
            excludedDirectories.value = parsed;
          }
        } catch {
          // If parsing fails, use default
          excludedDirectories.value = [...DEFAULT_EXCLUDED_DIRECTORIES.value];
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
  excludedDirectories,
  async newValue => {
    // Skip the first change when loading from settings
    if (isFirstChange && hasLoadedFromSettings.value) {
      isFirstChange = false;
      return;
    }

    if (isInitialized.value && !updateSettingMutation.isPending.value && Array.isArray(newValue)) {
      try {
        await updateSettingMutation.mutateAsync({
          key: 'scanExcludedDirectories',
          value: newValue,
          type: 'json',
        });
      } catch (error) {
        console.error('Failed to save excluded directories:', error);
      }
    }
  },
  { deep: true }
);

const addDirectory = () => {
  const trimmed = newDirectory.value.trim();
  if (trimmed && !excludedDirectories.value.includes(trimmed)) {
    excludedDirectories.value = [...excludedDirectories.value, trimmed];
    newDirectory.value = '';
  }
};

const removeDirectory = (index: number) => {
  excludedDirectories.value = excludedDirectories.value.filter((_, i) => i !== index);
};

const resetToDefault = () => {
  excludedDirectories.value = [...DEFAULT_EXCLUDED_DIRECTORIES.value];
};

const isDefaultValue = computed(() => {
  if (excludedDirectories.value.length !== DEFAULT_EXCLUDED_DIRECTORIES.value.length) {
    return false;
  }
  const sorted1 = [...excludedDirectories.value].sort();
  const sorted2 = [...DEFAULT_EXCLUDED_DIRECTORIES.value].sort();
  return sorted1.every((dir, i) => dir === sorted2[i]);
});

const isSaving = computed(() => updateSettingMutation.isPending.value);
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium">Excluded Directories</label>
    <p class="text-muted-foreground text-sm">
      Directories to exclude when scanning and calculating project statistics. These folders will be
      completely ignored during project analysis.
    </p>

    <!-- List of excluded directories -->
    <DirectoryTagList
      :directories="excludedDirectories"
      :disabled="isSaving"
      @remove="removeDirectory"
    />

    <!-- Add new directory -->
    <div class="mt-2 flex items-center gap-2">
      <FolderAutocompleteInput
        v-model="newDirectory"
        placeholder="Add directory to exclude..."
        class="flex-1"
        :max-depth="3"
        :strict="false"
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
      {{ excludedDirectories.length }} directories excluded • Note: Files and directories in
      <code class="bg-muted rounded px-1 py-0.5 text-xs">.gitignore</code> are also automatically
      excluded
    </p>
  </div>
</template>
