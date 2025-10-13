<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';
import type { SortingState } from '@tanstack/vue-table';
import { Plus, Trash2, Save, RefreshCw, AlertCircle, Search, Copy, Check } from 'lucide-vue-next';
import { onMounted, ref, computed } from 'vue';
import Card from '../components/ui/card/Card.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import HostsTable from '../components/organisms/HostsTable.vue';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

interface HostEntry {
  id: string;
  ip: string;
  hostname: string;
}

const { setBreadcrumbs } = useBreadcrumbs();
const { useHostsQuery, useHostsPathQuery, useUpdateHostsMutation } = useQueries();

onMounted(() => {
  setBreadcrumbs([{ label: 'Hosts' }]);
});

// Query for fetching hosts
const { data: hostsData, isLoading, refetch } = useHostsQuery({ enabled: true });

// Query for fetching hosts file path
const { data: hostsPath } = useHostsPathQuery({ enabled: true });

// Local state for editing
const editedHosts = ref<HostEntry[]>([]);
const newHosts = ref<HostEntry[]>([]);
const searchQuery = ref('');
const sorting = ref<SortingState>([{ id: 'hostname', desc: false }]);

// Track which fields have been modified
const modifiedFields = computed(() => {
  const modified: Record<string, { ip: boolean; hostname: boolean }> = {};

  if (!hostsData.value) return modified;

  editedHosts.value.forEach(editedHost => {
    const original = hostsData.value?.find(h => h.id === editedHost.id);
    if (original) {
      modified[editedHost.id] = {
        ip: editedHost.ip !== original.ip,
        hostname: editedHost.hostname !== original.hostname,
      };
    }
  });

  return modified;
});

const hasUnsavedChanges = computed(() => {
  if (!hostsData.value) return false;
  const hasEditedChanges = JSON.stringify(editedHosts.value) !== JSON.stringify(hostsData.value);
  const hasNewEntries = newHosts.value.length > 0;
  return hasEditedChanges || hasNewEntries;
});

// Watch for data changes to initialize edited hosts
const hosts = computed(() => {
  if (hostsData.value && editedHosts.value.length === 0 && newHosts.value.length === 0) {
    // Deep clone to avoid mutating the original data
    editedHosts.value = hostsData.value.map(h => ({ ...h }));
  }
  return editedHosts.value;
});

// Mutation for saving hosts
const saveMutation = useUpdateHostsMutation();

// Add new host entry
const addHost = () => {
  const newHost: HostEntry = {
    id: `new-${Date.now()}`,
    ip: '127.0.0.1',
    hostname: '',
  };
  newHosts.value.push(newHost);
};

// Remove host entry
const removeHost = (id: string, isNew: boolean = false) => {
  if (isNew) {
    newHosts.value = newHosts.value.filter(h => h.id !== id);
  } else {
    editedHosts.value = editedHosts.value.filter(h => h.id !== id);
  }
};

// Update host entry (existing hosts)
const updateHost = (id: string, field: 'ip' | 'hostname', value: string) => {
  const host = editedHosts.value.find(h => h.id === id);
  if (host) {
    host[field] = value;
  }
};

// Update new host entry
const updateNewHost = (id: string, field: 'ip' | 'hostname', value: string) => {
  const host = newHosts.value.find(h => h.id === id);
  if (host) {
    host[field] = value;
  }
};

// Save changes
const saveChanges = async () => {
  // Combine edited hosts with new hosts
  const allHosts = [...editedHosts.value, ...newHosts.value];
  await saveMutation.mutateAsync(allHosts.map(h => ({ ip: h.ip, hostname: h.hostname })));

  // Clear local state
  editedHosts.value = [];
  newHosts.value = [];

  // Refetch to get the latest data from the server
  await refetch();
};

// Discard changes
const discardChanges = () => {
  if (hostsData.value) {
    // Deep clone to avoid mutating the original data
    editedHosts.value = hostsData.value.map(h => ({ ...h }));
  }
  newHosts.value = [];
};

// Refresh data
const refreshData = async () => {
  editedHosts.value = [];
  newHosts.value = [];
  await refetch();
};

// Validate IP address
const isValidIP = (ip: string): boolean => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// Validate hostname
const isValidHostname = (hostname: string): boolean => {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/.test(hostname);
};

// Check if form is valid
const isFormValid = computed(() => {
  const allHosts = [...editedHosts.value, ...newHosts.value];
  return allHosts.every(
    host => isValidIP(host.ip) && isValidHostname(host.hostname) && host.hostname.length > 0
  );
});

// Copy path to clipboard
const isCopied = ref(false);
const copyPathToClipboard = async () => {
  if (!hostsPath.value) return;

  try {
    await navigator.clipboard.writeText(hostsPath.value);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
};
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Hosts File Manager</h2>
          <p class="text-muted-foreground mt-1">
            Manage custom local domain mappings in your system hosts file
          </p>
        </div>
        <div class="flex gap-2">
          <Button @click="refreshData" variant="outline" size="sm" :disabled="isLoading">
            <RefreshCw :class="{ 'animate-spin': isLoading }" class="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <!-- Hosts File Path Display -->
      <div
        v-if="hostsPath"
        class="bg-muted/50 mb-4 flex items-center justify-between rounded-lg border px-4 py-3"
      >
        <div class="flex items-center gap-2">
          <span class="text-muted-foreground text-sm font-medium">File Location:</span>
          <code class="text-foreground bg-background rounded px-2 py-1 font-mono text-sm">{{
            hostsPath
          }}</code>
        </div>
        <Button
          @click="copyPathToClipboard"
          variant="ghost"
          size="sm"
          class="h-8"
          :class="{ 'text-green-600': isCopied }"
        >
          <Check v-if="isCopied" class="mr-2 h-4 w-4" />
          <Copy v-else class="mr-2 h-4 w-4" />
          {{ isCopied ? 'Copied!' : 'Copy Path' }}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Host Entries</CardTitle>
              <CardDescription>
                Map custom domains to IP addresses. Common use: point local domains to 127.0.0.1
              </CardDescription>
            </div>
            <div class="flex gap-2">
              <div class="relative">
                <Search
                  class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                />
                <Input v-model="searchQuery" placeholder="Search hosts..." class="w-64 pl-9" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <RefreshCw class="text-muted-foreground h-6 w-6 animate-spin" />
          </div>

          <div v-else class="space-y-4">
            <!-- Hosts Table -->
            <HostsTable
              :hosts="hosts"
              :search-query="searchQuery"
              :sorting="sorting"
              :modified-fields="modifiedFields"
              @update:sorting="val => (sorting = val)"
              @update:search-query="val => (searchQuery = val)"
              @update:host="updateHost"
              @remove:host="id => removeHost(id, false)"
            />

            <!-- New Hosts Section (Pending) -->
            <div v-if="newHosts.length > 0" class="space-y-2">
              <div class="flex items-center gap-2">
                <div class="bg-muted h-px flex-1"></div>
                <span class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                  New Entries (Pending)
                </span>
                <div class="bg-muted h-px flex-1"></div>
              </div>

              <div class="rounded-lg border border-dashed border-yellow-300 bg-yellow-50/50">
                <div
                  v-for="host in newHosts"
                  :key="host.id"
                  class="border-b border-yellow-200 p-4 last:border-b-0"
                >
                  <div class="grid grid-cols-[1fr_2fr_auto] items-center gap-4">
                    <!-- IP Address -->
                    <div>
                      <label class="text-muted-foreground mb-1 block text-xs font-medium">
                        IP Address
                      </label>
                      <Input
                        :model-value="host.ip"
                        @update:model-value="val => updateNewHost(host.id, 'ip', val as string)"
                        placeholder="127.0.0.1"
                        class="font-mono text-sm"
                        :class="{
                          'border-red-500': host.ip && !isValidIP(host.ip),
                        }"
                      />
                    </div>

                    <!-- Hostname -->
                    <div>
                      <label class="text-muted-foreground mb-1 block text-xs font-medium">
                        Hostname
                      </label>
                      <Input
                        :model-value="host.hostname"
                        @update:model-value="
                          val => updateNewHost(host.id, 'hostname', val as string)
                        "
                        placeholder="myapp.local"
                        class="font-mono text-sm"
                        :class="{
                          'border-red-500': host.hostname && !isValidHostname(host.hostname),
                        }"
                      />
                    </div>

                    <!-- Remove Button -->
                    <div class="flex justify-end pt-5">
                      <Button
                        @click="removeHost(host.id, true)"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8"
                      >
                        <Trash2 class="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Add Button -->
            <div>
              <Button @click="addHost" variant="outline" class="w-full">
                <Plus class="mr-2 h-4 w-4" />
                Add Host Entry
              </Button>
            </div>

            <!-- Validation Warning -->
            <div
              v-if="hasUnsavedChanges && !isFormValid"
              class="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3"
            >
              <AlertCircle class="mt-0.5 h-5 w-5 text-yellow-600" />
              <div class="text-sm text-yellow-800">
                <p class="font-medium">Invalid entries detected</p>
                <p class="mt-1">
                  Please ensure all IP addresses and hostnames are valid before saving.
                </p>
              </div>
            </div>

            <!-- Permission Warning -->
            <div class="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <AlertCircle class="mt-0.5 h-5 w-5 text-sky-600" />
              <div class="text-sm text-sky-800">
                <p class="font-medium">Administrator privileges required</p>
                <p class="mt-1">
                  Saving changes to the hosts file requires administrator/sudo privileges. You may
                  be prompted for your password.
                </p>
              </div>
            </div>

            <!-- Error Message -->
            <div
              v-if="saveMutation.isError.value"
              class="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
            >
              <AlertCircle class="mt-0.5 h-5 w-5 text-red-600" />
              <div class="text-sm text-red-800">
                <p class="font-medium">Failed to save changes</p>
                <p class="mt-1">{{ saveMutation.error.value?.message || 'Unknown error' }}</p>
              </div>
            </div>

            <!-- Success Message -->
            <div
              v-if="saveMutation.isSuccess.value && !hasUnsavedChanges"
              class="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3"
            >
              <AlertCircle class="mt-0.5 h-5 w-5 text-green-600" />
              <div class="text-sm text-green-800">
                <p class="font-medium">Changes saved successfully</p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div v-if="hasUnsavedChanges" class="flex justify-end gap-2 border-t pt-4">
              <Button @click="discardChanges" variant="outline">Discard Changes</Button>
              <Button @click="saveChanges" :disabled="!isFormValid || saveMutation.isPending.value">
                <Save class="mr-2 h-4 w-4" />
                {{ saveMutation.isPending.value ? 'Saving...' : 'Save Changes' }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
