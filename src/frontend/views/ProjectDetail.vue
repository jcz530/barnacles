<script setup lang="ts">
import { computed, onMounted, provide, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ProcessIndicator from '../components/atoms/ProcessIndicator.vue';
import ProjectIcon from '../components/projects/atoms/ProjectIcon.vue';
import OpenInIDEButton from '../components/projects/molecules/OpenInIDEButton.vue';
import OpenTerminalButton from '../components/projects/molecules/OpenTerminalButton.vue';
import ProjectActionsDropdown from '../components/projects/molecules/ProjectActionsDropdown.vue';
import StartProcessButton from '../components/projects/molecules/StartProcessButton.vue';
import { Skeleton } from '../components/ui/skeleton';
import { useBreadcrumbs } from '../composables/useBreadcrumbs';
import { useQueries } from '../composables/useQueries';
import { useRunningProcesses } from '../composables/useRunningProcesses';

const route = useRoute();
const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
const {
  useProjectQuery,
  useDetectedIDEsQuery,
  useDetectedTerminalsQuery,
  useProjectPackageScriptsQuery,
  useProjectComposerScriptsQuery,
  useProcessStatusQuery,
} = useQueries();

const projectId = computed(() => route.params.id as string);

const { data: project, isLoading } = useProjectQuery(projectId);
const { data: detectedIDEs } = useDetectedIDEsQuery();
const { data: detectedTerminals } = useDetectedTerminalsQuery();
const { data: packageScripts } = useProjectPackageScriptsQuery(projectId);
const { data: composerScripts } = useProjectComposerScriptsQuery(projectId);

// Get all process statuses (no project filter)
const { data: allProcessStatuses } = useProcessStatusQuery(undefined, {
  enabled: true,
  refetchInterval: 2000,
});

// Provide data to child routes
provide('project', project);
provide('projectId', projectId);
provide(
  'projectPath',
  computed(() => project.value?.path)
);
provide('packageScripts', packageScripts);
provide('composerScripts', composerScripts);
provide('isLoading', isLoading);

// Set breadcrumbs with reactive project name
const breadcrumbs = computed(() => [
  { label: 'Projects', href: '/projects' },
  { label: project.value?.name || 'Loading...', href: `/projects/${projectId.value}` },
]);

onMounted(() => {
  setBreadcrumbs(breadcrumbs);
});

// Update window title when project data loads
watch(
  () => project.value?.name,
  projectName => {
    if (projectName) {
      document.title = projectName;
      if (window.electron?.updateWindowTitle) {
        window.electron.updateWindowTitle(projectName);
      }
    }
  },
  { immediate: true }
);

// Get running processes for this project
const runningProcesses = useRunningProcesses(projectId, allProcessStatuses);

const handleBack = () => {
  router.push('/projects');
};

const navigateToProcess = () => {
  // Switch to the terminals tab
  router.push({ name: 'ProjectTerminals', params: { id: projectId.value } });
};

// Tab configuration
const tabs = [
  { name: 'ProjectOverview', label: 'Overview', value: 'overview' },
  { name: 'ProjectReadme', label: 'README.md', value: 'readme' },
  { name: 'ProjectFiles', label: 'Files', value: 'files' },
  { name: 'ProjectTerminals', label: 'Processes', value: 'terminals' },
];

// Computed property to determine active tab based on current route
const activeTab = computed(() => {
  const routeName = route.name as string;
  const tab = tabs.find(t => t.name === routeName);
  return tab?.value || 'overview';
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="py-4">
      <div class="mb-4 flex items-center justify-end">
        <!--        <div class="flex items-center gap-4">-->
        <!--          <Button variant="ghost" size="sm" @click="handleBack">-->
        <!--            <ArrowLeft class="mr-2 h-4 w-4" />-->
        <!--            Back to Projects-->
        <!--          </Button>-->
        <!--        </div>-->
        <div class="flex gap-2">
          <StartProcessButton
            v-if="project"
            :project-id="project.id"
            :process-statuses="allProcessStatuses"
            :is-loading="isLoading"
          />

          <OpenInIDEButton
            v-if="project"
            :project-id="project.id"
            :detected-i-d-es="detectedIDEs"
            :preferred-ide-id="project.preferredIde"
            :is-loading="isLoading"
          />

          <OpenTerminalButton
            v-if="project"
            :project-id="project.id"
            :detected-terminals="detectedTerminals"
            :preferred-terminal-id="project.preferredTerminal"
            :is-loading="isLoading"
          />

          <ProjectActionsDropdown
            v-if="project"
            :project-id="project.id"
            :project-path="project.path"
            :project-name="project.name"
            :is-archived="!!project.archivedAt"
            :is-favorite="project.isFavorite"
            :git-remote-url="project.stats?.gitRemoteUrl"
            :third-party-size="project.stats?.thirdPartySize"
            :preferred-ide-id="project.preferredIde"
            :preferred-terminal-id="project.preferredTerminal"
            :process-statuses="allProcessStatuses"
          />
        </div>
      </div>

      <div v-if="isLoading" class="space-y-2">
        <Skeleton class="h-8 w-64" />
        <Skeleton class="h-4 w-96" />
      </div>
      <div v-else-if="project" class="ml-6 flex items-start gap-4">
        <ProjectIcon
          :project-id="project.id"
          :project-name="project.name"
          :has-icon="!!project.icon"
          size="lg"
        />
        <div class="flex-1">
          <div class="flex items-center gap-3">
            <h1 class="text-3xl font-bold text-slate-800">{{ project.name }}</h1>
          </div>
          <p v-if="project.description" class="mt-1 text-slate-600">{{ project.description }}</p>
          <ProcessIndicator
            v-if="runningProcesses.length > 0"
            :process="runningProcesses[0]"
            :on-navigate-to-process="navigateToProcess"
            class="mt-2"
          />
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <div v-if="isLoading" class="grid gap-6 md:grid-cols-2">
        <Skeleton v-for="i in 4" :key="i" class="h-48 w-full" />
      </div>

      <div v-else-if="project" class="w-full">
        <!-- Tab Navigation -->
        <div
          class="mb-6 inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500"
        >
          <router-link
            v-for="tab in tabs"
            :key="tab.value"
            :to="{ name: tab.name, params: { id: projectId } }"
            class="inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap ring-offset-white transition-all focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            :class="activeTab === tab.value ? 'text-slate-950 shadow' : 'hover:bg-slate-200/50'"
          >
            {{ tab.label }}
          </router-link>
        </div>

        <!-- Tab Content via Router View -->
        <router-view />
      </div>

      <div v-else class="py-12 text-center">
        <p class="text-slate-600">Project not found</p>
      </div>
    </div>
  </div>
</template>
