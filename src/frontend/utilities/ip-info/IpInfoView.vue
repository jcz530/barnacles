<script setup lang="ts">
import { computed } from 'vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import CopyButton from '@/components/atoms/CopyButton.vue';
import { Globe, Monitor, Network, Server } from 'lucide-vue-next';
import { useQueries } from '@/composables/useQueries';

const { useIpInfoQuery } = useQueries();
const { data: ipInfo, isLoading, isError, error } = useIpInfoQuery();

// Computed properties for cleaner template logic
const hasPublicIp = computed(() => !!ipInfo.value?.publicIp);
const hasLocalIpv4 = computed(() => (ipInfo.value?.localIpv4?.length ?? 0) > 0);
const hasLocalIpv6 = computed(() => (ipInfo.value?.localIpv6?.length ?? 0) > 0);
const hasInterfaces = computed(() => (ipInfo.value?.interfaces?.length ?? 0) > 0);
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">IP Address Information</h2>
        <p class="text-muted-foreground mt-1">
          View your public IP address, local network IPs, hostname, and network interface details
        </p>
      </div>

      <!-- Error State -->
      <div v-if="isError" class="border-danger-500 text-danger-500 mb-6 rounded border-1 p-4">
        {{ error?.message || 'Failed to load IP information' }}
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Public IP Section -->
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <Globe class="text-primary h-5 w-5" />
              <CardTitle>Public IP Address</CardTitle>
            </div>
            <CardDescription>Your internet-facing IP address</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="isLoading" class="space-y-2">
              <Skeleton class="h-8 w-full" />
            </div>
            <div v-else-if="hasPublicIp" class="space-y-4">
              <div
                class="bg-muted hover:bg-muted/80 flex items-center justify-between rounded-lg p-4 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <code class="font-mono text-lg font-semibold break-all">{{
                    ipInfo.publicIp
                  }}</code>
                </div>
                <CopyButton :value="ipInfo.publicIp" class="ml-2 flex-shrink-0" />
              </div>
            </div>
            <div v-else class="text-muted-foreground py-8 text-center">
              <p class="text-sm">Unable to fetch public IP</p>
            </div>
          </CardContent>
        </Card>

        <!-- Hostname Section -->
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <Monitor class="text-primary h-5 w-5" />
              <CardTitle>Hostname</CardTitle>
            </div>
            <CardDescription>Your computer's network name</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="isLoading" class="space-y-2">
              <Skeleton class="h-8 w-full" />
            </div>
            <div v-else-if="ipInfo?.hostname" class="space-y-4">
              <div
                class="bg-muted hover:bg-muted/80 flex items-center justify-between rounded-lg p-4 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <code class="font-mono text-lg font-semibold break-all">{{
                    ipInfo.hostname
                  }}</code>
                </div>
                <CopyButton :value="ipInfo.hostname" class="ml-2 flex-shrink-0" />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Local IPv4 Addresses -->
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <Network class="text-primary h-5 w-5" />
              <CardTitle>Local IPv4 Addresses</CardTitle>
            </div>
            <CardDescription>Your private network IP addresses</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="isLoading" class="space-y-2">
              <Skeleton class="h-8 w-full" />
              <Skeleton class="h-8 w-full" />
            </div>
            <div v-else-if="hasLocalIpv4" class="space-y-2">
              <div
                v-for="(ip, index) in ipInfo.localIpv4"
                :key="index"
                class="bg-muted hover:bg-muted/80 flex items-center justify-between rounded-lg p-3 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <code class="font-mono text-sm break-all">{{ ip }}</code>
                </div>
                <CopyButton :value="ip" size="sm" class="ml-2 flex-shrink-0" />
              </div>
            </div>
            <div v-else class="text-muted-foreground py-8 text-center">
              <p class="text-sm">No local IPv4 addresses found</p>
            </div>
          </CardContent>
        </Card>

        <!-- Local IPv6 Addresses -->
        <Card>
          <CardHeader>
            <div class="flex items-center gap-2">
              <Server class="text-primary h-5 w-5" />
              <CardTitle>Local IPv6 Addresses</CardTitle>
            </div>
            <CardDescription>Your IPv6 network addresses</CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="isLoading" class="space-y-2">
              <Skeleton class="h-8 w-full" />
              <Skeleton class="h-8 w-full" />
            </div>
            <div v-else-if="hasLocalIpv6" class="space-y-2">
              <div
                v-for="(ip, index) in ipInfo.localIpv6"
                :key="index"
                class="bg-muted hover:bg-muted/80 flex items-center justify-between rounded-lg p-3 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <code class="font-mono text-sm break-all">{{ ip }}</code>
                </div>
                <CopyButton :value="ip" size="sm" class="ml-2 flex-shrink-0" />
              </div>
            </div>
            <div v-else class="text-muted-foreground py-8 text-center">
              <p class="text-sm">No local IPv6 addresses found</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Network Interfaces Section -->
      <Card class="mt-6">
        <CardHeader>
          <CardTitle>Network Interfaces</CardTitle>
          <CardDescription>All network interfaces and their addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="isLoading" class="space-y-2">
            <Skeleton class="h-16 w-full" />
            <Skeleton class="h-16 w-full" />
            <Skeleton class="h-16 w-full" />
          </div>
          <div v-else-if="hasInterfaces" class="space-y-3">
            <div
              v-for="(iface, index) in ipInfo.interfaces"
              :key="index"
              class="bg-muted hover:bg-muted/80 flex items-start justify-between rounded-lg p-4 transition-colors"
            >
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ iface.name }}</span>
                  <Badge :variant="iface.internal ? 'secondary' : 'default'" class="text-xs">
                    {{ iface.internal ? 'Internal' : 'External' }}
                  </Badge>
                  <Badge variant="outline" class="text-xs">
                    {{ iface.family }}
                  </Badge>
                </div>
                <code class="text-muted-foreground text-sm break-all">{{ iface.address }}</code>
              </div>
              <CopyButton :value="iface.address" size="sm" class="ml-2 flex-shrink-0" />
            </div>
          </div>
          <div v-else class="text-muted-foreground py-8 text-center">
            <p class="text-sm">No network interfaces found</p>
          </div>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
