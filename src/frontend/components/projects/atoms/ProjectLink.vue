<script setup lang="ts">
import { RouterLink } from 'vue-router';
import ProjectIcon from './ProjectIcon.vue';
import { RouteNames } from '@/router';

/**
 * A project rendered as a link to its detail page.
 *
 * Takes the resolved project rather than an id so the caller owns the lookup —
 * callers already hold a map of projects, and fetching per instance would issue
 * one request per table row.
 *
 * `project` is optional on purpose: the common caller resolves an id or a path
 * that may no longer match anything (a deleted project, a path outside every
 * known project). That case renders the fallback rather than a dead link.
 */
const props = withDefaults(
  defineProps<{
    project?: { id: string; name: string; icon?: string | null } | null;
    /** Shown when there is no project to link to. */
    fallback?: string | null;
    /** Tooltip for the fallback, when it is an abbreviation of something longer. */
    fallbackTitle?: string | null;
    showIcon?: boolean;
  }>(),
  { project: null, fallback: null, fallbackTitle: null, showIcon: true }
);
</script>

<template>
  <!-- @click.stop: DataTable rows emit `open` on click, so a bare link inside a
       row would both navigate and trigger the row's own handler. -->
  <RouterLink
    v-if="props.project"
    :to="{ name: RouteNames.ProjectOverview, params: { id: props.project.id } }"
    class="inline-flex items-center gap-1.5 text-slate-700 hover:underline"
    @click.stop
  >
    <ProjectIcon
      v-if="props.showIcon"
      :project-id="props.project.id"
      :project-name="props.project.name"
      :has-icon="!!props.project.icon"
      size="sm"
    />
    <span class="truncate text-sm font-medium">{{ props.project.name }}</span>
  </RouterLink>

  <!-- Deliberately unlike a project name: an untracked directory that happens to
       share a project's name would otherwise be indistinguishable at a glance. -->
  <span
    v-else-if="props.fallback"
    class="truncate font-mono text-xs text-slate-400"
    :title="props.fallbackTitle ?? props.fallback"
  >
    {{ props.fallback }}
  </span>

  <span v-else class="text-sm text-slate-400">—</span>
</template>
