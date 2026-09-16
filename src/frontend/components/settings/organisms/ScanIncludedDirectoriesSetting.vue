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
const defaultSettingQuery = useDefaultSettingQuery('scanIncludedDirectories', { enabled: true });

const DEFAULT_INCLUDED_DIRECTORIES = ref<string[]>([]);
const newDirectory = ref('');

const { value: includedDirectories, hasStoredValue } = usePersistedSetting<string[]>(
  () => settingsQuery.data.value,
  {
    read: data => {
      const stored = data.find(setting => setting.key === 'scanIncludedDirectories');
      if (stored === undefined) return undefined;
      try {
        const parsed = JSON.parse(stored.value);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        // If parsing fails, use default
        return [...DEFAULT_INCLUDED_DIRECTORIES.value];
      }
    },
    write: value =>
      updateSettingMutation.mutateAsync({ key: 'scanIncludedDirectories', value, type: 'json' }),
    initial: [],
    equals: arrayEquals,
    // The scan needs at least one root; an empty list would disable it entirely.
    isValid: value => value.length > 0,
    onError: error => console.error('Failed to save included directories:', error),
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
      DEFAULT_INCLUDED_DIRECTORIES.value = newData;
      if (!hasStoredValue.value && includedDirectories.value.length === 0) {
        includedDirectories.value = [...newData];
      }
    }
  },
  { immediate: true }
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

/*
 * The scan needs at least one root, so `isValid` refuses to persist an empty
 * list. Without saying so the row would just stop saving: the last tag
 * disappears, the page still reads "0 directories", and a reload brings the
 * removed directory back. Say it instead.
 */
const isEmpty = computed(() => includedDirectories.value.length === 0);
</script>

<template>
  <SettingRow label="Scan Directories">
    <template #description>
      Base directories to scan for projects. The scanner will search these locations for projects up
      to the configured maximum depth. Use
      <code class="bg-muted rounded px-1 py-0.5 text-xs">~</code> for your home directory.
    </template>

    <!-- List of included directories -->
    <DirectoryTagList
      :directories="includedDirectories"
      :disabled="isSaving"
      @remove="removeDirectory"
    />

    <p v-if="isEmpty" class="text-danger-500 mt-2 text-xs">
      Add at least one directory — an empty list is not saved, and the previous one stays in effect.
    </p>

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
  </SettingRow>
</template>
