<script setup lang="ts">
import {
  useVueTable,
  getCoreRowModel,
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/vue-table';
import type { User } from '../../../shared/types/api';
import TableHeader from '../molecules/TableHeader.vue';
import TableRow from '../molecules/TableRow.vue';
import UserCard from '../molecules/UserCard.vue';

const props = defineProps<{
  users: User[];
  isLoading?: boolean;
  viewMode?: 'table' | 'card';
}>();

const columnHelper = createColumnHelper<User>();

const columns: ColumnDef<User, any>[] = [
  columnHelper.accessor('id', {
    header: 'ID',
    cell: props => props.row.original.id,
  }),
  columnHelper.accessor('name', {
    header: 'Name',
    cell: props => props.row.original.name,
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    cell: props => props.row.original.email,
  }),
];

const table = useVueTable({
  get data() {
    return props.users;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
});
</script>

<template>
  <div class="w-full">
    <div v-if="isLoading" class="py-8 text-center">
      <p class="text-gray-500">Loading users...</p>
    </div>
    <div v-else-if="users.length === 0" class="py-8 text-center">
      <p class="text-gray-500">No users found</p>
    </div>
    <div v-else>
      <!-- Card View -->
      <div v-if="viewMode === 'card'" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UserCard v-for="user in users" :key="user.id" :user="user" />
      </div>
      <!-- Table View -->
      <table v-else class="w-full border-collapse">
        <TableHeader :header-groups="table.getHeaderGroups()" />
        <tbody>
          <TableRow v-for="row in table.getRowModel().rows" :key="row.id" :row="row" />
        </tbody>
      </table>
    </div>
  </div>
</template>
