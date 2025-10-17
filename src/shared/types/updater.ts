/**
 * Update information received from the auto-updater
 */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | string[];
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
