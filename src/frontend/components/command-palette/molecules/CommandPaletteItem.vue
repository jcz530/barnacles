<script setup lang="ts">
import { ComboboxItem } from 'reka-ui';
import { ChevronRight } from 'lucide-vue-next';
import type { Command } from '@/commands/types';
import ProjectIcon from '@/components/projects/atoms/ProjectIcon.vue';
import { Skeleton } from '@/components/ui/skeleton';
import KeyHint from '@/components/atoms/KeyHint.vue';

defineProps<{ command: Command }>();

const emit = defineEmits<{ select: [] }>();
</script>

<template>
  <!--
    A placeholder, not a row. Rendered as a plain div rather than a ComboboxItem
    so the arrow keys skip past it and Enter cannot land on it -- a row you can
    highlight but not act on reads as broken.
  -->
  <div v-if="command.loading" class="flex items-center gap-3 px-3 py-2" aria-hidden="true">
    <Skeleton class="size-4 shrink-0 rounded" />
    <Skeleton class="h-3.5 w-32" />
  </div>

  <!--
    data-[highlighted] is the attribute-presence form Reka actually sets;
    "data-highlighted:" is not a Tailwind selector and silently emits no CSS,
    which leaves the keyboard cursor invisible.

    The highlight matches the sidebar's active item -- the primary colour rather
    than the muted accent -- so the row the keyboard is on stands out at a
    glance, which matters more here than in a list you point at.
  -->
  <ComboboxItem
    v-else
    :value="command.id"
    class="group data-[highlighted]:bg-sidebar-accent/80 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-hidden select-none data-[highlighted]:font-medium data-[highlighted]:text-slate-50"
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
    <!--
      Stacked rather than side by side when a row asks for it, the way the
      project page lists scripts. A script body runs to hundreds of characters,
      and beside the name it leaves nothing for the name itself.
    -->
    <span v-if="command.stackSubtitle" class="flex min-w-0 flex-1 flex-col">
      <span class="truncate">{{ command.title }}</span>
      <span
        v-if="command.subtitle"
        class="text-muted-foreground truncate text-xs group-data-[highlighted]:text-current group-data-[highlighted]:opacity-80"
      >
        {{ command.subtitle }}
      </span>
    </span>
    <span v-else class="truncate">{{ command.title }}</span>

    <!--
      Sits with the title rather than out at the end, so it reads as a property
      of the thing named rather than as another column. shrink-0 because a dot
      that truncates is just missing.
    -->
    <span
      v-if="command.isRunning"
      class="bg-success-500 size-1.5 shrink-0 rounded-full"
      aria-hidden="true"
    />

    <!--
      min-w-0 so this can shrink: as shrink-0 a long subtitle grew unbounded and
      squeezed the title out of the row entirely, which truncate on the title
      cannot fix -- a flex sibling that refuses to yield leaves it no width.
    -->
    <span class="ml-auto flex min-w-0 shrink items-center gap-2 pl-4">
      <span
        v-if="command.subtitle && !command.stackSubtitle"
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
