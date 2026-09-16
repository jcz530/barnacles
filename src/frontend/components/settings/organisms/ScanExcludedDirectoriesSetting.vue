<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting, arrayEquals } from '../../../composables/usePersistedSetting';
import Button from '../../ui/button/Button.vue';
import FolderAutocompleteInput from '../../molecules/FolderAutocompleteInput.vue';
import DirectoryTagList from '../molecules/DirectoryTagList.vue';
import { Plus, RotateCcw } from 'lucide-vue-next';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation, useDefaultSettingQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const defaultSettingQuery = useDefaultSettingQuery('scanExcludedDirectories', { enabled: true });

const DEFAULT_EXCLUDED_DIRECTORIES = ref<string[]>([]);
const newDirectory = ref('');

const { value: excludedDirectories, hasStoredValue } = usePersistedSetting<string[]>(
  () => settingsQuery.data.value,
  {
    read: data => {
      const stored = data.find(setting => setting.key === 'scanExcludedDirectories');
      if (stored === undefined) return undefined;
      try {
        const parsed = JSON.parse(stored.value);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        // If parsing fails, use default
        return [...DEFAULT_EXCLUDED_DIRECTORIES.value];
      }
    },
    write: value =>
      updateSettingMutation.mutateAsync({ key: 'scanExcludedDirectories', value, type: 'json' }),
    initial: [],
    equals: arrayEquals,
    onError: error => console.error('Failed to save excluded directories:', error),
  }
);

// Seed from the backend defaults only while no stored value is known.
// Gated on `hasStoredValue` rather than `hasHydrated`: a payload that carries
// no row for this setting still counts as hydrated, and seeding must remain
// possible for it -- otherwise whichever query resolves first decides whether
// the defaults ever appear. A user who has saved an empty list has a row, so
// they keep their empty list.
watch(
  () => defaultSettingQuery.data.value,
  newData => {
    if (newData && Array.isArray(newData)) {
      DEFAULT_EXCLUDED_DIRECTORIES.value = newData;
      if (!hasStoredValue.value && excludedDirectories.value.length === 0) {
        excludedDirectories.value = [...newData];
      }
    }
  },
  { immediate: true }
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
  <SettingRow
    label="Excluded Directories"
    description="Directories to exclude when scanning and calculating project statistics. These folders will be completely ignored during project analysis."
  >
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
  </SettingRow>
</template>
