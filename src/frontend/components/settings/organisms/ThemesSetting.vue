<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTheme } from '@/composables/useTheme';
import { Palette } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const router = useRouter();
const { activeTheme } = useTheme();

function openThemePicker() {
  router.push('/themes');
}
</script>

<template>
  <div class="space-y-3">
    <div>
      <Label>Theme</Label>
      <p class="text-muted-foreground text-sm">
        Customize the application's color scheme and design tokens
      </p>
    </div>

    <div class="flex items-center gap-3">
      <!-- Active Theme Display -->
      <div class="bg-card flex flex-1 items-center gap-3 rounded-lg border px-4 py-3">
        <div class="flex gap-1.5">
          <div
            class="h-8 w-5 rounded border"
            :style="{ backgroundColor: activeTheme?.primaryColor || '#00c2e5' }"
          />
          <div
            class="h-8 w-5 rounded border"
            :style="{ backgroundColor: activeTheme?.slateColor || '#64748b' }"
          />
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium">
            {{ activeTheme?.name || 'Default Sky' }}
          </div>
          <div class="text-muted-foreground text-xs">
            {{ activeTheme?.isDefault ? 'Default Theme' : 'Custom Theme' }}
          </div>
        </div>
      </div>

      <!-- Change Theme Button -->
      <Button variant="outline" @click="openThemePicker">
        <Palette class="mr-2 h-4 w-4" />
        Change Theme
      </Button>
    </div>
  </div>
</template>
