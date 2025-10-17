<script setup lang="ts">
import type { ComputedRef } from 'vue';
import { inject } from 'vue';
import type { ProjectWithDetails } from '../../../shared/types/api';
import FileStatisticsCard from './FileStatisticsCard.vue';
import GitInformationCard from './GitInformationCard.vue';
import LanguageBreakdownCard from './LanguageBreakdownCard.vue';
import ProjectInfoCard from './ProjectInfoCard.vue';
import TechnologiesCard from './TechnologiesCard.vue';

const project = inject<ComputedRef<ProjectWithDetails | undefined>>('project');
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2">
    <ProjectInfoCard :project="project" />
    <TechnologiesCard :technologies="project.technologies ?? []" />
    <LanguageBreakdownCard :project="project" />
    <FileStatisticsCard :project="project" />
    <GitInformationCard :project="project" />
  </div>
</template>
