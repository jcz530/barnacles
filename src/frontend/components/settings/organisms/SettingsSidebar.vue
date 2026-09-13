<script setup lang="ts">
import type { SidebarProps } from '@/components/ui/sidebar';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { ArrowLeft } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import SearchInput from '@/components/molecules/SearchInput.vue';
import { SETTINGS_SECTIONS } from '@/constants/settings';
import { useSettingsSearch } from '@/composables/useSettingsSearch';
import { useSettingsNav } from '@/composables/useSettingsNav';

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
});

const { navigate, activeSectionId } = useSettingsNav();

const { query, isSearching, visibleSections, hasResults } = useSettingsSearch();

// Sections carry their own settings while searching, so the sidebar shows the
// same matches the page does rather than a second opinion about the query.
const sections = ref(SETTINGS_SECTIONS);

const searchRef = ref<InstanceType<typeof SearchInput> | null>(null);

onMounted(() => {
  searchRef.value?.focus();
});
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <!--
        Leaving settings is a destination, not a nav item, so it sits above the
        search rather than in the list of sections. It reuses the menu button's
        own hover and focus treatment so it still feels like part of the rail.
      -->
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton as-child size="sm" class="text-muted-foreground">
            <RouterLink to="/">
              <ArrowLeft />
              <span>Back to app</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <div class="px-1 pb-1">
        <SearchInput ref="searchRef" v-model="query" placeholder="Search settings…" />
      </div>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem
            v-for="section in isSearching ? visibleSections : sections"
            :key="section.id"
          >
            <SidebarMenuButton
              as-child
              :is-active="!isSearching && activeSectionId === section.id"
              :tooltip="section.title"
            >
              <a :href="`#${section.id}`" @click.prevent="navigate(section.id)">
                <component :is="section.icon" />
                <span>{{ section.title }}</span>
              </a>
            </SidebarMenuButton>

            <!--
              While searching, the matching settings themselves are listed under
              their section. A search that only narrowed the headings would still
              leave you hunting for the row you typed the name of.
            -->
            <SidebarMenuSub v-if="isSearching">
              <SidebarMenuSubItem v-for="setting in section.settings" :key="setting.key">
                <SidebarMenuSubButton as-child>
                  <a :href="`#${section.id}`" @click.prevent="navigate(section.id, setting.key)">
                    <span>{{ setting.label }}</span>
                  </a>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarMenu>

        <p
          v-if="isSearching && !hasResults"
          class="text-muted-foreground px-2 py-6 text-center text-xs"
        >
          No settings match “{{ query }}”.
        </p>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template>
