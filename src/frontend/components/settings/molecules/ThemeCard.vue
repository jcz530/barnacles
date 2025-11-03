<script setup lang="ts">
import type { Theme } from '@/../../shared/types/theme';
import { Check } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import ThemeColorPreview from './ThemeColorPreview.vue';
import { Card } from '@/components/ui/card';

defineProps<{
  theme: Theme;
  isActive: boolean;
}>();

const emit = defineEmits<{
  activate: [themeId: string];
}>();

function handleActivate(themeId: string) {
  emit('activate', themeId);
}
</script>

<template>
  <Card
    class="group relative flex cursor-pointer flex-col items-start gap-3 rounded-lg border p-4 transition-all"
    :class="{
      'border-primary bg-primary-500/20': isActive,
      'border-border': !isActive,
    }"
    @click="handleActivate(theme.id)"
  >
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
