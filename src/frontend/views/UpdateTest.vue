<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import UpdateNotification from '@/components/organisms/UpdateNotification.vue';
import NavUpdate from '@/components/nav/molecules/NavUpdate.vue';
import { Switch } from '@/components/ui/switch';
import {
  resetUpdateDismissal,
  simulateUpdateState,
  simulateUserInitiatedDownload,
} from '@/composables/useUpdater';
import { useQueries } from '@/composables/useQueries';
import { useQueryClient } from '@tanstack/vue-query';
import type { Setting } from '../../shared/types/api';
import type { UpdateState } from '../../shared/types/updater';

const updateState = ref<UpdateState>({
  status: 'idle',
  currentVersion: '0.2.2',
});

const showAvailable = () => {
  isDismissed.value = false;
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
  isDismissed.value = false;
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
  isDismissed.value = false;
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
  isDismissed.value = false;
  updateState.value = {
    status: 'error',
    currentVersion: '0.2.2',
    error: {
      // The real thing: a long unbroken file:// URL, which is what overflowed
      // the toast before it was clamped.
      message:
        'Code signature at URL file:///Users/example/Library/Caches/app.barnacles.app.ShipIt/update.9uaoc7M/Barnacles.app/ did not pass validation: code failed to satisfy specified code requirement(s)',
    },
  };
};

const hideNotification = () => {
  isDismissed.value = false;
  updateState.value = {
    status: 'idle',
    currentVersion: '0.2.2',
  };
};

const handleDownload = () => {
  console.log('Download clicked');
};

const handleDismiss = () => {
  console.log('Dismiss clicked');
  isDismissed.value = true;
};

/*
 * The two inputs that change what the toast decides to show.
 *
 * `autoUpdateEnabled` off is the old flow: the "available" state has to prompt
 * for a download, because nothing will fetch it otherwise. On, that state is
 * background work and the toast stays quiet until there is a restart to offer.
 */
const { useSettingsQuery, useUpdateSettingMutation } = useQueries();
const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const queryClient = useQueryClient();

const autoUpdateEnabled = ref(true);
const isDismissed = ref(false);

/*
 * Start from the stored value, so the toggle reflects reality on arrival.
 *
 * `isHydrating` keeps that initial sync from looking like a user flip and
 * writing the value straight back to the database it just came from.
 */
let isHydrating = false;
watch(
  () => settingsQuery.data.value,
  data => {
    const setting = data?.find(s => s.key === 'autoUpdate');
    if (!setting) return;

    const stored = String(setting.value) === 'true';
    if (stored === autoUpdateEnabled.value) return;

    isHydrating = true;
    autoUpdateEnabled.value = stored;
  },
  { immediate: true }
);

/*
 * Write the real setting, not just local state.
 *
 * The sidebar badge reads the stored `autoUpdate` value rather than anything on
 * this page, so a local ref would move the preview and leave the real chrome
 * behind -- which is exactly the confusion this toggle is meant to resolve.
 *
 * The mutation deliberately does not invalidate `['settings']` (that loops with
 * the auto-save watchers on the settings page), so the cache is patched by hand
 * here. A targeted `setQueryData` is safe where an invalidation is not.
 */
const setAutoUpdate = async (enabled: boolean) => {
  await updateSettingMutation.mutateAsync({
    key: 'autoUpdate',
    value: enabled,
    type: 'boolean',
  });

  queryClient.setQueryData<Setting[]>(['settings'], current =>
    current?.map(setting =>
      setting.key === 'autoUpdate' ? { ...setting, value: String(enabled) } : setting
    )
  );
};

watch(autoUpdateEnabled, enabled => {
  if (isHydrating) {
    isHydrating = false;
    return;
  }
  void setAutoUpdate(enabled);
});

/*
 * Mirror the harness state into the shared updater store.
 *
 * The preview box below renders from the local ref, but the badge in the real
 * sidebar reads the shared store -- which nothing moves in an unpackaged build.
 * Pushing it here is what lets the actual chrome be exercised, not just a
 * stand-in. `simulateUpdateState` is a no-op outside dev.
 */
watch(updateState, state => simulateUpdateState(state), { immediate: true, deep: true });

// Keep the shared dismissal in step with the toggle, so the toast on this page
// behaves the way it would in the app.
watch(isDismissed, dismissed => {
  if (!dismissed) resetUpdateDismissal();
});

/*
 * Whether this download is treated as one the user asked for.
 *
 * With automatic updates on, the sidebar badge stays silent while downloading
 * -- that is the point of the setting. Flipping this is how to see both modes
 * without waiting on a real release.
 */
const userInitiatedDownload = ref(false);
watch(userInitiatedDownload, value => simulateUserInitiatedDownload(value), { immediate: true });
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
          <p class="text-sm text-slate-600">
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

        <div class="flex flex-wrap items-center gap-6 border-t pt-4">
          <label class="flex items-center gap-2 text-sm">
            <Switch v-model="autoUpdateEnabled" />
            Automatic updates
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Switch v-model="isDismissed" />
            Dismissed
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Switch v-model="userInitiatedDownload" />
            User-initiated download
          </label>
          <p class="text-muted-foreground text-xs">
            With automatic updates off, "Update Available" prompts to download. Dismissing hides the
            toast but not the sidebar badge. The badge only reports download progress when the
            download was user-initiated &mdash; an automatic one stays silent until it is ready.
          </p>
        </div>

        <!--
          The sidebar badge normally reads the shared updater state, which only
          the main process can drive. Rendered here from the same local state so
          both surfaces can be checked against each other without a release.
        -->
        <div class="mt-4 rounded-lg border p-4">
          <h3 class="mb-2 text-sm font-semibold">Sidebar indicator:</h3>
          <div class="w-64 rounded-md border p-2">
            <NavUpdate :state-override="updateState" :auto-update-enabled="autoUpdateEnabled" />
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
      :is-dismissed="isDismissed"
      :auto-update-enabled="autoUpdateEnabled"
      @download="handleDownload"
      @dismiss="handleDismiss"
    />
  </div>
</template>
