<script setup lang="ts">
import { computed } from 'vue';
import type { SettingKey } from '@/shared/types/api';

interface Props {
  settingKey: SettingKey;
  highlighted?: SettingKey | null;
}

const props = defineProps<Props>();

const isHighlighted = computed(() => props.highlighted === props.settingKey);
</script>

<template>
  <div
    :data-setting="settingKey"
    :class="[
      '-m-4 rounded-md bg-none p-4 transition-all duration-5000 ease-in-out',
      { 'bg-primary-500/20 ring-ring ring-2': isHighlighted },
    ]"
  >
    <slot />
  </div>
</template>
