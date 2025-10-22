import { onMounted, onUnmounted, ref } from 'vue';
import type {
  DownloadProgress,
  UpdateError,
  UpdateInfo,
  UpdateState,
} from '../../shared/types/updater';

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
      updateState.value.currentVersion = await window.electronAPI.updateGetVersion();
    } catch (error) {
      console.error('Failed to get current version:', error);
    }

    // Set up event listeners BEFORE checking for updates
    const removeChecking = window.electronAPI.onUpdateChecking(() => {
      updateState.value.status = 'checking';
      isCheckingForUpdates.value = true;
    });
    cleanupFunctions.push(removeChecking);

    const removeAvailable = window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
      updateState.value.status = 'available';
      updateState.value.updateInfo = info;
      isCheckingForUpdates.value = false;
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
    });
    cleanupFunctions.push(removeDownloaded);

    const removeError = window.electronAPI.onUpdateError((error: UpdateError) => {
      updateState.value.status = 'error';
      updateState.value.error = error;
      isCheckingForUpdates.value = false;
      isDownloading.value = false;
    });
    cleanupFunctions.push(removeError);

    // Now that listeners are set up, check for updates automatically
    // Wait a bit to ensure everything is fully initialized
    setTimeout(() => {
      checkForUpdates();
    }, 3000);
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
    }
  };

  // Download the available update
  const downloadUpdate = async () => {
    try {
      await window.electronAPI.updateDownload();
    } catch (error) {
      console.error('Failed to download update:', error);
    }
  };

  // Install the downloaded update
  const installUpdate = async () => {
    try {
      await window.electronAPI.updateInstall();
    } catch (error) {
      console.error('Failed to install update:', error);
    }
  };

  // Dismiss the update notification
  const dismissUpdate = () => {
    if (updateState.value.status === 'available' || updateState.value.status === 'error') {
      updateState.value.status = 'idle';
      updateState.value.updateInfo = undefined;
      updateState.value.error = undefined;
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
