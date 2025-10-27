<script setup lang="ts">
import type { Alias } from '@/shared/types/api';
import { Button } from '../../ui/button';
import { Eye, EyeOff, Trash2 } from 'lucide-vue-next';
import InlineEditInput from '../../atoms/InlineEditInput.vue';

interface Props {
  alias: Alias;
  isNew?: boolean;
  isNameModified?: boolean;
  isCommandModified?: boolean;
  isDescriptionModified?: boolean;
  isShowCommandModified?: boolean;
}

withDefaults(defineProps<Props>(), {
  isNew: false,
  isNameModified: false,
  isCommandModified: false,
  isDescriptionModified: false,
  isShowCommandModified: false,
});

const emit = defineEmits<{
  'update:field': [field: keyof Alias, value: unknown];
  remove: [];
}>();

// Validate alias name
const isValidAliasName = (name: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(name);
};

// Category colors
const categoryColors: Record<string, string> = {
  git: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  docker: 'bg-blue-100 text-blue-800 border-blue-300',
  system: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  custom: 'bg-cyan-100 text-cyan-800 border-cyan-300',
};

const getCategoryColor = (category: string) => {
  return categoryColors[category] || categoryColors.custom;
};
</script>

<template>
  <tr class="hover:bg-muted/50 border-b transition-colors">
    <td
      class="px-4 py-3 transition-colors"
      :class="{
        'bg-amber-50': isShowCommandModified,
      }"
    >
      <Button
        variant="ghost"
        title="Toggle whether the command is echoed to your terminal before it runs"
        @click="emit('update:field', 'showCommand', !alias.showCommand)"
        class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
        type="button"
      >
        <Eye v-if="alias.showCommand" class="h-3 w-3" />
        <EyeOff v-else class="h-3 w-3 text-slate-400" />
      </Button>
    </td>
    <!-- Alias Name Cell -->
    <td
      class="w-[25%] px-4 py-3 transition-colors"
      :class="{
        'bg-amber-50': isNameModified,
      }"
    >
      <InlineEditInput
        :model-value="alias.name"
        @update:model-value="val => emit('update:field', 'name', val)"
        placeholder="alias-name"
        :is-invalid="alias.name && !isValidAliasName(alias.name)"
        class="font-mono"
      />
    </td>

    <!-- Command Cell -->
    <td
      class="w-[40%] px-4 py-3 transition-colors"
      :class="{
        'bg-amber-50': isCommandModified,
      }"
    >
      <InlineEditInput
        :model-value="alias.command"
        @update:model-value="val => emit('update:field', 'command', val)"
        placeholder="command to run"
        :is-invalid="!alias.command"
        class="font-mono"
      />
      <div v-if="alias.description" class="text-muted-foreground mt-1 text-xs">
        {{ alias.description }}
      </div>
    </td>

    <!-- Category Cell -->
    <td class="w-[20%] px-4 py-3">
      <select
        :value="alias.category"
        @change="e => emit('update:field', 'category', (e.target as HTMLSelectElement).value)"
        class="text-foreground bg-background border-input ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
      >
        <option value="git">Git</option>
        <option value="docker">Docker</option>
        <option value="system">System</option>
        <option value="custom">Custom</option>
      </select>
    </td>

    <!-- Actions Cell -->
    <td class="w-[15%] px-4 py-3">
      <div class="flex justify-end">
        <Button @click="emit('remove')" variant="ghost" size="icon" class="h-8 w-8">
          <Trash2 class="text-destructive h-4 w-4" />
        </Button>
      </div>
    </td>
  </tr>
</template>
