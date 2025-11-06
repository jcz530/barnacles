<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { onMounted } from 'vue';
import Card from '../components/ui/card/Card.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import ScanMaxDepthSetting from '../components/settings/organisms/ScanMaxDepthSetting.vue';
import ScanIncludedDirectoriesSetting from '../components/settings/organisms/ScanIncludedDirectoriesSetting.vue';
import ScanExcludedDirectoriesSetting from '../components/settings/organisms/ScanExcludedDirectoriesSetting.vue';
import DefaultIDESetting from '../components/settings/organisms/DefaultIDESetting.vue';
import DefaultTerminalSetting from '../components/settings/organisms/DefaultTerminalSetting.vue';
import ShowTrayIconSetting from '../components/settings/organisms/ShowTrayIconSetting.vue';
import InstallCliCommandSetting from '../components/settings/organisms/InstallCliCommandSetting.vue';
import ThemesSetting from '../components/settings/organisms/ThemesSetting.vue';

const { setBreadcrumbs } = useBreadcrumbs();

onMounted(() => {
  setBreadcrumbs([{ label: 'Settings' }]);
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
              <ScanIncludedDirectoriesSetting />
              <ScanMaxDepthSetting />
              <ScanExcludedDirectoriesSetting />
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
              <DefaultIDESetting />
              <DefaultTerminalSetting />
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
              <ThemesSetting />
              <ShowTrayIconSetting />
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
              <InstallCliCommandSetting />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>

<style scoped></style>
