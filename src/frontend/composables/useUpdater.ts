import { ref, onMounted, onUnmounted } from 'vue';
import type {
  UpdateState,
  UpdateInfo,
  DownloadProgress,
  UpdateError,
} from '../../shared/types/updater';
import { toast } from 'vue-sonner';

export function useUpdater() {
  const updateState = ref<UpdateState>({
    status: 'idle',
    currentVersion: '0.0.0',
  });

  const isCheckingForUpdates = ref(false);
  const isDownloading = ref(false);

  // Cleanup functions for event listeners
  const cleanupFunctions: (() => void)[] = [];

  // Initialize the updater
  onMounted(async () => {
    // Get current version
    try {
      const version = await window.electronAPI.updateGetVersion();
      updateState.value.currentVersion = version;
    } catch (error) {
      console.error('Failed to get current version:', error);
    }

    // Set up event listeners
    const removeChecking = window.electronAPI.onUpdateChecking(() => {
      updateState.value.status = 'checking';
      isCheckingForUpdates.value = true;
    });
    cleanupFunctions.push(removeChecking);

    const removeAvailable = window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
      updateState.value.status = 'available';
      updateState.value.updateInfo = info;
      isCheckingForUpdates.value = false;

      toast.success('Update Available', {
        description: `Version ${info.version} is ready to download.`,
      });
    });
    cleanupFunctions.push(removeAvailable);

    const removeNotAvailable = window.electronAPI.onUpdateNotAvailable((info: UpdateInfo) => {
      updateState.value.status = 'not-available';
      updateState.value.updateInfo = info;
      isCheckingForUpdates.value = false;
    });
    cleanupFunctions.push(removeNotAvailable);

    const removeDownloadProgress = window.electronAPI.onUpdateDownloadProgress(
      (progress: DownloadProgress) => {
        updateState.value.status = 'downloading';
        updateState.value.downloadProgress = progress;
        isDownloading.value = true;
      }
    );
    cleanupFunctions.push(removeDownloadProgress);

    const removeDownloaded = window.electronAPI.onUpdateDownloaded((info: UpdateInfo) => {
      updateState.value.status = 'downloaded';
      updateState.value.updateInfo = info;
      isDownloading.value = false;

      toast.success('Update Ready', {
        description: `Version ${info.version} is ready to install. Restart to apply.`,
        duration: 10000,
      });
    });
    cleanupFunctions.push(removeDownloaded);

    const removeError = window.electronAPI.onUpdateError((error: UpdateError) => {
      updateState.value.status = 'error';
      updateState.value.error = error;
      isCheckingForUpdates.value = false;
      isDownloading.value = false;

      toast.error('Update Error', {
        description: error.message,
      });
    });
    cleanupFunctions.push(removeError);
  });

  // Clean up event listeners on unmount
  onUnmounted(() => {
    cleanupFunctions.forEach(cleanup => cleanup());
  });

  // Manual check for updates
  const checkForUpdates = async () => {
    try {
      await window.electronAPI.updateCheck();
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast.error('Failed to check for updates', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Download the available update
  const downloadUpdate = async () => {
    try {
      await window.electronAPI.updateDownload();
      toast.info('Downloading Update', {
        description: 'The update is being downloaded in the background.',
      });
    } catch (error) {
      console.error('Failed to download update:', error);
      toast.error('Failed to download update', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Install the downloaded update
  const installUpdate = async () => {
    try {
      await window.electronAPI.updateInstall();
    } catch (error) {
      console.error('Failed to install update:', error);
      toast.error('Failed to install update', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  // Dismiss the update notification
  const dismissUpdate = () => {
    if (updateState.value.status === 'available') {
      updateState.value.status = 'idle';
    }
  };

  return {
    updateState,
    isCheckingForUpdates,
    isDownloading,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  };
}
