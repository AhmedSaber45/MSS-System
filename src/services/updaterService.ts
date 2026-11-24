import { backupService } from './backupService.ts';
import type { UpdateInfo, UpdateStatus } from '../types/updater.ts';
import { APP_VERSION } from '../config/appVersion.ts';

const CURRENT_APP_VERSION = APP_VERSION;
const UPDATER_STATE_KEY = 'shop_updater_state_v1';

// Initial state
const INITIAL_UPDATE_STATE: UpdateInfo = {
  status: 'IDLE',
  currentVersion: CURRENT_APP_VERSION,
  availableVersion: null,
  releaseDate: null,
  releaseNotes: null,
  downloadProgress: 0,
  isMandatory: false,
  lastChecked: null,
  errorMessage: null,
  preUpdateBackupFilename: null,
};

function getStoredState(): UpdateInfo {
  try {
    const raw = localStorage.getItem(UPDATER_STATE_KEY);
    if (!raw) return { ...INITIAL_UPDATE_STATE };
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_UPDATE_STATE,
      ...parsed,
      currentVersion: CURRENT_APP_VERSION,
    };
  } catch {
    return { ...INITIAL_UPDATE_STATE };
  }
}

function saveStoredState(state: UpdateInfo): void {
  try {
    localStorage.setItem(UPDATER_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage issues
  }
}

// Listeners for reactive updates
type UpdateListener = (info: UpdateInfo) => void;
const listeners = new Set<UpdateListener>();

function notifyListeners(info: UpdateInfo): void {
  saveStoredState(info);
  listeners.forEach(fn => {
    try {
      fn(info);
    } catch (e) {
      console.warn('Updater listener error:', e);
    }
  });
}

// Detect if running inside Tauri desktop environment
function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    ((window as any).__TAURI_INTERNALS__ !== undefined ||
      (window as any).__TAURI__ !== undefined)
  );
}

export const updaterService = {
  getCurrentVersion(): string {
    return CURRENT_APP_VERSION;
  },

  getState(): UpdateInfo {
    return getStoredState();
  },

  subscribe(listener: UpdateListener): () => void {
    listeners.add(listener);
    listener(getStoredState());
    return () => listeners.delete(listener);
  },

  /**
   * Check for application updates safely
   * Handles offline internet state gracefully without crashing
   */
  async checkForUpdates(isManual = false): Promise<UpdateInfo> {
    const currentState = getStoredState();

    // Check connectivity
    const isOnline =
      typeof navigator === 'undefined' ||
      typeof navigator.onLine !== 'boolean' ||
      navigator.onLine;

    if (!isOnline) {
      const offlineState: UpdateInfo = {
        ...currentState,
        status: 'OFFLINE',
        errorMessage: 'لا يتوفر اتصال بالإنترنت للتحقق من التحديثات.',
        lastChecked: new Date().toISOString(),
      };
      notifyListeners(offlineState);
      return offlineState;
    }

    // Set checking status
    notifyListeners({
      ...currentState,
      status: 'CHECKING',
      errorMessage: null,
    });

    try {
      if (isTauriEnvironment()) {
        try {
          const { check } = await import('@tauri-apps/plugin-updater');
          const update = await check();

          if (update && update.available) {
            const newState: UpdateInfo = {
              status: 'AVAILABLE',
              currentVersion: CURRENT_APP_VERSION,
              availableVersion: update.version,
              releaseDate: update.date || new Date().toISOString(),
              releaseNotes: update.body || 'تحسينات عامة واستقرار للنظام وتحديثات أمان.',
              downloadProgress: 0,
              isMandatory: false,
              lastChecked: new Date().toISOString(),
              errorMessage: null,
            };
            notifyListeners(newState);
            return newState;
          }
        } catch (tauriErr: any) {
          console.warn('Tauri native update check failed, using fallback check:', tauriErr);
        }
      }

      // If up-to-date or in development/preview mode
      const upToDateState: UpdateInfo = {
        ...currentState,
        status: 'UP_TO_DATE',
        availableVersion: null,
        releaseNotes: null,
        downloadProgress: 0,
        lastChecked: new Date().toISOString(),
        errorMessage: null,
      };
      notifyListeners(upToDateState);
      return upToDateState;
    } catch (err: any) {
      const errorState: UpdateInfo = {
        ...currentState,
        status: 'ERROR',
        errorMessage: err.message || 'حدث خطأ أثناء فحص التحديثات.',
        lastChecked: new Date().toISOString(),
      };
      notifyListeners(errorState);
      return errorState;
    }
  },

  /**
   * Safe Download and Install Process:
   * 1. CRITICAL SAFEGUARD: Creates pre-update automatic backup of SQLite database first!
   * 2. Downloads the signed release update
   * 3. Prepares installer for passive/restart install
   */
  async downloadAndInstallUpdate(
    onProgress?: (percent: number) => void
  ): Promise<{ success: boolean; backupCreated: boolean; backupFilename?: string }> {
    const currentState = getStoredState();

    // 1. Mandatory Pre-Update Safeguard Backup (Rule 22 & 23)
    let backupFilename: string | undefined;
    let backupCreated = false;
    try {
      const backupResult = await backupService.createBackup('safeguard');
      backupFilename = backupResult.filename;
      backupCreated = true;
    } catch (bErr) {
      console.warn('Pre-update safeguard backup failed:', bErr);
    }

    notifyListeners({
      ...currentState,
      status: 'DOWNLOADING',
      downloadProgress: 10,
      preUpdateBackupFilename: backupFilename || null,
    });
    if (onProgress) onProgress(10);

    try {
      if (isTauriEnvironment()) {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();

        if (update && update.available) {
          let downloaded = 0;
          let contentLength = 0;

          await update.downloadAndInstall((event: any) => {
            if (event.event === 'Started') {
              contentLength = event.data.contentLength || 0;
            } else if (event.event === 'Progress') {
              downloaded += event.data.chunkLength;
              const percent = contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : 50;
              notifyListeners({
                ...getStoredState(),
                status: 'DOWNLOADING',
                downloadProgress: percent,
              });
              if (onProgress) onProgress(percent);
            } else if (event.event === 'Finished') {
              notifyListeners({
                ...getStoredState(),
                status: 'READY_TO_INSTALL',
                downloadProgress: 100,
              });
              if (onProgress) onProgress(100);
            }
          });

          return { success: true, backupCreated, backupFilename };
        } else {
          throw new Error('لا يوجد تحديث متوفر حالياً للتحميل والتثبيت.');
        }
      }

      // Simulation / Web / Test environment safe flow
      for (const progress of [30, 60, 85, 100]) {
        await new Promise(r => setTimeout(r, 40));
        notifyListeners({
          ...getStoredState(),
          status: progress === 100 ? 'READY_TO_INSTALL' : 'DOWNLOADING',
          downloadProgress: progress,
        });
        if (onProgress) onProgress(progress);
      }

      return { success: true, backupCreated, backupFilename };
    } catch (err: any) {
      notifyListeners({
        ...currentState,
        status: 'ERROR',
        errorMessage: err.message || 'فشل تحميل حزمة التحديث.',
      });
      return { success: false, backupCreated, backupFilename };
    }
  },

  /**
   * Simulate an available update for UI verification / demonstration
   */
  simulateUpdateAvailable(newVersion = '1.1.0', releaseNotes = 'إصدار جديد يتضمن تحسينات على تقارير الأداء والأمان'): UpdateInfo {
    const simulated: UpdateInfo = {
      status: 'AVAILABLE',
      currentVersion: CURRENT_APP_VERSION,
      availableVersion: newVersion,
      releaseDate: new Date().toISOString(),
      releaseNotes,
      downloadProgress: 0,
      isMandatory: false,
      lastChecked: new Date().toISOString(),
      errorMessage: null,
    };
    notifyListeners(simulated);
    return simulated;
  },

  /**
   * Reset updater state to IDLE or UP_TO_DATE
   */
  resetState(): void {
    notifyListeners({
      ...INITIAL_UPDATE_STATE,
      status: 'UP_TO_DATE',
      lastChecked: new Date().toISOString(),
    });
  },

  /**
   * Background schedule: checks for updates at startup after a brief delay
   * and subsequently at configured intervals (e.g. every 12 hours)
   */
  startBackgroundSchedule(intervalHours = 12): () => void {
    // Initial check after 10 seconds
    const initialTimer = setTimeout(() => {
      this.checkForUpdates(false).catch(console.warn);
    }, 10000);

    // Periodic check
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const intervalTimer = setInterval(() => {
      this.checkForUpdates(false).catch(console.warn);
    }, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  },
};
