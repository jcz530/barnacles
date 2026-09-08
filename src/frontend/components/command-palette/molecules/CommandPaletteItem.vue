<script setup lang="ts">
import { ComboboxItem } from 'reka-ui';
import type { Command } from '@/commands/types';

defineProps<{ command: Command }>();
</script>

<template>
  <ComboboxItem
    :value="command.id"
    class="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-hidden select-none"
  >
    <component :is="command.icon" v-if="command.icon" class="size-4 shrink-0 opacity-70" />
    <span class="truncate">{{ command.title }}</span>
    <span v-if="command.subtitle" class="text-muted-foreground ml-auto truncate pl-4 text-xs">
      {{ command.subtitle }}
    </span>
  </ComboboxItem>
</template>
