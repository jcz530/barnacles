<script setup lang="ts">
import { ref } from 'vue';
import { Copy, Eye, EyeOff, KeyRound, Link, Mail, Pencil, Trash2, User } from 'lucide-vue-next';
import type { Account } from '../../../../shared/types/api';
import { Button } from '../../ui/button';
import { useQueries } from '@/composables/useQueries';
import { toast } from 'vue-sonner';
import { Card } from '@/components/ui/card';

const props = defineProps<{
  accounts: Account[];
  projectId: string;
}>();

const emit = defineEmits<{
  edit: [accountId: number];
}>();

const { useDeleteAccountMutation } = useQueries();
const deleteMutation = useDeleteAccountMutation();

const visiblePasswords = ref<Set<number>>(new Set());

const togglePasswordVisibility = (accountId: number) => {
  const newSet = new Set(visiblePasswords.value);
  if (newSet.has(accountId)) {
    newSet.delete(accountId);
  } else {
    newSet.add(accountId);
  }
  visiblePasswords.value = newSet;
};

const copyToClipboard = async (text: string, fieldName: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${fieldName} copied to clipboard`);
  } catch {
    toast.error('Failed to copy to clipboard');
  }
};

const handleEdit = (account: Account) => {
  emit('edit', account.id);
};

const handleDelete = async (account: Account) => {
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

const openUrl = (url: string) => {
  window.electron?.shell.openExternal(url);
};
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    <Card
      v-for="account in accounts"
      :key="account.id"
      class="group rounded-lg border border-slate-200 p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
    >
      <!-- Header -->
      <div class="mb-3 flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div
            class="bg-primary-500/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          >
            <User class="text-primary-600 h-5 w-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="truncate font-medium text-slate-900">
              {{ account.name || 'Unnamed Account' }}
            </h3>
          </div>
        </div>
        <div class="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            class="hover:text-primary-600 h-7 w-7 p-0 text-slate-600"
            @click="handleEdit(account)"
          >
            <Pencil class="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="hover:text-danger-600 h-7 w-7 p-0 text-slate-600"
            @click="handleDelete(account)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- Details -->
      <div class="space-y-2">
        <!-- Username -->
        <div v-if="account.username" class="flex items-center gap-2 text-sm">
          <User class="h-4 w-4 shrink-0 text-slate-400" />
          <span class="flex-1 truncate text-slate-700">{{ account.username }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            @click="copyToClipboard(account.username!, 'Username')"
          >
            <Copy class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- Email -->
        <div v-if="account.email" class="flex items-center gap-2 text-sm">
          <Mail class="h-4 w-4 shrink-0 text-slate-400" />
          <span class="flex-1 truncate text-slate-700">{{ account.email }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            @click="copyToClipboard(account.email!, 'Email')"
          >
            <Copy class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- Password -->
        <div v-if="account.password" class="flex items-center gap-2 text-sm">
          <KeyRound class="h-4 w-4 shrink-0 text-slate-400" />
          <span class="flex-1 font-mono text-slate-700">
            {{ visiblePasswords.has(account.id) ? account.password : '•'.repeat(12) }}
          </span>
          <div class="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="sm"
              class="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              @click="togglePasswordVisibility(account.id)"
            >
              <Eye v-if="!visiblePasswords.has(account.id)" class="h-3.5 w-3.5" />
              <EyeOff v-else class="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
              @click="copyToClipboard(account.password!, 'Password')"
            >
              <Copy class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <!-- Login URL -->
        <div v-if="account.loginUrl" class="flex items-center gap-2 text-sm">
          <Link class="h-4 w-4 shrink-0 text-slate-400" />
          <button
            @click="openUrl(account.loginUrl)"
            class="text-primary-600 flex-1 cursor-pointer truncate text-left hover:underline"
          >
            {{ account.loginUrl }}
          </button>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 w-6 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            @click="copyToClipboard(account.loginUrl!, 'Login URL')"
          >
            <Copy class="h-3.5 w-3.5" />
          </Button>
        </div>

        <!-- Notes -->
        <div v-if="account.notes" class="mt-2 rounded-md bg-slate-100 p-2">
          <p class="text-xs text-slate-600">{{ account.notes }}</p>
        </div>
      </div>
    </Card>
  </div>
</template>
