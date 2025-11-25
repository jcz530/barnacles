<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { SETTING_KEYS, type SettingKey } from '../../shared/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import SettingWrapper from '../components/settings/molecules/SettingWrapper.vue';
import ScanMaxDepthSetting from '../components/settings/organisms/ScanMaxDepthSetting.vue';
import ScanIncludedDirectoriesSetting from '../components/settings/organisms/ScanIncludedDirectoriesSetting.vue';
import ScanExcludedDirectoriesSetting from '../components/settings/organisms/ScanExcludedDirectoriesSetting.vue';
import DefaultIDESetting from '../components/settings/organisms/DefaultIDESetting.vue';
import DefaultTerminalSetting from '../components/settings/organisms/DefaultTerminalSetting.vue';
import ShowTrayIconSetting from '../components/settings/organisms/ShowTrayIconSetting.vue';
import ShowDashboardStatsSetting from '../components/settings/organisms/ShowDashboardStatsSetting.vue';
import InstallCliCommandSetting from '../components/settings/organisms/InstallCliCommandSetting.vue';
import ThemesSetting from '../components/settings/organisms/ThemesSetting.vue';

const { setBreadcrumbs } = useBreadcrumbs();
const route = useRoute();
const highlightedSetting = ref<SettingKey | null>(null);

onMounted(async () => {
  setBreadcrumbs([{ label: 'Settings' }]);

  const settingParam = route.query.setting as string | undefined;
  if (settingParam) {
    // Validate that the setting key exists
    const isValidSetting = Object.values(SETTING_KEYS).includes(settingParam as SettingKey);

    if (isValidSetting) {
      await nextTick();

      // Add a small delay to ensure DOM is fully rendered
      setTimeout(() => {
        const element = document.querySelector(`[data-setting="${settingParam}"]`);

        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightedSetting.value = settingParam as SettingKey;
          // Remove highlight after animation
          setTimeout(() => {
            highlightedSetting.value = null;
          }, 5000);
        }
      }, 100);
    }
  }
});
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">Settings</h2>
        <p class="text-muted-foreground mt-1">Manage your application preferences</p>
      </div>

      <div class="space-y-6">
        <!-- Project Scanning Settings -->
        <Card>
          <CardHeader>
            <CardTitle>Project Scanning</CardTitle>
            <CardDescription>Configure how projects are discovered and scanned</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-6">
              <SettingWrapper
                :setting-key="SETTING_KEYS.SCAN_INCLUDED_DIRECTORIES"
                :highlighted="highlightedSetting"
              >
                <ScanIncludedDirectoriesSetting />
              </SettingWrapper>
              <SettingWrapper
                :setting-key="SETTING_KEYS.SCAN_MAX_DEPTH"
                :highlighted="highlightedSetting"
              >
                <ScanMaxDepthSetting />
              </SettingWrapper>
              <SettingWrapper
                :setting-key="SETTING_KEYS.SCAN_EXCLUDED_DIRECTORIES"
                :highlighted="highlightedSetting"
              >
                <ScanExcludedDirectoriesSetting />
              </SettingWrapper>
            </div>
          </CardContent>
        </Card>

        <!-- Default Applications -->
        <Card>
          <CardHeader>
            <CardTitle>Default Applications</CardTitle>
            <CardDescription
              >Set your preferred IDE and terminal for opening projects</CardDescription
            >
          </CardHeader>
          <CardContent>
            <div class="space-y-6">
              <SettingWrapper
                :setting-key="SETTING_KEYS.DEFAULT_IDE"
                :highlighted="highlightedSetting"
              >
                <DefaultIDESetting />
              </SettingWrapper>
              <SettingWrapper
                :setting-key="SETTING_KEYS.DEFAULT_TERMINAL"
                :highlighted="highlightedSetting"
              >
                <DefaultTerminalSetting />
              </SettingWrapper>
            </div>
          </CardContent>
        </Card>

        <!-- Appearance -->
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how Barnacles appears on your system</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-6">
              <SettingWrapper :setting-key="SETTING_KEYS.THEMES" :highlighted="highlightedSetting">
                <ThemesSetting />
              </SettingWrapper>
              <SettingWrapper
                :setting-key="SETTING_KEYS.SHOW_DASHBOARD_STATS"
                :highlighted="highlightedSetting"
              >
                <ShowDashboardStatsSetting />
              </SettingWrapper>
              <SettingWrapper
                :setting-key="SETTING_KEYS.SHOW_TRAY_ICON"
                :highlighted="highlightedSetting"
              >
                <ShowTrayIconSetting />
              </SettingWrapper>
            </div>
          </CardContent>
        </Card>

        <!-- Developer Tools -->
        <Card>
          <CardHeader>
            <CardTitle>Developer Tools</CardTitle>
            <CardDescription>Configure command-line tools and integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-6">
              <SettingWrapper
                :setting-key="SETTING_KEYS.INSTALL_CLI_COMMAND"
                :highlighted="highlightedSetting"
              >
                <InstallCliCommandSetting />
              </SettingWrapper>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>
