<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { SETTING_KEYS, type SettingKey } from '../../shared/types/api';
import SettingWrapper from '../components/settings/molecules/SettingWrapper.vue';
import SettingsSection from '../components/settings/molecules/SettingsSection.vue';
import { SETTINGS_SECTIONS } from '@/constants/settings';
import { useSettingsSearch } from '@/composables/useSettingsSearch';
import { useScrollSpy } from '@/composables/useScrollSpy';
import { useSettingsNav } from '@/composables/useSettingsNav';
import { useSettingsEscape } from '@/composables/useSettingsEscape';
import ScanMaxDepthSetting from '../components/settings/organisms/ScanMaxDepthSetting.vue';
import ScanIncludedDirectoriesSetting from '../components/settings/organisms/ScanIncludedDirectoriesSetting.vue';
import ScanExcludedDirectoriesSetting from '../components/settings/organisms/ScanExcludedDirectoriesSetting.vue';
import DefaultIDESetting from '../components/settings/organisms/DefaultIDESetting.vue';
import DefaultTerminalSetting from '../components/settings/organisms/DefaultTerminalSetting.vue';
import AutoUpdateSetting from '@/components/settings/organisms/AutoUpdateSetting.vue';
import ShowTrayIconSetting from '../components/settings/organisms/ShowTrayIconSetting.vue';
import CommandPaletteShortcutSetting from '../components/settings/organisms/CommandPaletteShortcutSetting.vue';
import ShowDashboardStatsSetting from '../components/settings/organisms/ShowDashboardStatsSetting.vue';
import ReducedMotionSetting from '../components/settings/organisms/ReducedMotionSetting.vue';
import InstallCliCommandSetting from '../components/settings/organisms/InstallCliCommandSetting.vue';
import McpServerSetting from '../components/settings/organisms/McpServerSetting.vue';
import McpUsageLoggingSetting from '../components/settings/organisms/McpUsageLoggingSetting.vue';
import ThemesSetting from '../components/settings/organisms/ThemesSetting.vue';
import GitEmailsSetting from '../components/settings/organisms/GitEmailsSetting.vue';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'Settings' }]);
const route = useRoute();
const highlightedSetting = ref<SettingKey | null>(null);

/*
 * Setting key -> component. Kept here rather than in the registry so that
 * `constants/settings.ts` stays plain serializable data: the sidebar and the
 * search index both import it, and neither should drag fourteen setting
 * components into its bundle just to read a label.
 */
const SETTING_COMPONENTS: Record<string, Component> = {
  [SETTING_KEYS.SCAN_INCLUDED_DIRECTORIES]: ScanIncludedDirectoriesSetting,
  [SETTING_KEYS.SCAN_MAX_DEPTH]: ScanMaxDepthSetting,
  [SETTING_KEYS.SCAN_EXCLUDED_DIRECTORIES]: ScanExcludedDirectoriesSetting,
  [SETTING_KEYS.DEFAULT_IDE]: DefaultIDESetting,
  [SETTING_KEYS.DEFAULT_TERMINAL]: DefaultTerminalSetting,
  [SETTING_KEYS.THEMES]: ThemesSetting,
  [SETTING_KEYS.SHOW_DASHBOARD_STATS]: ShowDashboardStatsSetting,
  [SETTING_KEYS.REDUCED_MOTION]: ReducedMotionSetting,
  [SETTING_KEYS.SHOW_TRAY_ICON]: ShowTrayIconSetting,
  [SETTING_KEYS.AUTO_UPDATE]: AutoUpdateSetting,
  [SETTING_KEYS.COMMAND_PALETTE_SHORTCUT]: CommandPaletteShortcutSetting,
  [SETTING_KEYS.GIT_EMAILS]: GitEmailsSetting,
  [SETTING_KEYS.INSTALL_CLI_COMMAND]: InstallCliCommandSetting,
  [SETTING_KEYS.MCP_SERVER]: McpServerSetting,
  [SETTING_KEYS.MCP_USAGE_LOGGING]: McpUsageLoggingSetting,
};

const { isSearching, visibleSections, hasResults, query, clear } = useSettingsSearch();

// Escape leaves settings from anywhere on the page, not just from the rail.
useSettingsEscape();
const sectionsToRender = computed(() =>
  isSearching.value ? visibleSections.value : SETTINGS_SECTIONS
);

/*
 * The document scrolls here, not an inner pane: `SidebarInset` and its <main>
 * are both `overflow: visible` and size to their content, so the viewport is
 * what moves. The observer therefore uses its default root (the viewport) --
 * rooting it at <main> would watch an element that never scrolls, and the
 * active heading would never change.
 */
const { activeId, observe, observeEnd, setActive, reset } = useScrollSpy({
  sectionIds: () => sectionsToRender.value.map(section => section.id),
});

/** Marks the end of the content, so the last section can win at the bottom. */
const endSentinel = ref<HTMLElement | null>(null);

/*
 * Re-attach the scroll-spy to whatever sections are currently rendered.
 *
 * Driven by the rendered list rather than by each section's mount hook: a
 * section that survives a search is patched in place, never remounted, so a
 * mount-time registration left those sections -- the ones the search kept --
 * with no observer at all and scroll-spy silently half-dead.
 *
 * Post-flush so the DOM matches `sectionsToRender` before the elements are
 * looked up.
 */
function attachScrollSpy() {
  reset();
  for (const section of sectionsToRender.value) {
    // The marker inside the section, not the section box -- see useScrollSpy.
    const el = document.querySelector(`[data-section-marker="${section.id}"]`);
    if (el) observe(el, section.id);
  }

  if (endSentinel.value) observeEnd(endSentinel.value);
}

// `immediate` would run during setup, before there is any DOM to look up.
onMounted(attachScrollSpy);
watch(sectionsToRender, attachScrollSpy, { flush: 'post' });

function scrollToSetting(settingKey: SettingKey) {
  const element = document.querySelector(`[data-setting="${settingKey}"]`);

  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightedSetting.value = settingKey;
    // Remove highlight after animation
    setTimeout(() => {
      highlightedSetting.value = null;
    }, 5000);
  }
}

function scrollToSection(sectionId: string, settingKey?: string) {
  setActive(sectionId);

  if (settingKey) {
    scrollToSetting(settingKey as SettingKey);
    return;
  }

  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// The sidebar lives outside this view, so its clicks arrive through here, and
// the section the scroll-spy lands on travels back out the same way.
const { onNavigate, activeSectionId } = useSettingsNav();
onNavigate(scrollToSection);
watch(activeId, id => (activeSectionId.value = id), { immediate: true });

onMounted(async () => {
  const settingParam = route.query.setting as string | undefined;
  if (settingParam) {
    // Validate that the setting key exists
    const isValidSetting = Object.values(SETTING_KEYS).includes(settingParam as SettingKey);

    if (isValidSetting) {
      await nextTick();

      // Add a small delay to ensure DOM is fully rendered
      setTimeout(() => scrollToSetting(settingParam as SettingKey), 100);
    }
  }
});

/*
 * The query outlives this component -- it is module-level so the sidebar and
 * the page can share it -- so leaving settings with a filter on would bring it
 * back on the next visit, showing a page missing most of its sections for no
 * visible reason.
 */
onUnmounted(clear);
</script>

<template>
  <div>
    <!--
      max-w-5xl rather than a narrower prose measure: these rows put their
      control at the right edge, so capping the column tighter only pushes the
      label and its switch further apart on a wide window. Below roughly 1100px
      the pane is narrower than this cap anyway, so small windows keep the
      layout they already had.
    -->
    <section class="mx-auto mt-4 w-full max-w-5xl">
      <div class="mb-8">
        <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
        <p class="text-muted-foreground mt-1 text-sm">Manage your application preferences</p>
      </div>

      <div class="space-y-10">
        <SettingsSection
          v-for="section in sectionsToRender"
          :key="section.id"
          :id="section.id"
          :title="section.title"
          :description="section.description"
        >
          <div v-for="setting in section.settings" :key="setting.key" class="py-5 first:pt-4">
            <SettingWrapper :setting-key="setting.key" :highlighted="highlightedSetting">
              <component
                :is="SETTING_COMPONENTS[setting.key]"
                v-if="SETTING_COMPONENTS[setting.key]"
                @jump-to-setting="scrollToSetting"
              />
            </SettingWrapper>
          </div>
        </SettingsSection>
      </div>

      <!--
        End-of-content sentinel. A section shorter than the gap below the
        trigger line can never reach it, so the scroll-spy treats the last
        section as active once this comes into view.
      -->
      <div ref="endSentinel" class="h-px" aria-hidden="true"></div>

      <div v-if="isSearching && !hasResults" class="py-16 text-center">
        <p class="text-muted-foreground text-sm">No settings match “{{ query }}”.</p>
        <button class="text-primary mt-2 text-sm hover:underline" @click="clear">
          Clear search
        </button>
      </div>
    </section>
  </div>
</template>
