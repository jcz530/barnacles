<script setup lang="ts">
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/vue-table';
import { Calendar, GitBranch, HardDrive, Star } from 'lucide-vue-next';
import { ref } from 'vue';
import type { ProjectWithDetails } from '../../../shared/types/api';
import ProjectIcon from '../atoms/ProjectIcon.vue';
import ProjectActionsDropdown from '../molecules/ProjectActionsDropdown.vue';
import ProjectCard from '../molecules/ProjectCard.vue';
import TableHeader from '../molecules/TableHeader.vue';
import { Button } from '../ui/button';

const props = defineProps<{
  projects: ProjectWithDetails[];
  isLoading?: boolean;
  viewMode?: 'table' | 'card';
  sorting?: SortingState;
  processStatuses?: any;
}>();

const emit = defineEmits<{
  delete: [projectId: string];
  open: [project: ProjectWithDetails];
  'update:sorting': [sorting: SortingState];
  'toggle-favorite': [projectId: string];
}>();

const internalSorting = ref<SortingState>(props.sorting || []);

const columnHelper = createColumnHelper<ProjectWithDetails>();

const formatSize = (bytes: number | null | undefined): string => {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return 'Unknown';

  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return `${Math.floor(diffDays / 365)} years ago`;
};

const handleOpen = (project: ProjectWithDetails) => {
  emit('open', project);
};

const handleToggleFavorite = (project: ProjectWithDetails, e: Event) => {
  e.stopPropagation();
  emit('toggle-favorite', project.id);
};

const columns: ColumnDef<ProjectWithDetails, any>[] = [
  columnHelper.accessor('isFavorite', {
    header: '',
    enableSorting: false,
    cell: props => props.row.original,
  }),
  columnHelper.accessor('name', {
    header: 'Project',
    enableSorting: true,
    cell: props => {
      const project = props.row.original;
      return {
        name: project.name,
        description: project.description,
        path: project.path,
      };
    },
  }),
  columnHelper.accessor('technologies', {
    header: 'Technologies',
    enableSorting: false,
    cell: props => props.row.original.technologies,
  }),
  columnHelper.accessor('lastModified', {
    header: 'Last Modified',
    enableSorting: true,
    cell: props => props.row.original.lastModified,
  }),
  columnHelper.accessor('size', {
    header: 'Size',
    enableSorting: true,
    cell: props => props.row.original.size,
  }),
  columnHelper.accessor('stats', {
    header: 'Git',
    enableSorting: false,
    cell: props => props.row.original.stats,
  }),
  columnHelper.accessor('id', {
    header: 'Actions',
    enableSorting: false,
    cell: props => props.row.original,
  }),
];

const table = useVueTable({
  get data() {
    return props.projects;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  state: {
    get sorting() {
      return internalSorting.value;
    },
  },
  onSortingChange: updaterOrValue => {
    const newValue =
      typeof updaterOrValue === 'function' ? updaterOrValue(internalSorting.value) : updaterOrValue;
    internalSorting.value = newValue;
    emit('update:sorting', newValue);
  },
});
</script>

<template>
  <div class="w-full">
    <div v-if="isLoading" class="py-12 text-center">
      <p class="text-slate-500">Loading projects...</p>
    </div>
    <div v-else-if="projects.length === 0" class="py-12 text-center">
      <p class="text-slate-600">
        No projects found. Try scanning for projects or adjusting your filters.
      </p>
    </div>
    <div v-else>
      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ProjectCard
          v-for="project in projects"
          :key="project.id"
          :project="project"
          :process-statuses="processStatuses"
          @delete="emit('delete', $event)"
          @open="emit('open', $event)"
          @toggle-favorite="emit('toggle-favorite', $event)"
        />
      </div>
      <!-- Table View -->
      <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table class="w-full border-collapse">
          <TableHeader :header-groups="table.getHeaderGroups()" />
          <tbody>
            <tr
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              class="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50"
              @click="handleOpen(row.original)"
            >
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="px-4 py-3 text-sm"
                :class="{
                  'w-80 max-w-80': cell.column.id === 'name',
                  'w-12': cell.column.id === 'isFavorite',
                }"
              >
                <!-- Favorite Star -->
                <template v-if="cell.column.id === 'isFavorite'">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0"
                    :class="row.original.isFavorite ? 'text-yellow-500' : 'text-slate-300'"
                    @click="handleToggleFavorite(row.original, $event)"
                  >
                    <Star
                      class="h-4 w-4"
                      :fill="row.original.isFavorite ? 'currentColor' : 'none'"
                    />
                  </Button>
                </template>

                <!-- Project Name/Description/Path -->
                <template v-if="cell.column.id === 'name'">
                  <div class="flex items-start gap-2">
                    <ProjectIcon
                      :project-id="row.original.id"
                      :project-name="row.original.name"
                      :has-icon="!!row.original.icon"
                      size="sm"
                      class="mt-0.5"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="font-medium text-slate-900">
                        {{ row.original.name }}
                      </div>
                      <div v-if="row.original.description" class="truncate text-xs text-slate-500">
                        {{ row.original.description }}
                      </div>
                      <div
                        class="truncate font-mono text-xs text-slate-400"
                        :title="row.original.path"
                      >
                        ...{{ row.original.path.split('/').slice(-3).join('/') }}
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Technologies -->
                <template v-else-if="cell.column.id === 'technologies'">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="tech in row.original.technologies.slice(0, 3)"
                      :key="tech.id"
                      class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                      :style="{
                        borderColor: tech.color || '#cbd5e1',
                        color: tech.color || '#475569',
                        backgroundColor: tech.color ? `${tech.color}15` : '#f1f5f9',
                      }"
                    >
                      <div
                        v-if="tech.color"
                        class="h-2 w-2 rounded-full"
                        :style="{ backgroundColor: tech.color }"
                      />
                      {{ tech.name }}
                    </span>
                    <span
                      v-if="row.original.technologies.length > 3"
                      class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      +{{ row.original.technologies.length - 3 }}
                    </span>
                  </div>
                </template>

                <!-- Last Modified -->
                <template v-else-if="cell.column.id === 'lastModified'">
                  <div class="flex items-center gap-1.5 text-slate-600">
                    <Calendar class="h-3.5 w-3.5" />
                    <span>{{ formatDate(row.original.lastModified) }}</span>
                  </div>
                </template>

                <!-- Size -->
                <template v-else-if="cell.column.id === 'size'">
                  <div class="flex items-center gap-1.5 text-slate-600">
                    <HardDrive class="h-3.5 w-3.5" />
                    <span>{{ formatSize(row.original.size) }}</span>
                  </div>
                </template>

                <!-- Git Info -->
                <template v-else-if="cell.column.id === 'stats'">
                  <div v-if="row.original.stats?.gitBranch" class="space-y-1">
                    <div class="flex items-center gap-1.5 text-slate-600">
                      <GitBranch class="h-3.5 w-3.5" />
                      <span class="text-xs">{{ row.original.stats.gitBranch }}</span>
                    </div>
                    <span
                      v-if="row.original.stats.hasUncommittedChanges"
                      class="inline-flex rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700"
                    >
                      Uncommitted
                    </span>
                  </div>
                  <div v-else class="text-xs text-slate-400">No git</div>
                </template>

                <!-- Actions -->
                <template v-else-if="cell.column.id === 'id'">
                  <ProjectActionsDropdown
                    :project-id="row.original.id"
                    :project-path="row.original.path"
                    :project-name="row.original.name"
                    :is-archived="!!row.original.archivedAt"
                    :is-favorite="row.original.isFavorite"
                    :git-remote-url="row.original.stats?.gitRemoteUrl"
                    :third-party-size="row.original.stats?.thirdPartySize"
                    :preferred-ide-id="row.original.preferredIde"
                    :preferred-terminal-id="row.original.preferredTerminal"
                    :process-statuses="processStatuses"
                    @click.stop
                  />
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
