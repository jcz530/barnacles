<script setup lang="ts">
import { Button } from '../ui/button';
import { Trash2 } from 'lucide-vue-next';
import InlineEditInput from '../atoms/InlineEditInput.vue';

interface HostEntry {
  id: string;
  ip: string;
  hostname: string;
}

interface Props {
  host: HostEntry;
  isNew?: boolean;
  isIpModified?: boolean;
  isHostnameModified?: boolean;
}

withDefaults(defineProps<Props>(), {
  isNew: false,
  isIpModified: false,
  isHostnameModified: false,
});

const emit = defineEmits<{
  'update:ip': [value: string];
  'update:hostname': [value: string];
  remove: [];
}>();

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
</script>

<template>
  <tr class="hover:bg-muted/50 border-b transition-colors">
    <!-- IP Address Cell -->
    <td
      class="w-[35%] px-4 py-3 transition-colors"
      :class="{
        'bg-amber-50': isIpModified,
      }"
    >
      <InlineEditInput
        :model-value="host.ip"
        @update:model-value="val => emit('update:ip', val)"
        placeholder="127.0.0.1"
        :is-invalid="host.ip && !isValidIP(host.ip)"
      />
    </td>

    <!-- Hostname Cell -->
    <td
      class="w-[55%] px-4 py-3 transition-colors"
      :class="{
        'bg-amber-50': isHostnameModified,
      }"
    >
      <InlineEditInput
        :model-value="host.hostname"
        @update:model-value="val => emit('update:hostname', val)"
        placeholder="myapp.local"
        :is-invalid="host.hostname && !isValidHostname(host.hostname)"
      />
    </td>

    <!-- Actions Cell -->
    <td class="w-[10%] px-4 py-3">
      <div class="flex justify-end">
        <Button @click="emit('remove')" variant="ghost" size="icon" class="h-8 w-8">
          <Trash2 class="text-destructive h-4 w-4" />
        </Button>
      </div>
    </td>
  </tr>
</template>
