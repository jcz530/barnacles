<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ProjectIcon from '../components/atoms/ProjectIcon.vue';
import OpenInIDEButton from '../components/molecules/OpenInIDEButton.vue';
import OpenTerminalButton from '../components/molecules/OpenTerminalButton.vue';
import ProjectActionsDropdown from '../components/molecules/ProjectActionsDropdown.vue';
import ProjectOverviewTab from '../components/organisms/ProjectOverviewTab.vue';
import ProjectReadmeTab from '../components/organisms/ProjectReadmeTab.vue';
import ProjectTerminalsTab from '../components/organisms/ProjectTerminalsTab.vue';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useBreadcrumbs } from '../composables/useBreadcrumbs';
import { useQueries } from '../composables/useQueries';

const route = useRoute();
const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
const {
  useProjectQuery,
  useDetectedIDEsQuery,
  useDetectedTerminalsQuery,
  useProjectPackageScriptsQuery,
} = useQueries();

const projectId = computed(() => route.params.id as string);

const { data: project, isLoading } = useProjectQuery(projectId);
const { data: detectedIDEs } = useDetectedIDEsQuery();
const { data: detectedTerminals } = useDetectedTerminalsQuery();
const { data: packageScripts } = useProjectPackageScriptsQuery(projectId);

onMounted(() => {
  setBreadcrumbs([
    { label: 'Projects', href: '/projects' },
    { label: project.value?.name || 'Loading...' },
  ]);
});

const handleBack = () => {
  router.push('/projects');
};
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="border-b bg-white p-6">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="sm" @click="handleBack">
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
        <div class="flex gap-2">
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
            :git-remote-url="project.stats?.gitRemoteUrl"
          />
        </div>
      </div>

      <div v-if="isLoading" class="space-y-2">
        <Skeleton class="h-8 w-64" />
        <Skeleton class="h-4 w-96" />
      </div>
      <div v-else-if="project" class="flex items-start gap-4">
        <ProjectIcon
          :project-id="project.id"
          :project-name="project.name"
          :has-icon="!!project.icon"
          size="lg"
        />
        <div class="flex-1">
          <h1 class="text-3xl font-bold text-slate-800">{{ project.name }}</h1>
          <p v-if="project.description" class="mt-1 text-slate-600">{{ project.description }}</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div v-if="isLoading" class="grid gap-6 md:grid-cols-2">
        <Skeleton v-for="i in 4" :key="i" class="h-48 w-full" />
      </div>

      <div v-else-if="project">
        <Tabs default-value="overview" class="w-full">
          <TabsList class="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="readme">README.md</TabsTrigger>
            <TabsTrigger value="terminals">Terminals</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ProjectOverviewTab :project="project" />
          </TabsContent>

          <TabsContent value="readme">
            <ProjectReadmeTab :project-id="project.id" />
          </TabsContent>

          <TabsContent value="terminals">
            <ProjectTerminalsTab
              :project-id="project.id"
              :project-path="project.path"
              :package-json-scripts="packageScripts"
            />
          </TabsContent>
        </Tabs>
      </div>

      <div v-else class="py-12 text-center">
        <p class="text-slate-600">Project not found</p>
      </div>
    </div>
  </div>
</template>
