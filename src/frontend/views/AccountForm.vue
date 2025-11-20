<script setup lang="ts">
import { computed, type ComputedRef, inject, type Ref, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft } from 'lucide-vue-next';
import { useQueries } from '@/composables/useQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RouteNames } from '@/router';
import { toast } from 'vue-sonner';
import type { ProjectWithDetails } from '../../../shared/types/api';

const route = useRoute();
const router = useRouter();

// Inject project data from parent (ProjectDetail)
const projectId = inject<ComputedRef<string>>('projectId');
const project = inject<Ref<ProjectWithDetails | undefined>>('project');

if (!projectId) {
  throw new Error('AccountForm must be used within a project detail page');
}

const accountId = computed(() => route.params.accountId as string | undefined);

const { useAccountsQuery, useCreateAccountMutation, useUpdateAccountMutation } = useQueries();

const { data: accounts } = useAccountsQuery(projectId, { enabled: !!accountId.value });
const createMutation = useCreateAccountMutation();
const updateMutation = useUpdateAccountMutation();

const formData = ref({
  name: '',
  username: '',
  email: '',
  password: '',
  notes: '',
  loginUrl: '',
});

const errorMessage = ref('');

const isEditing = computed(() => !!accountId.value);

const account = computed(() => {
  if (!accountId.value || !accounts.value) return null;
  return accounts.value.find(a => a.id === Number(accountId.value));
});

// Populate form when editing
watch(
  account,
  acc => {
    if (acc) {
      formData.value = {
        name: acc.name || '',
        username: acc.username || '',
        email: acc.email || '',
        password: acc.password || '',
        notes: acc.notes || '',
        loginUrl: acc.loginUrl || '',
      };
    }
  },
  { immediate: true }
);

const validateForm = (): boolean => {
  // At least one field must be filled
  const hasAtLeastOneField =
    formData.value.name.trim() ||
    formData.value.username.trim() ||
    formData.value.email.trim() ||
    formData.value.password.trim() ||
    formData.value.notes.trim() ||
    formData.value.loginUrl.trim();

  if (!hasAtLeastOneField) {
    errorMessage.value = 'Please fill in at least one field';
    return false;
  }

  errorMessage.value = '';
  return true;
};

const handleSubmit = async () => {
  if (!validateForm()) {
    return;
  }

  try {
    const input = {
      name: formData.value.name.trim() || undefined,
      username: formData.value.username.trim() || undefined,
      email: formData.value.email.trim() || undefined,
      password: formData.value.password.trim() || undefined,
      notes: formData.value.notes.trim() || undefined,
      loginUrl: formData.value.loginUrl.trim() || undefined,
    };

    if (isEditing.value && accountId.value) {
      await updateMutation.mutateAsync({
        projectId: projectId.value,
        accountId: Number(accountId.value),
        data: input,
      });
      toast.success('Account updated successfully');
    } else {
      await createMutation.mutateAsync({
        projectId: projectId.value,
        data: input,
      });
      toast.success('Account created successfully');
    }

    // Navigate back to accounts tab
    router.push({ name: RouteNames.ProjectAccounts, params: { id: projectId.value } });
  } catch (error: any) {
    const apiError = error?.response?.data?.error || error?.message;
    errorMessage.value = apiError || `Failed to ${isEditing.value ? 'update' : 'create'} account`;
  }
};

const handleCancel = () => {
  router.push({ name: RouteNames.ProjectAccounts, params: { id: projectId.value } });
};

const isPending = computed(() => createMutation.isPending.value || updateMutation.isPending.value);
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="border-b border-slate-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">
            {{ isEditing ? 'Edit Account' : 'New Account' }}
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            {{
              isEditing
                ? 'Update the account details below.'
                : 'Add a new account for this project. All fields are optional, but at least one must be filled.'
            }}
          </p>
        </div>
        <Button variant="ghost" size="sm" @click="handleCancel">
          <ArrowLeft class="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </div>
    </div>

    <!-- Form -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-2xl space-y-6">
        <!-- Name -->
        <div class="space-y-2">
          <Label for="account-name">Name</Label>
          <Input id="account-name" v-model="formData.name" placeholder="e.g., Production Admin" />
          <p class="text-xs text-slate-500">A friendly name to identify this account</p>
        </div>

        <!-- Username -->
        <div class="space-y-2">
          <Label for="account-username">Username</Label>
          <Input id="account-username" v-model="formData.username" placeholder="e.g., admin" />
        </div>

        <!-- Email -->
        <div class="space-y-2">
          <Label for="account-email">Email</Label>
          <Input
            id="account-email"
            v-model="formData.email"
            type="email"
            placeholder="e.g., admin@example.com"
          />
        </div>

        <!-- Password -->
        <div class="space-y-2">
          <Label for="account-password">Password</Label>
          <Input
            id="account-password"
            v-model="formData.password"
            type="password"
            placeholder="••••••••"
          />
          <p class="text-xs text-slate-500">Password will be encrypted and stored securely</p>
        </div>

        <!-- Login URL -->
        <div class="space-y-2">
          <Label for="account-login-url">Login URL</Label>
          <Input
            id="account-login-url"
            v-model="formData.loginUrl"
            type="url"
            placeholder="e.g., https://example.com/login"
          />
        </div>

        <!-- Notes -->
        <div class="space-y-2">
          <Label for="account-notes">Notes</Label>
          <Textarea
            id="account-notes"
            v-model="formData.notes"
            placeholder="Additional notes about this account..."
            rows="4"
          />
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="bg-danger-50 text-danger-700 rounded-md p-3 text-sm">
          {{ errorMessage }}
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="handleCancel"> Cancel </Button>
          <Button :disabled="isPending" @click="handleSubmit">
            {{ isPending ? 'Saving...' : isEditing ? 'Update Account' : 'Create Account' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
