<script setup lang="ts">
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import type { LucideIcon } from 'lucide-vue-next';
import { ChevronRight } from 'lucide-vue-next';

defineProps<{
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    count?: number;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}>();
</script>

<template>
  <SidebarGroup>
    <!-- <SidebarGroupLabel>Main</SidebarGroupLabel> -->
    <SidebarMenu>
      <Collapsible v-for="item in items" :key="item.title" as-child :default-open="item.isActive">
        <SidebarMenuItem>
          <SidebarMenuButton as-child :tooltip="item.title" :is-active="item.isActive">
            <RouterLink :to="item.url">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
              <span
                v-if="item.count"
                class="ml-auto text-xs opacity-90"
                :class="[item.isActive ? 'text-slate-100' : '']"
              >
                {{ item.count }}
              </span>
            </RouterLink>
          </SidebarMenuButton>
          <template v-if="item.items?.length">
            <CollapsibleTrigger as-child>
              <SidebarMenuAction class="data-[state=open]:rotate-90">
                <ChevronRight />
                <span class="sr-only">Toggle</span>
              </SidebarMenuAction>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem v-for="subItem in item.items" :key="subItem.title">
                  <SidebarMenuSubButton as-child>
                    <RouterLink :to="subItem.url">
                      <span>{{ subItem.title }}</span>
                    </RouterLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </template>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  </SidebarGroup>
</template>
