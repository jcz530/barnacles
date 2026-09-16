<script setup lang="ts">
import { computed, watch } from 'vue';
import { SETTING_KEYS } from '@shared/types/api';
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
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

const { value: motionPreference } = usePersistedSetting<MotionPreference>(
  () => settingsQuery.data.value,
  {
    read: data => {
      const stored = data.find(setting => setting.key === SETTING_KEYS.REDUCED_MOTION)?.value;
      return isMotionPreference(stored) ? stored : undefined;
    },
    write: value =>
      updateSettingMutation.mutateAsync({
        key: SETTING_KEYS.REDUCED_MOTION,
        value,
        type: 'string',
      }),
    initial: 'system',
    // Apply the stored preference as soon as it lands: the update mutation does
    // not invalidate the settings query, so nothing else would tell the rest of
    // the app about it.
    onHydrate: setPreference,
  }
);

// Apply a user-made change immediately, without waiting for the write.
watch(motionPreference, setPreference);

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
