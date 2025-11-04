<script setup lang="ts">
import type { Theme } from '@/../../shared/types/theme';
import { Check, Trash2 } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import ThemeColorPreview from './ThemeColorPreview.vue';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/composables/useTheme';

defineProps<{
  theme: Theme;
  isActive: boolean;
}>();

const emit = defineEmits<{
  delete: [themeId: string];
}>();

const { activateTheme } = useTheme();

async function handleActivateTheme(themeId: string) {
  try {
    await activateTheme(themeId);
  } catch (error) {
    console.error('Failed to activate theme:', error);
  }
}

function handleDelete(event: MouseEvent, themeId: string) {
  event.stopPropagation();
  emit('delete', themeId);
}
</script>

<template>
  <Card
    class="group relative flex cursor-pointer flex-col items-start gap-3 rounded-lg border p-4 transition-all"
    :class="{
      'border-primary bg-primary-500/20': isActive,
      'border-border': !isActive,
    }"
    @click="handleActivateTheme(theme.id)"
  >
    <!-- Delete Button (Custom Themes Only) -->
    <Button
      v-if="!theme.isDefault"
      variant="ghost"
      size="icon"
      class="absolute top-2 right-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
      @click="handleDelete($event, theme.id)"
    >
      <Trash2 class="text-destructive h-4 w-4" />
    </Button>

    <!-- Color Preview -->
    <ThemeColorPreview :theme="theme" />

    <!-- Theme Info -->
    <div class="min-w-0 flex-1 text-left">
      <div class="mb-1.5 flex items-center gap-2">
        <span class="truncate text-base font-medium">{{ theme.name }}</span>
        <Check v-if="isActive" class="text-primary h-4 w-4 flex-shrink-0" />
      </div>
      <div class="text-muted-foreground mb-2 flex items-center gap-2 text-xs">
        <Badge variant="outline" class="px-1.5 py-0.5 text-[10px]">
          {{ theme.borderRadius }}
        </Badge>
      </div>
      <RouterLink
        class="text-primary cursor-pointer text-xs font-medium hover:underline"
        :to="{ name: 'ThemeEdit', params: { id: theme.id } }"
      >
        Customize →
      </RouterLink>
    </div>
  </Card>
</template>
