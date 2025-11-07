<script setup lang="ts">
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { RouteNames } from '@/router';
import { useDark, useLocalStorage } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { Moon, Palette, Sun, SunMoon } from 'lucide-vue-next';
import { computed } from 'vue';

const router = useRouter();
const route = useRoute();

const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: 'light',
});

// Track the mode: 'light', 'dark', or 'auto'
const themeMode = useLocalStorage<'light' | 'dark' | 'auto'>('vueuse-color-scheme', 'auto');

const currentIcon = computed(() => {
  if (themeMode.value === 'auto') return SunMoon;
  return isDark.value ? Moon : Sun;
});

const currentLabel = computed(() => {
  if (themeMode.value === 'auto') return 'Auto';
  return isDark.value ? 'Dark' : 'Light';
});

function cycleTheme() {
  const modes: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];
  const currentIndex = modes.indexOf(themeMode.value);
  const nextMode = modes[(currentIndex + 1) % modes.length];

  themeMode.value = nextMode;

  if (nextMode === 'auto') {
    // Set based on system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDark.value = prefersDark;
  } else {
    isDark.value = nextMode === 'dark';
  }
}
const isActive = computed(() => route.path.startsWith('/theme'));
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" @click="cycleTheme">
            <component :is="currentIcon" />
            <span>{{ currentLabel }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" :is-active="isActive" as-child>
            <RouterLink :to="{ name: RouteNames.Themes }">
              <Palette />
              <span>Themes</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
