<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { UpdateState } from '../../../shared/types/updater';

interface Props {
  updateState: UpdateState;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  download: [];
  install: [];
  dismiss: [];
}>();

const showNotification = computed(() => {
  return ['available', 'downloading', 'downloaded', 'error'].includes(props.updateState.status);
});

const title = computed(() => {
  switch (props.updateState.status) {
    case 'available':
      return 'Update Available';
    case 'downloading':
      return 'Downloading Update';
    case 'downloaded':
      return 'Update Ready';
    case 'error':
      return 'Update Error';
    default:
      return '';
  }
});

const description = computed(() => {
  switch (props.updateState.status) {
    case 'available':
      return `Version ${props.updateState.updateInfo?.version} is available. Would you like to download it?`;
    case 'downloading':
      return `Downloading version ${props.updateState.updateInfo?.version}...`;
    case 'downloaded':
      return `Version ${props.updateState.updateInfo?.version} is ready to install. Restart the app to apply the update.`;
    case 'error':
      return props.updateState.error?.message || 'An error occurred while checking for updates.';
    default:
      return '';
  }
});

const progressPercent = computed(() => {
  return props.updateState.downloadProgress?.percent ?? 0;
});

const handlePrimaryAction = () => {
  if (props.updateState.status === 'available') {
    emit('download');
  } else if (props.updateState.status === 'downloaded') {
    emit('install');
  }
};

const primaryActionLabel = computed(() => {
  if (props.updateState.status === 'available') {
    return 'Download';
  } else if (props.updateState.status === 'downloaded') {
    return 'Restart & Install';
  }
  return '';
});

const showPrimaryAction = computed(() => {
  return ['available', 'downloaded'].includes(props.updateState.status);
});

const showDismiss = computed(() => {
  return ['available', 'error'].includes(props.updateState.status);
});

const cardClass = computed(() => {
  const baseClass = 'fixed right-4 bottom-4 w-96 shadow-lg z-50';
  if (props.updateState.status === 'error') {
    return `${baseClass} border-red-500`;
  }
  return `${baseClass} border-primary-500`;
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <Card v-if="showNotification" :class="cardClass">
      <CardHeader>
        <CardTitle class="text-lg">{{ title }}</CardTitle>
        <CardDescription>{{ description }}</CardDescription>
      </CardHeader>

      <CardContent v-if="updateState.status === 'downloading'" class="pb-4">
        <div class="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            class="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {{ progressPercent.toFixed(1) }}%
        </p>
      </CardContent>

      <CardFooter v-if="showPrimaryAction || showDismiss" class="gap-2">
        <Button v-if="showPrimaryAction" @click="handlePrimaryAction">
          {{ primaryActionLabel }}
        </Button>
        <Button v-if="showDismiss" variant="outline" @click="emit('dismiss')"> Later </Button>
      </CardFooter>
    </Card>
  </Transition>
</template>
