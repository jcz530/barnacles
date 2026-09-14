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
import { useSettingsReturn } from '@/composables/useSettingsReturn';

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
});

const { navigate, activeSectionId } = useSettingsNav();

const { query, isSearching, visibleSections, hasResults, firstMatch } = useSettingsSearch();

const { returnPath } = useSettingsReturn();

// Sections carry their own settings while searching, so the sidebar shows the
// same matches the page does rather than a second opinion about the query.
const sections = ref(SETTINGS_SECTIONS);

const searchRef = ref<InstanceType<typeof SearchInput> | null>(null);

onMounted(() => {
  searchRef.value?.focus();
});

/*
 * Keys are handled here rather than inside SearchInput: that molecule is shared
 * with the projects list and the file tree, which have their own ideas about
 * what Enter and the arrows mean. Scoping the bindings to this field keeps the
 * behaviour local to settings.
 */

/** Enter jumps to the best match and highlights it, reusing the deep-link ring. */
function onEnter() {
  const match = firstMatch.value;
  if (!match) return;
  navigate(match.sectionId, match.key);
}

/**
 * Up/Down step between section headings.
 *
 * While a search is active the visible sections are the filtered ones, so the
 * arrows walk what is actually on screen rather than the full registry.
 */
function onArrow(direction: 1 | -1) {
  const list = isSearching.value ? visibleSections.value : SETTINGS_SECTIONS;
  if (list.length === 0) return;

  const index = list.findIndex(section => section.id === activeSectionId.value);
  // No active section yet (nothing scrolled): Down starts at the top, Up at the
  // bottom, so the first press always lands somewhere sensible.
  const next =
    index === -1
      ? direction === 1
        ? 0
        : list.length - 1
      : Math.min(Math.max(index + direction, 0), list.length - 1);

  navigate(list[next].id);
}
</script>

<template>
  <!--
    Arrows are bound on the rail rather than on the search field. Clicking a
    heading moves focus to that link, and handlers living on the input would
    stop firing the moment the mouse was used -- so picking a section by mouse
    would end keyboard navigation until you clicked back into the field. On the
    root they work wherever focus landed inside the sidebar.

    Escape is not here: it applies to the whole settings page, not just the
    rail, so useSettingsEscape owns it at the window.
  -->
  <Sidebar v-bind="props" @keydown.down.prevent="onArrow(1)" @keydown.up.prevent="onArrow(-1)">
    <SidebarHeader>
      <!--
        Leaving settings is a destination, not a nav item, so it sits above the
        search rather than in the list of sections. It reuses the menu button's
        own hover and focus treatment so it still feels like part of the rail.
      -->
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton as-child size="sm" class="text-muted-foreground">
            <RouterLink :to="returnPath">
              <ArrowLeft />
              <span>Back to app</span>
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <div class="px-1 pb-1">
        <!--
          bg-background and shadow-none, matching shadcn's own SidebarInput: the
          rail is slate-200, so a field a shade lighter reads as an inset well
          rather than a card lifted off the chrome, which is what the default
          shadow suggests.
        -->
        <SearchInput
          ref="searchRef"
          v-model="query"
          placeholder="Search settings…"
          input-class="bg-background shadow-none"
          @keydown.enter.prevent="onEnter"
        />
      </div>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem
            v-for="section in isSearching ? visibleSections : sections"
            :key="section.id"
          >
            <!--
              The heading highlights during a search as well as outside one: the
              arrow keys walk the filtered sections, and a selection you cannot
              see is a selection you cannot use.
            -->
            <SidebarMenuButton
              as-child
              :is-active="activeSectionId === section.id"
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
