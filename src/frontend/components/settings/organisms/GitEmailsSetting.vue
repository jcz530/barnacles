<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import Button from '../../ui/button/Button.vue';
import Input from '../../ui/input/Input.vue';
import { Badge } from '../../ui/badge';
import { Plus, RotateCcw, X, Mail } from 'lucide-vue-next';

const { useSettingsQuery, useUpdateSettingMutation, useDefaultSettingQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const defaultSettingQuery = useDefaultSettingQuery('gitEmails', { enabled: true });

const DEFAULT_EMAILS = ref<string[]>([]);
const emails = ref<string[]>([]);
const newEmail = ref('');
const isInitialized = ref(false);
const hasLoadedFromSettings = ref(false);
const globalEmail = ref<string>('');

// Fetch global git email on mount
const fetchGlobalEmail = async () => {
  try {
    const response = await fetch('/api/system/git-email');
    const data = await response.json();
    if (data.data) {
      globalEmail.value = data.data;
    }
  } catch {
    // Ignore errors - global email is informational only
  }
};
fetchGlobalEmail();

// Update default emails when loaded from backend
watch(
  () => defaultSettingQuery.data.value,
  newData => {
    if (newData && Array.isArray(newData)) {
      DEFAULT_EMAILS.value = newData;
      if (!hasLoadedFromSettings.value && emails.value.length === 0) {
        emails.value = [...newData];
      }
    }
  },
  { immediate: true }
);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const emailsSetting = newData.find(s => s.key === 'gitEmails');
      if (emailsSetting) {
        try {
          const parsed = JSON.parse(emailsSetting.value);
          if (Array.isArray(parsed)) {
            emails.value = parsed;
          }
        } catch {
          emails.value = [...DEFAULT_EMAILS.value];
        }
      }
      hasLoadedFromSettings.value = true;
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
let isFirstChange = true;
watch(
  emails,
  async newValue => {
    if (isFirstChange && hasLoadedFromSettings.value) {
      isFirstChange = false;
      return;
    }

    if (isInitialized.value && !updateSettingMutation.isPending.value && Array.isArray(newValue)) {
      try {
        await updateSettingMutation.mutateAsync({
          key: 'gitEmails',
          value: newValue,
          type: 'json',
        });
      } catch (error) {
        console.error('Failed to save git emails:', error);
      }
    }
  },
  { deep: true }
);

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const addEmail = () => {
  const trimmed = newEmail.value.trim().toLowerCase();
  if (trimmed && isValidEmail(trimmed) && !emails.value.includes(trimmed)) {
    emails.value = [...emails.value, trimmed];
    newEmail.value = '';
  }
};

const removeEmail = (index: number) => {
  emails.value = emails.value.filter((_, i) => i !== index);
};

const resetToDefault = () => {
  emails.value = [...DEFAULT_EMAILS.value];
};

const isDefaultValue = computed(() => {
  if (emails.value.length !== DEFAULT_EMAILS.value.length) {
    return false;
  }
  const sorted1 = [...emails.value].sort();
  const sorted2 = [...DEFAULT_EMAILS.value].sort();
  return sorted1.every((email, i) => email === sorted2[i]);
});

const isSaving = computed(() => updateSettingMutation.isPending.value);

const canAddEmail = computed(() => {
  const trimmed = newEmail.value.trim();
  return trimmed && isValidEmail(trimmed) && !emails.value.includes(trimmed.toLowerCase());
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium">Git Author Emails</label>
    <p class="text-muted-foreground text-sm">
      Add email addresses used for commits across your projects. Git stats will include commits from
      all these emails. Per-project emails are automatically detected.
    </p>

    <!-- Global email display -->
    <div v-if="globalEmail" class="bg-muted/50 mt-2 flex items-center gap-2 rounded-md p-2 text-sm">
      <Mail :size="14" class="text-muted-foreground" />
      <span class="text-muted-foreground">Global git email:</span>
      <code class="bg-muted rounded px-1.5 py-0.5 text-xs">{{ globalEmail }}</code>
      <span class="text-muted-foreground text-xs">(always included)</span>
    </div>

    <!-- List of additional emails -->
    <div v-if="emails.length > 0" class="mt-2 flex flex-wrap gap-2">
      <Badge
        v-for="(email, index) in emails"
        :key="email"
        variant="default"
        class="flex items-center gap-1 py-1 pr-1 pl-2 shadow-sm"
      >
        {{ email }}
        <Button
          @click="removeEmail(index)"
          size="icon"
          :disabled="isSaving"
          class="ml-1 h-4 w-4 cursor-pointer rounded shadow-none hover:bg-slate-400/70"
        >
          <X class="h-2 w-2 p-0.5" />
        </Button>
      </Badge>
    </div>
    <p v-else class="text-muted-foreground mt-2 text-sm italic">
      No additional emails configured. Add emails below to include commits from other addresses.
    </p>

    <!-- Add new email -->
    <div class="mt-2 flex items-center gap-2">
      <Input
        v-model="newEmail"
        placeholder="Add email address (e.g., work@company.com)..."
        class="flex-1"
        type="email"
        @keyup.enter="canAddEmail && addEmail()"
      />
      <Button @click="addEmail" variant="outline" size="sm" :disabled="!canAddEmail">
        <Plus :size="16" class="mr-1" />
        Add
      </Button>
    </div>

    <!-- Reset button -->
    <div class="mt-2 flex items-center gap-4">
      <Button
        @click="resetToDefault"
        variant="outline"
        size="sm"
        :disabled="isDefaultValue || isSaving"
        class="flex items-center gap-2"
      >
        <RotateCcw :size="14" />
        Reset to Default
      </Button>
      <span v-if="isSaving" class="text-muted-foreground text-sm">Saving...</span>
    </div>

    <p class="text-muted-foreground mt-2 text-xs">
      {{ emails.length }} additional {{ emails.length === 1 ? 'email' : 'emails' }} configured
    </p>
  </div>
</template>
