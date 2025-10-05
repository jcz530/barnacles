<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../composables/useQueries';
import Button from '../ui/button/Button.vue';
import Input from '../ui/input/Input.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const DEFAULT_SCAN_MAX_DEPTH = 3;

const scanMaxDepth = ref(DEFAULT_SCAN_MAX_DEPTH);
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const maxDepthSetting = newData.find(s => s.key === 'scanMaxDepth');
      if (maxDepthSetting) {
        scanMaxDepth.value = Number(maxDepthSetting.value);
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(scanMaxDepth, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    await updateSettingMutation.mutateAsync({
      key: 'scanMaxDepth',
      value: newValue,
      type: 'number',
    });
  }
});

const resetToDefault = () => {
  scanMaxDepth.value = DEFAULT_SCAN_MAX_DEPTH;
};

const isDefaultValue = computed(() => scanMaxDepth.value === DEFAULT_SCAN_MAX_DEPTH);
const isSaving = computed(() => updateSettingMutation.isPending.value);
</script>

<template>
  <div class="flex flex-col gap-2">
    <label for="scanMaxDepth" class="text-sm font-medium">Scan Maximum Depth</label>
    <p class="text-muted-foreground text-sm">
      Maximum directory depth to scan when searching for projects. Increase this value if your
      projects are nested deeper in subdirectories.
    </p>
    <div class="flex items-center gap-4">
      <Input
        id="scanMaxDepth"
        v-model.number="scanMaxDepth"
        type="number"
        min="1"
        max="10"
        :class="['w-32', isDefaultValue ? 'text-muted-foreground' : '']"
      />
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
      Default: {{ DEFAULT_SCAN_MAX_DEPTH }} • Current: {{ scanMaxDepth }} (Projects nested up to
      {{ scanMaxDepth }} levels deep will be found)
    </p>
  </div>
</template>
