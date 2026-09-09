<script setup lang="ts">
import { ComboboxItem } from 'reka-ui';
import { ChevronRight } from 'lucide-vue-next';
import type { Command } from '@/commands/types';
import ProjectIcon from '@/components/projects/atoms/ProjectIcon.vue';
import KeyHint from '@/components/atoms/KeyHint.vue';

defineProps<{ command: Command }>();

const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <!--
    data-[highlighted] is the attribute-presence form Reka actually sets;
    "data-highlighted:" is not a Tailwind selector and silently emits no CSS,
    which leaves the keyboard cursor invisible.

    The highlight matches the sidebar's active item -- the primary colour rather
    than the muted accent -- so the row the keyboard is on stands out at a
    glance, which matters more here than in a list you point at.
  -->
  <ComboboxItem
    :value="command.id"
    class="group data-[highlighted]:bg-sidebar-accent/80 data-[highlighted]:text-sidebar-accent-foreground flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-hidden select-none data-[highlighted]:font-medium"
    @select="emit('select')"
  >
    <ProjectIcon
      v-if="command.projectIcon"
      v-bind="command.projectIcon"
      size="sm"
      class="shrink-0"
    />
    <component
      :is="command.icon"
      v-else-if="command.icon"
      class="size-4 shrink-0 opacity-70 group-data-[highlighted]:opacity-100"
    />
    <span class="truncate">{{ command.title }}</span>

    <span class="ml-auto flex shrink-0 items-center gap-2 pl-4">
      <span
        v-if="command.subtitle"
        class="text-muted-foreground truncate text-xs group-data-[highlighted]:text-current group-data-[highlighted]:opacity-80"
      >
        {{ command.subtitle }}
      </span>
      <KeyHint v-if="command.accelerator" :accelerator="command.accelerator" />
      <!--
        A row with actions but no verb of its own opens a list rather than doing
        something, and the chevron is what says so before you press Enter.
      -->
      <ChevronRight
        v-else-if="!command.run && command.actions"
        class="size-3.5 opacity-40 group-data-[highlighted]:opacity-80"
        aria-hidden="true"
      />
    </span>
  </ComboboxItem>
</template>
