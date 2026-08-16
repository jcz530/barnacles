<script setup lang="ts">
import { type ColumnDef, createColumnHelper, type SortingState } from '@tanstack/vue-table';
import { Eye, EyeOff, Pencil, Trash2, User } from 'lucide-vue-next';
import { ref } from 'vue';
import { toast } from 'vue-sonner';
import type { Account } from '../../../../shared/types/api';
import CopyButton from '@/components/atoms/CopyButton.vue';
import DataTable from '../../tables/DataTable.vue';
import { type DataTableFeatures } from '../../tables/features';
import type { BulkAction } from '../../tables/types/bulk';
import { Button } from '../../ui/button';
import { useQueries } from '@/composables/useQueries';

const props = defineProps<{
  accounts: Account[];
  projectId: string;
}>();

const emit = defineEmits<{
  edit: [accountId: number];
}>();

const { useDeleteAccountMutation } = useQueries();
const deleteMutation = useDeleteAccountMutation();

const sorting = ref<SortingState>([]);
const visiblePasswords = ref<Set<number>>(new Set());

const copyTimeoutMs = 30_000;

const columnHelper = createColumnHelper<DataTableFeatures, Account>();

const columns: ColumnDef<DataTableFeatures, Account, any>[] = [
  columnHelper.accessor('name', { header: 'Name', enableSorting: true }),
  columnHelper.accessor('username', { header: 'Username', enableSorting: true }),
  columnHelper.accessor('email', { header: 'Email', enableSorting: true }),
  columnHelper.accessor('password', { header: 'Password', enableSorting: false }),
  columnHelper.accessor('loginUrl', { header: 'Login URL', enableSorting: true }),
  columnHelper.accessor('id', { header: '', enableSorting: false }),
];

const columnClasses: Record<string, string> = {
  name: 'w-48',
  username: 'w-40',
  email: 'w-48',
  password: 'w-32',
  loginUrl: 'w-64',
  id: 'w-24',
};

const togglePasswordVisibility = (accountId: number, e: Event) => {
  e.stopPropagation();
  const newSet = new Set(visiblePasswords.value);
  if (newSet.has(accountId)) {
    newSet.delete(accountId);
  } else {
    newSet.add(accountId);
  }
  visiblePasswords.value = newSet;
};

const handleEdit = (account: Account, e: Event) => {
  e.stopPropagation();
  emit('edit', account.id);
};

const bulkActions: BulkAction[] = [
  {
    key: 'delete',
    label: 'Delete',
    variant: 'destructive',
    confirm: {
      title: 'Delete accounts?',
      description: count =>
        `This permanently deletes ${count} account${count === 1 ? '' : 's'}. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    },
    run: async ({ ids }) => {
      const failed: Array<{ id: string; reason: string }> = [];

      // Deleted one at a time: the accounts API exposes no batch endpoint, and
      // a partial failure should still report which rows survived.
      for (const id of ids) {
        try {
          await deleteMutation.mutateAsync({
            projectId: props.projectId,
            accountId: Number(id),
          });
        } catch (error) {
          failed.push({
            id,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const affected = ids.length - failed.length;
      return {
        affected,
        failed,
        message: failed.length
          ? `Deleted ${affected} of ${ids.length} accounts.`
          : `Deleted ${affected} account${affected === 1 ? '' : 's'}.`,
      };
    },
  },
];

const handleDelete = async (account: Account, e: Event) => {
  e.stopPropagation();
  if (!confirm(`Are you sure you want to delete the account "${account.name || 'Unnamed'}"?`)) {
    return;
  }
  try {
    await deleteMutation.mutateAsync({
      projectId: props.projectId,
      accountId: account.id,
    });
    toast.success('Account deleted successfully');
  } catch {
    toast.error('Failed to delete account');
  }
};
</script>

<template>
  <DataTable
    v-model:sorting="sorting"
    :data="accounts"
    :columns="columns"
    :column-classes="columnClasses"
    :get-row-id="account => String(account.id)"
    :bulk-actions="bulkActions"
  >
    <template #empty>No accounts found.</template>

    <template #cell-name="{ row }">
      <div class="flex items-center gap-2">
        <div class="bg-primary-500/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <User class="text-primary-600 h-4 w-4" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium text-slate-900">{{ row.name || 'Unnamed Account' }}</div>
          <div v-if="row.notes" class="truncate text-xs text-slate-500">{{ row.notes }}</div>
        </div>
      </div>
    </template>

    <template #cell-username="{ row }">
      <div v-if="row.username" class="flex items-center gap-2">
        <span class="flex-1 truncate text-slate-900">{{ row.username }}</span>
        <CopyButton :value="row.username" :timeout="copyTimeoutMs" />
      </div>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-email="{ row }">
      <div v-if="row.email" class="flex items-center gap-2">
        <span class="flex-1 truncate text-slate-900">{{ row.email }}</span>
        <CopyButton :value="row.email" :timeout="copyTimeoutMs" />
      </div>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-password="{ row }">
      <div v-if="row.password" class="flex items-center gap-2">
        <span class="flex-1 font-mono text-sm">
          {{ visiblePasswords.has(row.id) ? row.password : '•'.repeat(12) }}
        </span>
        <div class="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            @click="togglePasswordVisibility(row.id, $event)"
          >
            <Eye v-if="!visiblePasswords.has(row.id)" class="h-3.5 w-3.5" />
            <EyeOff v-else class="h-3.5 w-3.5" />
          </Button>
          <CopyButton :value="row.password" :timeout="copyTimeoutMs" />
        </div>
      </div>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-loginUrl="{ row }">
      <div v-if="row.loginUrl" class="flex items-center gap-2">
        <a
          :href="row.loginUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 flex-1 truncate hover:underline"
          @click.stop
        >
          {{ row.loginUrl }}
        </a>
        <CopyButton :value="row.loginUrl" :timeout="copyTimeoutMs" />
      </div>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-id="{ row }">
      <div class="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          class="hover:text-primary-600 h-7 w-7 p-0 text-slate-600"
          @click="handleEdit(row, $event)"
        >
          <Pencil class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="hover:text-danger-600 h-7 w-7 p-0 text-slate-600"
          @click="handleDelete(row, $event)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    </template>
  </DataTable>
</template>
