<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { onMounted, ref } from 'vue';
import ViewToggle from '../components/atoms/ViewToggle.vue';
import UsersTable from '../components/organisms/UsersTable.vue';
import { useQueries } from '../composables/useQueries';

const { setBreadcrumbs } = useBreadcrumbs();

onMounted(() => {
  setBreadcrumbs([{ label: 'Users' }]);
});
const { useUsersQuery } = useQueries();
const viewMode = ref<'table' | 'card'>('table');

const usersQuery = useUsersQuery({ enabled: true });
</script>
<template>
  <div>
    <section class="mt-8">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-2xl">Users</h2>
        <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />
      </div>
      <UsersTable
        :users="usersQuery.data.value || []"
        :is-loading="usersQuery.isFetching.value"
        :view-mode="viewMode"
      />
    </section>
  </div>
</template>

<style scoped></style>
