/**
 * Update information received from the auto-updater
 */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  /**
   * `readonly` because this crosses the IPC boundary as data to display, and is
   * never mutated. Without it, a `readonly()` wrapper on the shared update
   * state no longer satisfies this type.
   */
  releaseNotes?: string | readonly string[];
}

/**
 * Download progress information
 */
export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/**
 * Update error information
 */
export interface UpdateError {
  message: string;
}

/**
 * Update status states
 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  /** Found, but too newly published to download yet. */
  | 'pending'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

/**
 * Complete update state
 */
export interface UpdateState {
  status: UpdateStatus;
  updateInfo?: UpdateInfo;
  downloadProgress?: DownloadProgress;
  error?: UpdateError;
  currentVersion: string;
}
