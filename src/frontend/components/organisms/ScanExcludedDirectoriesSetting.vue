<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../composables/useQueries';
import Button from '../ui/button/Button.vue';
import Input from '../ui/input/Input.vue';
import { X, Plus } from 'lucide-vue-next';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const DEFAULT_EXCLUDED_DIRECTORIES = [
  'node_modules',
  '.git',
  'vendor',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  'venv',
  'target',
];

const excludedDirectories = ref<string[]>([...DEFAULT_EXCLUDED_DIRECTORIES]);
const newDirectory = ref('');
const isInitialized = ref(false);
const hasLoadedFromSettings = ref(false);

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
          excludedDirectories.value = [...DEFAULT_EXCLUDED_DIRECTORIES];
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
  excludedDirectories.value = [...DEFAULT_EXCLUDED_DIRECTORIES];
};

const isDefaultValue = computed(() => {
  if (excludedDirectories.value.length !== DEFAULT_EXCLUDED_DIRECTORIES.length) {
    return false;
  }
  const sorted1 = [...excludedDirectories.value].sort();
  const sorted2 = [...DEFAULT_EXCLUDED_DIRECTORIES].sort();
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
    <div class="mt-2 flex flex-wrap gap-2">
      <div
        v-for="(dir, index) in excludedDirectories"
        :key="index"
        class="bg-secondary flex items-center gap-1 rounded-md px-3 py-1 text-sm"
      >
        <span>{{ dir }}</span>
        <button
          @click="removeDirectory(index)"
          class="hover:text-destructive ml-1 transition-colors"
          :disabled="isSaving"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Add new directory -->
    <div class="mt-2 flex items-center gap-2">
      <Input
        v-model="newDirectory"
        placeholder="Add directory to exclude..."
        @keyup.enter="addDirectory"
        class="flex-1"
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
      {{ excludedDirectories.length }} directories excluded • Note: Files and directories in
      <code class="bg-muted rounded px-1 py-0.5 text-xs">.gitignore</code> are also automatically
      excluded
    </p>
  </div>
</template>
