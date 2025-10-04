<script setup lang="ts">
import {
  ArrowLeft,
  Calendar,
  Clock,
  Code,
  FileText,
  Folder,
  FolderTree,
  GitBranch,
  HardDrive,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next';
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import OpenInIDEButton from '../components/molecules/OpenInIDEButton.vue';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { useBreadcrumbs } from '../composables/useBreadcrumbs';
import { useFormatters } from '../composables/useFormatters';
import { useQueries } from '../composables/useQueries';

const route = useRoute();
const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
const { formatSize, formatDate, formatRelativeDate } = useFormatters();
const {
  useProjectQuery,
  useDeleteProjectMutation,
  useRescanProjectMutation,
  useDetectedIDEsQuery,
} = useQueries();

const projectId = computed(() => route.params.id as string);

const { data: project, isLoading } = useProjectQuery(projectId);
const { data: detectedIDEs } = useDetectedIDEsQuery();
const deleteMutation = useDeleteProjectMutation();
const rescanMutation = useRescanProjectMutation();

onMounted(() => {
  setBreadcrumbs([
    { label: 'Projects', href: '/projects' },
    { label: project.value?.name || 'Loading...' },
  ]);
});

const handleBack = () => {
  router.push('/projects');
};

const handleDelete = async () => {
  if (!project.value) return;

  if (confirm(`Are you sure you want to delete "${project.value.name}"?`)) {
    try {
      await deleteMutation.mutateAsync(project.value.id);
      router.push('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    }
  }
};

const handleRescan = async () => {
  if (!project.value) return;

  try {
    await rescanMutation.mutateAsync(project.value.id);
  } catch (error) {
    console.error('Failed to rescan project:', error);
    alert('Failed to rescan project. Please try again.');
  }
};

const languageStats = computed(() => {
  if (!project.value?.stats?.languageStats) return null;
  try {
    return JSON.parse(project.value.stats.languageStats);
  } catch {
    return null;
  }
});
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

          <Button
            variant="outline"
            size="sm"
            @click="handleRescan"
            :disabled="isLoading || rescanMutation.isPending.value"
          >
            <RefreshCw
              class="mr-2 h-4 w-4"
              :class="{ 'animate-spin': rescanMutation.isPending.value }"
            />
            {{ rescanMutation.isPending.value ? 'Rescanning...' : 'Rescan Project' }}
          </Button>
          <Button variant="destructive" size="sm" @click="handleDelete" :disabled="isLoading">
            <Trash2 class="mr-2 h-4 w-4" />
            Delete Project
          </Button>
        </div>
      </div>

      <div v-if="isLoading" class="space-y-2">
        <Skeleton class="h-8 w-64" />
        <Skeleton class="h-4 w-96" />
      </div>
      <div v-else-if="project">
        <h1 class="text-3xl font-bold text-slate-800">{{ project.name }}</h1>
        <p v-if="project.description" class="mt-1 text-slate-600">{{ project.description }}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto bg-slate-50 p-6">
      <div v-if="isLoading" class="grid gap-6 md:grid-cols-2">
        <Skeleton v-for="i in 4" :key="i" class="h-48 w-full" />
      </div>

      <div v-else-if="project" class="grid gap-6 md:grid-cols-2">
        <!-- Basic Info -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Folder class="h-5 w-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div>
              <div class="text-sm font-medium text-slate-500">Path</div>
              <div class="mt-1 font-mono text-sm text-slate-900">{{ project.path }}</div>
            </div>
            <div>
              <div class="text-sm font-medium text-slate-500">Status</div>
              <div class="mt-1">
                <span
                  class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-700': project.status === 'active',
                    'bg-slate-100 text-slate-700': project.status === 'archived',
                  }"
                >
                  {{ project.status }}
                </span>
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-slate-500">Created</div>
              <div class="mt-1 text-sm text-slate-900">
                {{ formatDate(project.createdAt) }}
              </div>
            </div>
            <div>
              <div class="text-sm font-medium text-slate-500">Last Updated</div>
              <div class="mt-1 text-sm text-slate-900">
                {{ formatDate(project.updatedAt) }}
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Technologies -->
        <Card>
          <CardHeader>
            <CardTitle>Technologies</CardTitle>
            <CardDescription>Detected frameworks and tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="project.technologies.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="tech in project.technologies"
                :key="tech.id"
                class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
                :style="{
                  borderColor: tech.color || '#cbd5e1',
                  color: tech.color || '#475569',
                  backgroundColor: tech.color ? `${tech.color}15` : '#f1f5f9',
                }"
              >
                <div
                  v-if="tech.color"
                  class="h-2.5 w-2.5 rounded-full"
                  :style="{ backgroundColor: tech.color }"
                />
                {{ tech.name }}
              </span>
            </div>
            <div v-else class="text-sm text-slate-500">No technologies detected</div>
          </CardContent>
        </Card>

        <!-- Language Breakdown -->
        <Card v-if="languageStats">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Code class="h-5 w-5" />
              Language Breakdown
            </CardTitle>
            <CardDescription>Code composition by language</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              <div v-for="(stats, techSlug) in languageStats" :key="techSlug" class="space-y-1.5">
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <div
                      class="h-3 w-3 rounded-full"
                      :style="{
                        backgroundColor:
                          project.technologies.find((t: any) => t.slug === techSlug)?.color ||
                          '#94a3b8',
                      }"
                    />
                    <span class="font-medium text-slate-700">
                      {{
                        project.technologies.find((t: any) => t.slug === techSlug)?.name ||
                        techSlug.charAt(0).toUpperCase() + techSlug.slice(1)
                      }}
                    </span>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-slate-500">
                      {{ stats.fileCount }} {{ stats.fileCount === 1 ? 'file' : 'files' }}
                    </span>
                    <span class="font-semibold text-slate-900">{{ stats.percentage }}%</span>
                  </div>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full rounded-full transition-all"
                    :style="{
                      width: `${stats.percentage}%`,
                      backgroundColor:
                        project.technologies.find((t: any) => t.slug === techSlug)?.color ||
                        '#94a3b8',
                    }"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- File Statistics -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <FileText class="h-5 w-5" />
              File Statistics
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <FileText class="h-4 w-4" />
                <span>Total Files</span>
              </div>
              <div class="text-lg font-semibold text-slate-900">
                {{ project.stats?.fileCount?.toLocaleString() || 0 }}
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <FolderTree class="h-4 w-4" />
                <span>Directories</span>
              </div>
              <div class="text-lg font-semibold text-slate-900">
                {{ project.stats?.directoryCount?.toLocaleString() || 0 }}
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <HardDrive class="h-4 w-4" />
                <span>Project Size</span>
              </div>
              <div class="text-lg font-semibold text-slate-900">
                {{ formatSize(project.size) }}
              </div>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm text-slate-600">
                <Calendar class="h-4 w-4" />
                <span>Last Modified</span>
              </div>
              <div class="text-sm text-slate-900">
                {{ formatRelativeDate(project.lastModified) }}
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Git Information -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <GitBranch class="h-5 w-5" />
              Git Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="project.stats?.gitBranch" class="space-y-4">
              <div>
                <div class="text-sm font-medium text-slate-500">Current Branch</div>
                <div class="mt-1 font-mono text-sm text-slate-900">
                  {{ project.stats.gitBranch }}
                </div>
              </div>
              <div v-if="project.stats.lastCommitMessage">
                <div class="text-sm font-medium text-slate-500">Last Commit</div>
                <div class="mt-1 text-sm text-slate-900">
                  {{ project.stats.lastCommitMessage }}
                </div>
                <div
                  v-if="project.stats.lastCommitDate"
                  class="mt-1 flex items-center gap-1.5 text-xs text-slate-500"
                >
                  <Clock class="h-3.5 w-3.5" />
                  {{ formatDate(project.stats.lastCommitDate) }}
                </div>
              </div>
              <div v-if="project.stats.hasUncommittedChanges">
                <span
                  class="inline-flex items-center gap-1.5 rounded-md bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700"
                >
                  <span class="h-2 w-2 rounded-full bg-orange-500"></span>
                  Uncommitted Changes
                </span>
              </div>
              <div v-else>
                <span
                  class="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700"
                >
                  <span class="h-2 w-2 rounded-full bg-green-500"></span>
                  Clean Working Tree
                </span>
              </div>
            </div>
            <div v-else class="text-sm text-slate-500">No git repository detected</div>
          </CardContent>
        </Card>
      </div>

      <div v-else class="py-12 text-center">
        <p class="text-slate-600">Project not found</p>
      </div>
    </div>
  </div>
</template>
