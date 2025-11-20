<script setup lang="ts">
import {
  type ColumnDef,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useVueTable,
} from '@tanstack/vue-table';
import { Eye, EyeOff, Pencil, Trash2, User } from 'lucide-vue-next';
import { ref } from 'vue';
import type { Account } from '../../../../shared/types/api';
import TableHeader from '../../molecules/TableHeader.vue';
import { Button } from '../../ui/button';
import { useQueries } from '@/composables/useQueries';
import { toast } from 'vue-sonner';
import CopyButton from '@/components/atoms/CopyButton.vue';

const props = defineProps<{
  accounts: Account[];
  projectId: string;
}>();

const emit = defineEmits<{
  edit: [accountId: number];
}>();

const { useDeleteAccountMutation } = useQueries();
const deleteMutation = useDeleteAccountMutation();

const internalSorting = ref<SortingState>([]);
const visiblePasswords = ref<Set<number>>(new Set());

const columnHelper = createColumnHelper<Account>();
const copyTimeoutMs = 30_000;

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
  } catch (error) {
    toast.error('Failed to delete account');
  }
};

const columns: ColumnDef<Account, any>[] = [
  columnHelper.accessor('name', {
    header: 'Name',
    enableSorting: true,
    cell: props => props.row.original,
  }),
  columnHelper.accessor('username', {
    header: 'Username',
    enableSorting: true,
    cell: props => props.row.original.username,
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    enableSorting: true,
    cell: props => props.row.original.email,
  }),
  columnHelper.accessor('password', {
    header: 'Password',
    enableSorting: false,
    cell: props => props.row.original,
  }),
  columnHelper.accessor('loginUrl', {
    header: 'Login URL',
    enableSorting: true,
    cell: props => props.row.original.loginUrl,
  }),
  columnHelper.accessor('id', {
    header: '',
    enableSorting: false,
    cell: props => props.row.original,
  }),
];

const table = useVueTable({
  get data() {
    return props.accounts;
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
  },
});
</script>

<template>
  <div class="w-full">
    <div v-if="accounts.length === 0" class="py-12 text-center">
      <p class="text-slate-600">No accounts found.</p>
    </div>
    <div v-else class="overflow-x-auto rounded-lg">
      <table class="w-full border-collapse">
        <TableHeader :header-groups="table.getHeaderGroups()" />
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="group border-b border-slate-200 transition-colors hover:bg-slate-50"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              class="px-4 py-3 text-sm"
              :class="{
                'w-48': cell.column.id === 'name' || cell.column.id === 'email',
                'w-40': cell.column.id === 'username',
                'w-32': cell.column.id === 'password',
                'w-64': cell.column.id === 'loginUrl',
                'w-24': cell.column.id === 'id',
              }"
            >
              <!-- Name -->
              <template v-if="cell.column.id === 'name'">
                <div class="flex items-center gap-2">
                  <div
                    class="bg-primary-500/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  >
                    <User class="text-primary-600 h-4 w-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-slate-900">
                      {{ row.original.name || 'Unnamed Account' }}
                    </div>
                    <div v-if="row.original.notes" class="truncate text-xs text-slate-500">
                      {{ row.original.notes }}
                    </div>
                  </div>
                </div>
              </template>

              <!-- Username -->
              <template v-else-if="cell.column.id === 'username'">
                <div v-if="row.original.username" class="flex items-center gap-2">
                  <span class="flex-1 truncate text-slate-900">{{ row.original.username }}</span>
                  <CopyButton :value="row.original.username" :timeout="copyTimeoutMs" />
                </div>
                <span v-else class="text-slate-400">—</span>
              </template>

              <!-- Email -->
              <template v-else-if="cell.column.id === 'email'">
                <div v-if="row.original.email" class="flex items-center gap-2">
                  <span class="flex-1 truncate text-slate-900">{{ row.original.email }}</span>
                  <CopyButton :value="row.original.email" :timeout="copyTimeoutMs" />
                </div>
                <span v-else class="text-slate-400">—</span>
              </template>

              <!-- Password -->
              <template v-else-if="cell.column.id === 'password'">
                <div v-if="row.original.password" class="flex items-center gap-2">
                  <span class="flex-1 font-mono text-sm">
                    {{
                      visiblePasswords.has(row.original.id) ? row.original.password : '•'.repeat(12)
                    }}
                  </span>
                  <div class="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                      @click="togglePasswordVisibility(row.original.id, $event)"
                    >
                      <Eye v-if="!visiblePasswords.has(row.original.id)" class="h-3.5 w-3.5" />
                      <EyeOff v-else class="h-3.5 w-3.5" />
                    </Button>
                    <CopyButton :value="row.original.password" :timeout="copyTimeoutMs" />
                  </div>
                </div>
                <span v-else class="text-slate-400">—</span>
              </template>

              <!-- Login URL -->
              <template v-else-if="cell.column.id === 'loginUrl'">
                <div v-if="row.original.loginUrl" class="flex items-center gap-2">
                  <a
                    :href="row.original.loginUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 flex-1 truncate hover:underline"
                    @click.stop
                  >
                    {{ row.original.loginUrl }}
                  </a>
                  <CopyButton :value="row.original.loginUrl" :timeout="copyTimeoutMs" />
                </div>
                <span v-else class="text-slate-400">—</span>
              </template>

              <!-- Actions -->
              <template v-else-if="cell.column.id === 'id'">
                <div class="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="hover:text-primary-600 h-7 w-7 p-0 text-slate-600"
                    @click="handleEdit(row.original, $event)"
                  >
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="hover:text-danger-600 h-7 w-7 p-0 text-slate-600"
                    @click="handleDelete(row.original, $event)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
