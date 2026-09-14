<script setup lang="ts">
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { RouteNames } from '@/router';
import { useColorMode } from '@vueuse/core';
import { useRoute } from 'vue-router';
import { Cog, Moon, Palette, Sun, SunMoon } from 'lucide-vue-next';
import { computed } from 'vue';

const route = useRoute();

/**
 * useColorMode owns the light/dark/auto tri-state: it resolves `auto` against
 * the system preference, writes the class onto <html>, and persists to
 * localStorage. `emitAuto` keeps `auto` distinguishable from the light or dark
 * it currently resolves to, which is what the icon and label need.
 *
 * useDark, which this used alongside a separate ref before, is useColorMode
 * with the auto state collapsed away — and both defaulted to the same
 * 'vueuse-color-scheme' storage key, so each write raced the other.
 *
 * valueLight must stay 'light': main.css pairs a `.dark` block with `:root`,
 * and useColorInversion keys its inversion off the same class.
 */
const mode = useColorMode({
  selector: 'html',
  attribute: 'class',
  modes: { light: 'light', dark: 'dark' },
  emitAuto: true,
  initialValue: 'auto',
});

const currentIcon = computed(() => {
  if (mode.value === 'auto') return SunMoon;
  return mode.value === 'dark' ? Moon : Sun;
});

const currentLabel = computed(() => {
  if (mode.value === 'auto') return 'Auto';
  return mode.value === 'dark' ? 'Dark' : 'Light';
});

function cycleTheme() {
  const modes = ['light', 'dark', 'auto'] as const;
  const currentIndex = modes.indexOf(mode.value as (typeof modes)[number]);
  mode.value = modes[(currentIndex + 1) % modes.length];
}
const isActive = computed(() => route.path.startsWith('/theme'));
const isSettingsActive = computed(() => route.path.startsWith('/settings'));
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarGroupLabel>Settings</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="sm" :is-active="isSettingsActive" as-child>
            <RouterLink to="/settings">
              <Cog />
              <span>Settings</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
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
