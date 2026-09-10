<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import Button from '../../ui/button/Button.vue';
import Input from '../../ui/input/Input.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const DEFAULT_SCAN_MAX_DEPTH = 3;

const scanMaxDepth = ref(DEFAULT_SCAN_MAX_DEPTH);
const isInitialized = ref(false);

/**
 * The last value known to be persisted.
 *
 * Not read from the settings query: `useUpdateSettingMutation` deliberately
 * does not invalidate it (that would retrigger this component's auto-save
 * watcher in a loop), so the cache still holds the value fetched on mount.
 * Restoring from it would overwrite a newer saved value and, because the
 * assignment retriggers the watcher, persist the stale one.
 */
const lastSavedDepth = ref(DEFAULT_SCAN_MAX_DEPTH);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const maxDepthSetting = newData.find(s => s.key === 'scanMaxDepth');
      if (maxDepthSetting) {
        const stored = Number(maxDepthSetting.value);
        // A pre-fix row can hold "NaN" or "null"; don't seed the field with it.
        scanMaxDepth.value = Number.isFinite(stored) ? stored : DEFAULT_SCAN_MAX_DEPTH;
        lastSavedDepth.value = scanMaxDepth.value;
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

const MIN_SCAN_MAX_DEPTH = 1;
const MAX_SCAN_MAX_DEPTH = 10;

/**
 * `v-model.number` yields NaN while the input is empty or mid-edit (e.g. the
 * user cleared it to retype). NaN has no JSON literal, so persisting it stored
 * the string "null" and read back as NaN -- and every `depth > NaN` comparison
 * is false, so the scan silently found nothing. Hold the last good value
 * instead of writing a broken one; the field is restored on blur.
 */
const isUsableDepth = (value: number): boolean =>
  Number.isFinite(value) && value >= MIN_SCAN_MAX_DEPTH && value <= MAX_SCAN_MAX_DEPTH;

// Auto-save when value changes (after initialization)
watch(scanMaxDepth, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    if (!isUsableDepth(newValue)) {
      return;
    }

    await updateSettingMutation.mutateAsync({
      key: 'scanMaxDepth',
      value: newValue,
      type: 'number',
    });
    lastSavedDepth.value = newValue;
  }
});

/**
 * Restore the saved value when the user leaves an empty or out-of-range field,
 * so the input never sits showing a value that was never saved.
 */
const restoreOnBlur = () => {
  if (isUsableDepth(scanMaxDepth.value)) {
    return;
  }

  scanMaxDepth.value = lastSavedDepth.value;
};

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
        :min="MIN_SCAN_MAX_DEPTH"
        :max="MAX_SCAN_MAX_DEPTH"
        @blur="restoreOnBlur"
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
      Default: {{ DEFAULT_SCAN_MAX_DEPTH }} • Current: {{ lastSavedDepth }} (Projects nested up to
      {{ lastSavedDepth }} levels deep will be found)
    </p>
  </div>
</template>
