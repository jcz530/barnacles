<script setup lang="ts">
import { computed } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
import Button from '../../ui/button/Button.vue';
import Input from '../../ui/input/Input.vue';
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const DEFAULT_SCAN_MAX_DEPTH = 3;

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

const { value: scanMaxDepth, lastPersisted: lastSavedDepth } = usePersistedSetting<number>(
  () => settingsQuery.data.value,
  {
    read: data => {
      const stored = data.find(setting => setting.key === 'scanMaxDepth');
      if (stored === undefined) return undefined;
      const parsed = Number(stored.value);
      // A pre-fix row can hold "NaN" or "null"; don't seed the field with it.
      return Number.isFinite(parsed) ? parsed : DEFAULT_SCAN_MAX_DEPTH;
    },
    write: value =>
      updateSettingMutation.mutateAsync({ key: 'scanMaxDepth', value, type: 'number' }),
    initial: DEFAULT_SCAN_MAX_DEPTH,
    isValid: isUsableDepth,
  }
);

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
  <SettingRow
    label-for="scanMaxDepth"
    label="Scan Maximum Depth"
    description="Maximum directory depth to scan when searching for projects. Increase this value if your projects are nested deeper in subdirectories."
  >
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
    <p class="text-muted-foreground mt-2 text-xs">
      Default: {{ DEFAULT_SCAN_MAX_DEPTH }} • Current: {{ lastSavedDepth }} (Projects nested up to
      {{ lastSavedDepth }} levels deep will be found)
    </p>
  </SettingRow>
</template>
