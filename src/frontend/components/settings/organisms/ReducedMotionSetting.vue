<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { SETTING_KEYS } from '@shared/types/api';
import { useQueries } from '../../../composables/useQueries';
import {
  useReducedMotion,
  isMotionPreference,
  type MotionPreference,
} from '../../../composables/useReducedMotion';
import Button from '../../ui/button/Button.vue';
import SettingRow from '../molecules/SettingRow.vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const { setPreference } = useReducedMotion();

const OPTIONS: { value: MotionPreference; label: string; hint: string }[] = [
  { value: 'system', label: 'Follow system setting', hint: 'Match your OS accessibility setting' },
  { value: 'always', label: 'Always reduce', hint: 'Turn animations down everywhere' },
  { value: 'never', label: 'Never reduce', hint: 'Keep animations even if your OS reduces them' },
];

const motionPreference = ref<MotionPreference>('system');
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const stored = newData.find(s => s.key === SETTING_KEYS.REDUCED_MOTION)?.value;
      if (isMotionPreference(stored)) {
        motionPreference.value = stored;
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(motionPreference, async newValue => {
  // Apply immediately: the update mutation does not invalidate the settings
  // query, so nothing else would tell the rest of the app about this.
  setPreference(newValue);

  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    await updateSettingMutation.mutateAsync({
      key: SETTING_KEYS.REDUCED_MOTION,
      value: newValue,
      type: 'string',
    });
  }
});

const selected = computed(
  () => OPTIONS.find(option => option.value === motionPreference.value) ?? OPTIONS[0]
);
const isSaving = computed(() => updateSettingMutation.isPending.value);
</script>

<template>
  <SettingRow
    label-for="reducedMotion"
    label="Reduce Motion"
    description="Turn down animations like icon transitions and spinners. Follows your system accessibility setting unless you override it."
  >
    <div class="flex items-center gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button id="reducedMotion" variant="outline" class="w-64 justify-start">
            {{ selected.label }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-64">
          <DropdownMenuRadioGroup v-model="motionPreference">
            <DropdownMenuRadioItem
              v-for="option in OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span v-if="isSaving" class="text-muted-foreground text-sm">Saving...</span>
    </div>
    <p class="text-muted-foreground mt-2 text-xs">{{ selected.hint }}</p>
  </SettingRow>
</template>
