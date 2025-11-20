<script setup lang="ts">
import { computed, type ComputedRef, inject, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQueries } from '@/composables/useQueries';
import { useViewMode } from '@/composables/useViewMode';
import { Button } from '../../ui/button';
import { Plus, User } from 'lucide-vue-next';
import ViewToggle from '../../atoms/ViewToggle.vue';
import AccountsTable from './AccountsTable.vue';
import AccountsCardView from './AccountsCardView.vue';
import { RouteNames } from '@/router';
import SearchInput from '@/components/molecules/SearchInput.vue';

// Inject project data from parent
const projectId = inject<ComputedRef<string>>('projectId');

if (!projectId) {
  throw new Error('ProjectAccountsTab must be used within a project detail page');
}

const router = useRouter();
const { useAccountsQuery } = useQueries();

// Fetch accounts (pass the ref itself, not .value, as the query expects MaybeRef)
const { data: accounts, isLoading } = useAccountsQuery(projectId, { enabled: true });

// View state (persisted to localStorage)
const viewMode = useViewMode('accounts-view-mode', 'table');

// Search state
const searchQuery = ref('');

// Filtered accounts
const filteredAccounts = computed(() => {
  if (!accounts.value) return [];
  if (!searchQuery.value) return accounts.value;

  const query = searchQuery.value.toLowerCase();
  return accounts.value.filter(account => {
    return (
      account.name?.toLowerCase().includes(query) ||
      account.username?.toLowerCase().includes(query) ||
      account.email?.toLowerCase().includes(query) ||
      account.loginUrl?.toLowerCase().includes(query)
    );
  });
});

const handleAddAccount = () => {
  router.push({
    name: RouteNames.ProjectAccountNew,
    params: { id: projectId.value },
  });
};

const handleEditAccount = (accountId: number) => {
  router.push({
    name: RouteNames.ProjectAccountEdit,
    params: { id: projectId.value, accountId: String(accountId) },
  });
};
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Empty state -->
    <div
      v-if="!isLoading && (!accounts || accounts.length === 0)"
      class="flex flex-1 flex-col items-center justify-center p-8 text-center"
    >
      <div class="rounded-full bg-slate-100 p-4">
        <User :size="48" class="text-slate-400" />
      </div>
      <h3 class="mt-4 text-lg font-semibold text-slate-900">No accounts yet</h3>
      <p class="mt-2 max-w-sm text-sm text-slate-600">
        It's easy to forget your local dev logins.<br />
        Store your dev credentials here for quick access later.
      </p>
      <Button class="mt-6" @click="handleAddAccount">
        <Plus :size="16" class="mr-2" />
        Add Account
      </Button>
    </div>

    <!-- Accounts list -->
    <div v-else class="flex h-full flex-col">
      <!-- Header with controls -->
      <div class="border-b border-slate-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Accounts</h2>
            <p class="text-sm text-slate-600">
              {{ filteredAccounts.length }} account{{ filteredAccounts.length === 1 ? '' : 's' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <!-- Search -->
            <SearchInput v-model="searchQuery" placeholder="Search accounts..." />

            <!-- View toggle -->
            <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />

            <Button @click="handleAddAccount">
              <Plus :size="16" class="mr-2" />
              Add Account
            </Button>
          </div>
        </div>
      </div>

      <!-- Content area -->
      <div class="flex-1 overflow-auto p-6">
        <AccountsTable
          v-if="viewMode === 'table'"
          :accounts="filteredAccounts"
          :project-id="projectId"
          @edit="handleEditAccount"
        />
        <AccountsCardView
          v-else
          :accounts="filteredAccounts"
          :project-id="projectId"
          @edit="handleEditAccount"
        />
      </div>
    </div>
  </div>
</template>
