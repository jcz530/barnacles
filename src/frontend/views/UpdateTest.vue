<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import UpdateNotification from '@/components/organisms/UpdateNotification.vue';
import type { UpdateState } from '../../shared/types/updater';

const updateState = ref<UpdateState>({
  status: 'idle',
  currentVersion: '0.2.2',
});

const showAvailable = () => {
  updateState.value = {
    status: 'available',
    currentVersion: '0.2.2',
    updateInfo: {
      version: '0.3.0',
      releaseDate: new Date().toISOString(),
      releaseNotes: 'Bug fixes and performance improvements',
    },
  };
};

const showDownloading = () => {
  updateState.value = {
    status: 'downloading',
    currentVersion: '0.2.2',
    updateInfo: {
      version: '0.3.0',
      releaseDate: new Date().toISOString(),
    },
    downloadProgress: {
      percent: 45,
      bytesPerSecond: 1024000,
      transferred: 45000000,
      total: 100000000,
    },
  };
};

const showDownloaded = () => {
  updateState.value = {
    status: 'downloaded',
    currentVersion: '0.2.2',
    updateInfo: {
      version: '0.3.0',
      releaseDate: new Date().toISOString(),
      releaseNotes: 'Bug fixes and performance improvements',
    },
  };
};

const showError = () => {
  updateState.value = {
    status: 'error',
    currentVersion: '0.2.2',
    error: {
      message: 'Failed to download update. Please check your internet connection.',
    },
  };
};

const hideNotification = () => {
  updateState.value = {
    status: 'idle',
    currentVersion: '0.2.2',
  };
};

const handleDownload = () => {
  console.log('Download clicked');
};

const handleInstall = () => {
  console.log('Install clicked');
};

const handleDismiss = () => {
  console.log('Dismiss clicked');
  hideNotification();
};
</script>

<template>
  <div class="container mx-auto p-8">
    <Card>
      <CardHeader>
        <CardTitle>Update Notification Testing</CardTitle>
        <CardDescription> Test the update notification UI in different states </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Current State: <span class="font-semibold">{{ updateState.status }}</span>
          </p>
          <div class="flex flex-wrap gap-2">
            <Button @click="showAvailable">Show "Update Available"</Button>
            <Button @click="showDownloading">Show "Downloading" (45%)</Button>
            <Button @click="showDownloaded">Show "Update Ready"</Button>
            <Button @click="showError" variant="destructive">Show Error</Button>
            <Button @click="hideNotification" variant="outline">Hide Notification</Button>
          </div>
        </div>

        <div class="mt-4 rounded-lg border p-4">
          <h3 class="mb-2 text-sm font-semibold">Current State Details:</h3>
          <pre class="text-xs">{{ JSON.stringify(updateState, null, 2) }}</pre>
        </div>
      </CardContent>
    </Card>

    <UpdateNotification
      :update-state="updateState"
      @download="handleDownload"
      @install="handleInstall"
      @dismiss="handleDismiss"
    />
  </div>
</template>
