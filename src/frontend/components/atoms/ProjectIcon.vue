<script setup lang="ts">
import { computed, ref } from 'vue';
import { Folder } from 'lucide-vue-next';
import { RUNTIME_CONFIG } from '../../../shared/constants';

const props = defineProps<{
  projectId: string;
  projectName: string;
  hasIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}>();

const showIcon = ref(props.hasIcon);

const iconUrl = computed(() => {
  if (!showIcon.value) return null;
  return `${RUNTIME_CONFIG.API_BASE_URL}/api/projects/${props.projectId}/icon`;
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-4 w-4';
    case 'lg':
      return 'h-8 w-8';
    case 'md':
    default:
      return 'h-6 w-6';
  }
});

const folderSizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-4 w-4';
    case 'lg':
      return 'h-8 w-8';
    case 'md':
    default:
      return 'h-5 w-5';
  }
});

const handleImageError = () => {
  showIcon.value = false;
};
</script>

<template>
  <div class="flex-shrink-0">
    <img
      v-if="iconUrl"
      :src="iconUrl"
      :alt="`${projectName} icon`"
      :class="[sizeClasses, 'rounded object-contain']"
      @error="handleImageError"
    />
    <Folder v-else :class="[folderSizeClasses, 'text-slate-500']" />
  </div>
</template>
