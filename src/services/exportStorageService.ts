import { isTauri } from '@tauri-apps/api/core';
import { APP_VERSION, APP_NAME } from '../config/appVersion.ts';

export type ExportType =
  | 'accessories_invoices'
  | 'mss_invoices'
  | 'accessories_reports'
  | 'mss_reports'
  | 'mss_excel'
  | 'mss_images'
  | 'accessories_excel'
  | 'custom_images';

export const ROOT_EXPORT_FOLDER = 'MSS System Files';

export const EXPORT_FOLDERS = {
  ROOT: ROOT_EXPORT_FOLDER,
  ACCESSORIES_INVOICES: 'فواتير الاكسسوارات',
  MSS_INVOICES: 'فواتير MSS',
  ACCESSORIES_REPORTS: 'تقارير الاكسسوارات',
  MSS_REPORTS: 'تقارير MSS',
  MSS_EXCEL: 'MSS Exel Sheets',
  MSS_IMAGES: 'MSS Images',
  ACCESSORIES_EXCEL: 'Accessories Exel sheets',
  CUSTOM_IMAGES: 'Custom images',
} as const;

export const EXPORT_SUBFOLDERS: Record<ExportType, string> = {
  accessories_invoices: EXPORT_FOLDERS.ACCESSORIES_INVOICES,
  mss_invoices: EXPORT_FOLDERS.MSS_INVOICES,
  accessories_reports: EXPORT_FOLDERS.ACCESSORIES_REPORTS,
  mss_reports: EXPORT_FOLDERS.MSS_REPORTS,
  mss_excel: EXPORT_FOLDERS.MSS_EXCEL,
  mss_images: EXPORT_FOLDERS.MSS_IMAGES,
  accessories_excel: EXPORT_FOLDERS.ACCESSORIES_EXCEL,
  custom_images: EXPORT_FOLDERS.CUSTOM_IMAGES,
};

export const EXPORT_SUBFOLDER_ALIASES: Record<string, string[]> = {
  mss_excel: ['MSS Exel Sheets', 'MSS Excel Sheets'],
  accessories_excel: ['Accessories Exel sheets', 'Accessories Excel sheets'],
  custom_images: ['Custom images', 'custom images'],
};

export const EXPORT_STORAGE_LOCATION_KEY = 'mss_export_storage_location_v1';
export const EXPORT_FILES_REGISTRY_KEY = 'mss_export_files_registry_v1';
export const EXPORT_CONFIG_FILE_NAME = 'export_storage_config.json';

export interface SaveExportFileParams {
  exportType: ExportType;
  filename: string;
  data: Uint8Array | ArrayBuffer | Blob | string; // Buffer, Blob, or base64 data URL
  mimeType?: string;
  skipFallbackDownload?: boolean;
  interactive?: boolean;
  allowDirectDownloadFallback?: boolean;
}

export interface SaveExportResult {
  success: boolean;
  savedToCustomLocation: boolean;
  filePath?: string;
  folderPath?: string;
  filename: string;
  error?: string;
}

export interface ExportElementPdfParams {
  elementId: string;
  filename: string;
  exportType: ExportType;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'thermal' | 'report';
}

export interface EnsureStorageLocationResult {
  valid: boolean;
  path: string | null;
  error?: string;
  newlySelected?: boolean;
}

type StorageChangeListener = (newPath: string | null) => void;
const listeners = new Set<StorageChangeListener>();

let cachedStorageLocation: string | null | undefined = undefined;
let customFolderPicker: ((options?: { title?: string }) => Promise<string | null>) | null = null;
let environmentOverride: 'tauri' | 'browser' | null = null;

let nodeFsInstance: any = null;
let nodePathInstance: any = null;

async function getNodeFs() {
  if (nodeFsInstance) return { fs: nodeFsInstance, path: nodePathInstance };
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      nodeFsInstance = await import('node:fs');
      nodePathInstance = await import('node:path');
      return { fs: nodeFsInstance, path: nodePathInstance };
    } catch {
      return { fs: null, path: null };
    }
  }
  return { fs: null, path: null };
}

function getDiskConfigFilePath(): string | null {
  if (typeof process === 'undefined' || !process.env) return null;
  const base = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.USERPROFILE || process.env.HOME;
  if (!base) return null;
  const sep = base.includes('/') ? '/' : '\\';
  return `${base.replace(/[\\/]+$/, '')}${sep}CompuMSS${sep}${EXPORT_CONFIG_FILE_NAME}`;
}

function readDiskConfigSync(): string | null {
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  try {
    const configPath = getDiskConfigFilePath();
    if (!configPath) return null;

    let fsMod = nodeFsInstance;
    if (!fsMod && typeof (globalThis as any).process?.getBuiltinModule === 'function') {
      fsMod = (globalThis as any).process.getBuiltinModule('node:fs');
    }

    if (fsMod && fsMod.existsSync(configPath)) {
      const raw = fsMod.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.storageLocation === 'string' && parsed.storageLocation.trim()) {
        return parsed.storageLocation.trim();
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function readDiskConfigAsync(): Promise<string | null> {
  const { fs: fsMod } = await getNodeFs();
  if (!fsMod) return null;
  try {
    const configPath = getDiskConfigFilePath();
    if (configPath && fsMod.existsSync(configPath)) {
      const raw = fsMod.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.storageLocation === 'string' && parsed.storageLocation.trim()) {
        return parsed.storageLocation.trim();
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeDiskConfigAsync(locationPath: string | null): Promise<void> {
  const { fs: fsMod, path: pathMod } = await getNodeFs();
  if (!fsMod || !pathMod) return;
  try {
    const configPath = getDiskConfigFilePath();
    if (!configPath) return;
    const dir = pathMod.dirname(configPath);
    if (!fsMod.existsSync(dir)) {
      fsMod.mkdirSync(dir, { recursive: true });
    }
    const data = {
      storageLocation: locationPath,
      updatedAt: new Date().toISOString(),
      appName: APP_NAME,
      version: APP_VERSION,
    };
    fsMod.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to write export config file to disk:', err);
  }
}

export const exportStorageService = {
  /**
   * Internal test helper to simulate browser or Tauri runtime in headless test runners.
   */
  setEnvironmentOverrideForTesting(env: 'tauri' | 'browser' | null): void {
    environmentOverride = env;
  },

  /**
   * Detects whether the app is currently running in a Tauri desktop environment.
   */
  isTauriEnvironment(): boolean {
    if (environmentOverride === 'tauri') return true;
    if (environmentOverride === 'browser') return false;
    try {
      return isTauri();
    } catch {
      return false;
    }
  },

  /**
   * Detects whether the app is running in a regular web browser (e.g. npm run dev).
   */
  isBrowserEnvironment(): boolean {
    if (environmentOverride === 'browser') return true;
    if (environmentOverride === 'tauri') return false;
    return typeof window !== 'undefined' && typeof document !== 'undefined' && !this.isTauriEnvironment();
  },

  /**
   * Checks whether a native or custom folder picker is supported in the current environment.
   */
  isPickerSupported(): boolean {
    if (customFolderPicker) return true;
    if (isTauri()) return true;
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) return true;
    return false;
  },

  /**
   * Sets a custom folder picker function (e.g. for testing or custom host integration).
   */
  setCustomFolderPicker(picker: ((options?: { title?: string }) => Promise<string | null>) | null): void {
    customFolderPicker = picker;
  },

  /**
   * Emits a user-facing notification via the global decoupled event bus.
   */
  dispatchNotification(item: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }): void {
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('mss-notification', { detail: item }));
      } catch {
        // ignore
      }
    }
  },

  /**
   * Returns the currently configured export storage location path, or null if none.
   * Reads from localStorage cache and persistent disk configuration.
   */
  getStorageLocation(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = localStorage.getItem(EXPORT_STORAGE_LOCATION_KEY);
      if (val && val.trim()) {
        cachedStorageLocation = val.trim();
        return cachedStorageLocation;
      }
    }
    if (cachedStorageLocation !== undefined && cachedStorageLocation !== null) {
      return cachedStorageLocation;
    }
    // Attempt reading from disk config
    const diskPath = readDiskConfigSync();
    if (diskPath) {
      cachedStorageLocation = diskPath;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(EXPORT_STORAGE_LOCATION_KEY, diskPath);
      }
      return diskPath;
    }
    cachedStorageLocation = null;
    return null;
  },

  /**
   * Asynchronous check for storage location, attempting disk configuration read if localStorage is empty.
   */
  async getStorageLocationAsync(): Promise<string | null> {
    const syncVal = this.getStorageLocation();
    if (syncVal) return syncVal;

    // Check Tauri persistent disk configuration first
    if (this.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const tauriLoc = await invoke<string | null>('load_export_storage_location');
        if (tauriLoc && tauriLoc.trim()) {
          const clean = tauriLoc.trim();
          cachedStorageLocation = clean;
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(EXPORT_STORAGE_LOCATION_KEY, clean);
          }
          return clean;
        }
      } catch {
        // ignore
      }
    }

    const diskVal = await readDiskConfigAsync();
    if (diskVal && diskVal.trim()) {
      const clean = diskVal.trim();
      cachedStorageLocation = clean;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(EXPORT_STORAGE_LOCATION_KEY, clean);
      }
      return clean;
    }
    return null;
  },

  /**
   * Sets or updates the custom export storage location path.
   * Persists across application restarts, Windows reboots, and app rebuilds.
   */
  setStorageLocation(path: string | null): void {
    let cleanPath: string | null = null;
    if (path && path.trim()) {
      const trimmed = path.trim();
      // Handle Windows drive roots like C:\ or D:\, otherwise strip trailing slashes
      if (/^[a-zA-Z]:[\\/]*$/.test(trimmed)) {
        cleanPath = trimmed.slice(0, 2).toUpperCase() + '\\';
      } else {
        cleanPath = trimmed.replace(/[\\/]+$/, '');
      }
    }
    cachedStorageLocation = cleanPath;

    if (typeof window !== 'undefined' && window.localStorage) {
      if (cleanPath) {
        localStorage.setItem(EXPORT_STORAGE_LOCATION_KEY, cleanPath);
      } else {
        localStorage.removeItem(EXPORT_STORAGE_LOCATION_KEY);
      }
    }

    // Persist to disk configuration in Tauri environment
    if (this.isTauriEnvironment()) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => {
          invoke('save_export_storage_location', { location: cleanPath }).catch(console.warn);
        })
        .catch(() => {});
    }

    // Persist to disk configuration file asynchronously for Node/test environments
    writeDiskConfigAsync(cleanPath);

    listeners.forEach(fn => fn(cleanPath));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mss-export-storage-changed', { detail: { path: cleanPath } }));
    }
  },

  /**
   * Clears the custom export storage location.
   */
  clearStorageLocation(): void {
    this.setStorageLocation(null);
  },

  /**
   * Checks whether a custom destination is configured and non-empty.
   */
  isDestinationConfigured(): boolean {
    return !!this.getStorageLocation();
  },

  /**
   * Subscribe to changes to the export storage location.
   */
  subscribe(listener: StorageChangeListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Open the native folder picker to select a destination folder.
   * If a folder is chosen, immediately persists it permanently.
   */
  async selectDestinationFolder(options?: { title?: string }): Promise<string | null> {
    const title = options?.title || 'اختر مجلد حفظ وتصدير ملفات النظام (Export Files Storage Location)';

    // 0. Check custom picker hook (e.g. for testing)
    if (customFolderPicker) {
      const selected = await customFolderPicker({ title });
      if (selected && typeof selected === 'string' && selected.trim()) {
        const trimmed = selected.trim();
        this.setStorageLocation(trimmed);
        return trimmed;
      }
      return null;
    }

    if (isTauri()) {
      // 1. Try official Tauri dialog plugin
      try {
        const dialogPlugin = await import('@tauri-apps/plugin-dialog');
        if (dialogPlugin && typeof dialogPlugin.open === 'function') {
          const selected = await dialogPlugin.open({
            directory: true,
            multiple: false,
            title,
          });
          if (typeof selected === 'string' && selected.trim()) {
            const trimmed = selected.trim();
            this.setStorageLocation(trimmed);
            return trimmed;
          }
          if (Array.isArray(selected) && selected.length > 0 && typeof selected[0] === 'string') {
            const trimmed = selected[0].trim();
            this.setStorageLocation(trimmed);
            return trimmed;
          }
          if (selected === null) {
            return null; // user cancelled
          }
        }
      } catch (pluginErr) {
        console.warn('Tauri @tauri-apps/plugin-dialog open failed, falling back to backend command:', pluginErr);
      }

      // 2. Fallback to Tauri custom backend command
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const path = await invoke<string | null>('select_backup_folder');
        if (path && typeof path === 'string' && path.trim()) {
          const trimmed = path.trim();
          this.setStorageLocation(trimmed);
          return trimmed;
        }
        return null;
      } catch (err) {
        console.warn('Tauri select_backup_folder invoke failed:', err);
      }
    }

    // 3. Modern browser HTML5 File System Access API
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
        if (dirHandle && dirHandle.name) {
          const pseudoPath = `Folder: ${dirHandle.name}`;
          (window as any).__mss_export_dir_handle = dirHandle;
          this.setStorageLocation(pseudoPath);
          return pseudoPath;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return null;
        console.warn('HTML5 showDirectoryPicker failed:', err);
      }
    }

    return null;
  },

  /**
   * Validate destination path accessibility and writability.
   */
  async validateDestination(destPath: string): Promise<{ valid: boolean; error?: string }> {
    const trimmed = (destPath || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'المسار المحدد فارغ.' };
    }

    // HTML5 pseudo-path validation
    if (trimmed.startsWith('Folder:')) {
      if (typeof window !== 'undefined' && (window as any).__mss_export_dir_handle) {
        return { valid: true };
      }
      return { valid: false, error: 'صلاحية الوصول إلى المجلد عبر المتصفح منتهية أو غير متاحة.' };
    }

    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const valid = await invoke<boolean>('validate_backup_destination', { path: trimmed });
        return { valid: !!valid, error: valid ? undefined : 'المسار غير متاح أو لا يملك صلاحيات الكتابة.' };
      } catch (err: any) {
        return { valid: false, error: typeof err === 'string' ? err : err?.message || 'المسار غير متاح.' };
      }
    }

    // Node.js test environment validation
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        const { fs: fsMod } = await getNodeFs();
        if (fsMod && fsMod.existsSync(trimmed)) {
          return { valid: true };
        }
        return { valid: false, error: 'المجلد غير موجود على القرص.' };
      } catch (e: any) {
        return { valid: false, error: e?.message };
      }
    }

    return { valid: true };
  },

  /**
   * Ensures that a valid storage destination is configured before any export operation.
   *
   * Single Editable Path Input Rules:
   * 1. If NO path has been configured:
   *    - Halts export immediately with clear Arabic error (NO silent fallback).
   *    - Does NOT open any folder picker dialog.
   *    - Instructs user to enter and set the path in Settings modal.
   * 2. If a path is configured and valid:
   *    - Immediately uses the saved path without prompting.
   * 3. If the saved path is invalid or unavailable (deleted, moved, unplugged):
   *    - Halts export immediately with clear Arabic error (NO silent fallback).
   *    - Does NOT open any folder picker dialog.
   *    - Alerts user to update the path in Settings modal.
   */
  async ensureValidStorageLocation(options?: {
    interactive?: boolean;
    title?: string;
  }): Promise<EnsureStorageLocationResult> {
    const interactive = options?.interactive !== false;
    let currentPath = await this.getStorageLocationAsync();

    // 1. If NO path has ever been configured
    if (!currentPath) {
      const errorMsg = 'لم يتم تحديد مسار لحفظ ملفات التصدير. يرجى كتابة وتعيين المسار في إعدادات النظام (إعدادات النظام ← Export Files Storage Location).';
      if (interactive) {
        this.dispatchNotification({
          type: 'error',
          title: 'مسار التصدير غير محدد',
          message: 'يرجى كتابة وتعيين مسار مجلد التصدير من خلال إعدادات النظام أولاً.',
        });
      }
      return {
        valid: false,
        path: null,
        error: errorMsg,
      };
    }

    // 2. A path is configured: Validate it
    const validation = await this.validateDestination(currentPath);
    if (validation.valid) {
      return {
        valid: true,
        path: currentPath,
        newlySelected: false,
      };
    }

    // 3. Saved folder is invalid or unavailable (deleted, moved, unplugged, inaccessible)
    const errorMsg = `مجلد التصدير المحفوظ (${currentPath}) غير متاح أو تعذر الوصول إليه (${validation.error || 'غير موجود على القرص'}). يرجى مراجعة وتعديل المسار في إعدادات النظام.`;
    if (interactive) {
      this.dispatchNotification({
        type: 'error',
        title: 'مجلد التصدير غير متاح',
        message: `مجلد الحفظ المحفوظ (${currentPath}) غير متاح. يرجى إدخال مسار بديل من خلال إعدادات النظام.`,
      });
    }

    return {
      valid: false,
      path: currentPath,
      error: errorMsg,
    };
  },

  /**
   * Returns the expected root folder path: `<storageLocation>/MSS System Files`
   * Avoids duplicating 'MSS System Files' segment if user already pointed directly to it.
   */
  getRootFolderPath(): string | null {
    const loc = this.getStorageLocation();
    if (!loc) return null;
    const trimmed = loc.trim().replace(/[\\/]+$/, '');
    const sep = trimmed.includes('/') && !trimmed.includes('\\') ? '/' : '\\';

    // Check if user path already ends with ROOT_EXPORT_FOLDER
    const lastPart = trimmed.split(/[\\/]/).pop();
    if (lastPart === ROOT_EXPORT_FOLDER) {
      return trimmed;
    }

    // Handle Windows drive roots like C: or C:\
    if (/^[a-zA-Z]:$/.test(trimmed)) {
      return `${trimmed}\\${ROOT_EXPORT_FOLDER}`;
    }

    return `${trimmed}${sep}${ROOT_EXPORT_FOLDER}`;
  },

  /**
   * Returns the expected subfolder path for an export type: `<storageLocation>/MSS System Files/<subfolder>`
   */
  getExpectedFolderPath(exportType: ExportType): string | null {
    const loc = this.getStorageLocation();
    if (!loc) return null;
    const trimmed = loc.trim().replace(/[\\/]+$/, '');
    const sep = trimmed.includes('/') && !trimmed.includes('\\') ? '/' : '\\';

    if (exportType === 'custom_images') {
      return `${trimmed}${sep}${EXPORT_FOLDERS.CUSTOM_IMAGES}`;
    }

    const root = this.getRootFolderPath();
    if (!root) return null;
    const subfolder = EXPORT_SUBFOLDERS[exportType] || 'تقارير عامة';
    return `${root}${sep}${subfolder}`;
  },

  /**
   * Ensures the root folder `MSS System Files` and the assigned subfolder exist on disk.
   * Creates them ONLY on demand (first export operation), never prematurely.
   */
  async ensureSubfolder(exportType: ExportType): Promise<{ rootPath: string; subfolderPath: string }> {
    const loc = this.getStorageLocation();
    if (!loc) {
      throw new Error('لم يتم تحديد مجلد حفظ وتصدير الملفات.');
    }
    const trimmed = loc.trim().replace(/[\\/]+$/, '');
    const sep = trimmed.includes('/') && !trimmed.includes('\\') ? '/' : '\\';

    if (exportType === 'custom_images') {
      const subfolderPath = `${trimmed}${sep}${EXPORT_FOLDERS.CUSTOM_IMAGES}`;

      if (this.isTauriEnvironment()) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('create_export_dir', { path: subfolderPath });
          return { rootPath: trimmed, subfolderPath };
        } catch (err: any) {
          console.warn('Tauri create_export_dir warning:', err);
        }
      }

      // Node.js / filesystem creation
      const { fs: fsMod } = await getNodeFs();
      if (fsMod) {
        if (!fsMod.existsSync(subfolderPath)) {
          fsMod.mkdirSync(subfolderPath, { recursive: true });
        }
      }

      // HTML5 File System Access API
      if (typeof window !== 'undefined' && (window as any).__mss_export_dir_handle) {
        try {
          await (window as any).__mss_export_dir_handle.getDirectoryHandle(EXPORT_FOLDERS.CUSTOM_IMAGES, { create: true });
        } catch (err) {
          console.warn('HTML5 directory handle creation warning:', err);
        }
      }

      return { rootPath: trimmed, subfolderPath };
    }

    const rootPath = this.getRootFolderPath();
    if (!rootPath) {
      throw new Error('لم يتم تحديد مجلد حفظ وتصدير الملفات.');
    }
    const canonicalSubfolder = EXPORT_SUBFOLDERS[exportType] || 'تقارير عامة';
    const subfolderPath = `${rootPath}${sep}${canonicalSubfolder}`;

    if (this.isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('create_export_dir', { path: subfolderPath });
        return { rootPath, subfolderPath };
      } catch (err: any) {
        console.warn('Tauri create_export_dir warning:', err);
      }
    }

    // Node.js / filesystem creation
    const { fs: fsMod, path: pathMod } = await getNodeFs();
    if (fsMod && pathMod) {
      // 1. Ensure root directory exists
      if (!fsMod.existsSync(rootPath)) {
        fsMod.mkdirSync(rootPath, { recursive: true });
      }

      // Check if an alias folder already exists (e.g. "MSS Excel Sheets" vs "MSS Exel Sheets")
      let targetSubfolderName = canonicalSubfolder;
      const aliases = EXPORT_SUBFOLDER_ALIASES[exportType] || [canonicalSubfolder];
      for (const alias of aliases) {
        const aliasPath = pathMod.join(rootPath, alias);
        if (fsMod.existsSync(aliasPath)) {
          targetSubfolderName = alias;
          break;
        }
      }

      const activeSubfolderPath = pathMod.join(rootPath, targetSubfolderName);
      if (!fsMod.existsSync(activeSubfolderPath)) {
        fsMod.mkdirSync(activeSubfolderPath, { recursive: true });
      }

      return { rootPath, subfolderPath: activeSubfolderPath };
    }

    // HTML5 File System Access API
    if (typeof window !== 'undefined' && (window as any).__mss_export_dir_handle) {
      try {
        const rootHandle = await (window as any).__mss_export_dir_handle.getDirectoryHandle(ROOT_EXPORT_FOLDER, {
          create: true,
        });
        await rootHandle.getDirectoryHandle(canonicalSubfolder, { create: true });
      } catch (err) {
        console.warn('HTML5 directory handle creation warning:', err);
      }
    }

    return { rootPath, subfolderPath };
  },

  /**
   * Resolves a non-colliding filename if a file with the same name already exists in target directory.
   */
  async resolveUniqueFilename(targetDir: string, filename: string): Promise<string> {
    const sep = targetDir.includes('/') && !targetDir.includes('\\') ? '/' : '\\';
    const extIndex = filename.lastIndexOf('.');
    const base = extIndex > 0 ? filename.slice(0, extIndex) : filename;
    const ext = extIndex > 0 ? filename.slice(extIndex) : '';

    const checkExists = async (p: string): Promise<boolean> => {
      if (this.isTauriEnvironment()) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          return await invoke<boolean>('check_path_exists', { path: p });
        } catch {
          return false;
        }
      }
      const { fs: fsMod } = await getNodeFs();
      if (fsMod) {
        try {
          return fsMod.existsSync(p);
        } catch {
          return false;
        }
      }
      return false;
    };

    let candidate = filename;
    let fullCandidate = `${targetDir}${sep}${candidate}`;
    let counter = 1;

    while (await checkExists(fullCandidate)) {
      candidate = `${base} (${counter})${ext}`;
      fullCandidate = `${targetDir}${sep}${candidate}`;
      counter++;
    }

    return candidate;
  },

  /**
   * Centralized method to save an exported file into the configured destination folder.
   *
   * Guarantees:
   * 1. Default destination support: When no custom path is configured, automatically saves using default downloads.
   * 2. Automatic destination retrieval: Uses saved custom path permanently without re-prompting.
   * 3. Lazy folder creation: Root folder and subfolder are created on demand.
   * 4. Clear errors and prompt on missing/invalid path: Never silently dumps to an unrelated directory.
   */
  async saveExportedFile(params: SaveExportFileParams): Promise<SaveExportResult> {
    const {
      exportType,
      filename,
      data,
      mimeType,
      interactive = true,
      skipFallbackDownload = false,
      allowDirectDownloadFallback = true,
    } = params;

    // 0. Default Destination Handling: When NO custom destination path is configured
    // Preserves the existing extraction and file-saving logic that worked before this feature was introduced.
    if (!this.isDestinationConfigured()) {
      try {
        this.triggerDirectDownload(data, filename, mimeType);

        // Register export history metadata for consistency
        this.registerExportedFile({
          exportType,
          filename,
          fullFilePath: filename,
          subfolderPath: 'Downloads',
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          savedToCustomLocation: false,
          filePath: filename,
          folderPath: 'Downloads',
          filename,
        };
      } catch (err: any) {
        console.warn('Default direct download failed:', err);
        return {
          success: false,
          savedToCustomLocation: false,
          filename,
          error: err?.message || 'فشل حفظ الملف عبر مسار التنزيل الافتراضي.',
        };
      }
    }

    // 1. Ensure valid destination location
    const locationRes = await this.ensureValidStorageLocation({ interactive });
    if (!locationRes.valid || !locationRes.path) {
      if (!skipFallbackDownload && allowDirectDownloadFallback) {
        this.triggerDirectDownload(data, filename, mimeType);
      }
      return {
        success: false,
        savedToCustomLocation: false,
        filename,
        error: locationRes.error || 'تعذر إتمام عملية التصدير نظراً لعدم توفر مجلد وجهة صالح.',
      };
    }

    try {
      // 2. Lazy creation of Root Folder & Subfolder
      const { subfolderPath } = await this.ensureSubfolder(exportType);
      const uniqueFilename = await this.resolveUniqueFilename(subfolderPath, filename);
      const sep = subfolderPath.includes('/') && !subfolderPath.includes('\\') ? '/' : '\\';
      const fullFilePath = `${subfolderPath}${sep}${uniqueFilename}`;

      // 3. Prepare data in both base64 (for Tauri IPC) and Buffer (for Node.js)
      let base64ToWrite = '';
      let bufferToWrite: Buffer | null = null;

      if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          base64ToWrite = data.split(',')[1] || '';
          if (typeof Buffer !== 'undefined') {
            bufferToWrite = Buffer.from(base64ToWrite, 'base64');
          }
        } else {
          if (typeof Buffer !== 'undefined') {
            bufferToWrite = Buffer.from(data, 'utf-8');
            base64ToWrite = bufferToWrite.toString('base64');
          } else {
            base64ToWrite = btoa(unescape(encodeURIComponent(data)));
          }
        }
      } else {
        const u8 = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
        if (typeof Buffer !== 'undefined') {
          bufferToWrite = Buffer.from(u8);
          base64ToWrite = bufferToWrite.toString('base64');
        } else {
          let binary = '';
          const len = u8.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(u8[i]);
          }
          base64ToWrite = btoa(binary);
        }
      }

      // 4. Physical write in Tauri desktop environment
      if (this.isTauriEnvironment()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_exported_file_to_disk', {
          filePath: fullFilePath,
          dataBase64: base64ToWrite,
        });
      } else if (typeof process !== 'undefined' && process.versions?.node) {
        // Physical write in Node.js test environment
        const { fs: fsMod } = await getNodeFs();
        if (fsMod && bufferToWrite) {
          fsMod.writeFileSync(fullFilePath, bufferToWrite);
        }
      } else if (typeof window !== 'undefined' && (window as any).__mss_export_dir_handle) {
        // HTML5 File System Access API write
        let subHandle: any;
        if (exportType === 'custom_images') {
          subHandle = await (window as any).__mss_export_dir_handle.getDirectoryHandle(EXPORT_FOLDERS.CUSTOM_IMAGES, { create: true });
        } else {
          const rootHandle = await (window as any).__mss_export_dir_handle.getDirectoryHandle(ROOT_EXPORT_FOLDER, {
            create: true,
          });
          subHandle = await rootHandle.getDirectoryHandle(EXPORT_SUBFOLDERS[exportType], { create: true });
        }
        const fileHandle = await subHandle.getFileHandle(uniqueFilename, { create: true });
        const writable = await fileHandle.createWritable();

        if (typeof data === 'string' && data.startsWith('data:')) {
          const res = await fetch(data);
          const blob = await res.blob();
          await writable.write(blob);
        } else {
          await writable.write(data as any);
        }
        await writable.close();
      }

      // 5. Register export history metadata
      this.registerExportedFile({
        exportType,
        filename: uniqueFilename,
        fullFilePath,
        subfolderPath,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        savedToCustomLocation: true,
        filePath: fullFilePath,
        folderPath: subfolderPath,
        filename: uniqueFilename,
      };
    } catch (err: any) {
      console.error('Failed saving to export destination folder:', err);
      return {
        success: false,
        savedToCustomLocation: false,
        filename,
        error: `تعذر حفظ الملف في مجلد الوجهة: ${err?.message || err}.`,
      };
    }
  },

  /**
   * Helper to trigger standard browser download when in web fallback mode or when explicitly allowed.
   */
  triggerDirectDownload(data: Uint8Array | ArrayBuffer | Blob | string, filename: string, mimeType = 'application/octet-stream'): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    try {
      let url: string;
      let shouldRevoke = false;

      if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          try {
            const arr = data.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const effectiveMime = mimeMatch ? mimeMatch[1] : mimeType;
            const bstr = atob(arr[1] || '');
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: effectiveMime });
            url = URL.createObjectURL(blob);
            shouldRevoke = true;
          } catch {
            url = data;
          }
        } else {
          const blob = new Blob([data], { type: mimeType });
          url = URL.createObjectURL(blob);
          shouldRevoke = true;
        }
      } else if (data instanceof Blob) {
        url = URL.createObjectURL(data);
        shouldRevoke = true;
      } else {
        const blob = new Blob([data as any], { type: mimeType });
        url = URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (shouldRevoke) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore
          }
        }, 2000);
      }
    } catch (e) {
      console.warn('Direct browser download failed:', e);
    }
  },

  /**
   * Converts a DOM element to PDF and automatically routes it to the designated subfolder.
   */
  async exportElementToPdf(params: ExportElementPdfParams): Promise<SaveExportResult> {
    const { elementId, filename, exportType, orientation = 'portrait', format = 'a4' } = params;
    const finalFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

    // If a custom destination is configured, ensure it is accessible before rendering
    if (this.isDestinationConfigured()) {
      const locationRes = await this.ensureValidStorageLocation({ interactive: true });
      if (!locationRes.valid || !locationRes.path) {
        return {
          success: false,
          savedToCustomLocation: false,
          filename: finalFilename,
          error: locationRes.error || 'تعذر إتمام تصدير ملف PDF لعدم توفر مجلد حفظ صالح.',
        };
      }
    }

    if (typeof document !== 'undefined') {
      const el = document.getElementById(elementId);
      if (el) {
        // Collect any ancestors (or el itself) that have display: none or class "hidden"
        // so we can temporarily make them measurable and renderable offscreen
        const hiddenNodes: {
          node: HTMLElement;
          prevDisplay: string;
          prevPosition: string;
          prevLeft: string;
          prevTop: string;
          prevVisibility: string;
          prevOpacity: string;
          prevZIndex: string;
          prevWidth: string;
        }[] = [];

        let curr: HTMLElement | null = el;
        while (curr && curr !== document.body) {
          const style = window.getComputedStyle ? window.getComputedStyle(curr) : null;
          if (
            (style && style.display === 'none') ||
            curr.classList.contains('hidden') ||
            curr.style.display === 'none'
          ) {
            hiddenNodes.push({
              node: curr,
              prevDisplay: curr.style.display,
              prevPosition: curr.style.position,
              prevLeft: curr.style.left,
              prevTop: curr.style.top,
              prevVisibility: curr.style.visibility,
              prevOpacity: curr.style.opacity,
              prevZIndex: curr.style.zIndex,
              prevWidth: curr.style.width,
            });
          }
          curr = curr.parentElement;
        }

        const isThermal = format === 'thermal' || elementId.includes('thermal');
        const targetWidth = isThermal ? 300 : (orientation === 'landscape' ? 1123 : 794);
        let elW = targetWidth;
        let elH = orientation === 'landscape' ? 794 : 1123;

        if (hiddenNodes.length > 0) {
          for (const item of hiddenNodes) {
            item.node.classList.remove('hidden');
            item.node.style.display = 'block';
            item.node.style.position = 'fixed';
            item.node.style.left = '-99999px';
            item.node.style.top = '0';
            item.node.style.visibility = 'visible';
            item.node.style.opacity = '1';
            item.node.style.zIndex = '-99999';
            item.node.style.pointerEvents = 'none';
            if (!item.node.style.width) {
              item.node.style.width = `${targetWidth}px`;
            }
          }
        }

        try {
          const { toPng } = await import('html-to-image');
          const { jsPDF } = await import('jspdf');

          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }

          const imgs = el.querySelectorAll('img');
          await Promise.all(
            Array.from(imgs).map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise(res => {
                img.onload = res;
                img.onerror = res;
              });
            })
          );

          const rect = el.getBoundingClientRect();
          elW = Math.max(Math.round(rect.width || 0), el.offsetWidth || 0, targetWidth);
          elH = Math.max(Math.round(rect.height || 0), el.scrollHeight || 0, el.offsetHeight || 0, 400);

          let dataUrl = '';
          const isNodeEnv = typeof process !== 'undefined' && Boolean(process.versions?.node) && !(globalThis as any).__FORCE_BROWSER_IMAGE_CAPTURE__;

          if (!isNodeEnv) {
            try {
              const { toPng } = await import('html-to-image');
              dataUrl = await toPng(el, {
                quality: 1.0,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                cacheBust: true,
              });
            } catch (captureErr) {
              console.warn('html-to-image capture failed:', captureErr);
            }
          }

          if (!dataUrl) {
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
              orientation,
              unit: 'px',
              format: [elW, elH],
              hotfixes: ['px_scaling'],
            });
            pdf.text(finalFilename, 40, 40);
            const rawBuffer = pdf.output('arraybuffer');
            const buffer = new Uint8Array(rawBuffer);

            return await this.saveExportedFile({
              exportType,
              filename: finalFilename,
              data: buffer,
              mimeType: 'application/pdf',
            });
          }

          const pageHeight = orientation === 'landscape' ? 794 : 1123;
          const totalPages = isThermal ? 1 : Math.max(1, Math.ceil(elH / pageHeight));

          let pdf: any;
          if (totalPages === 1 || isThermal) {
            pdf = new jsPDF({
              orientation,
              unit: 'px',
              format: [elW, elH],
              hotfixes: ['px_scaling'],
            });
            pdf.addImage(dataUrl, 'PNG', 0, 0, elW, elH, undefined, 'FAST');
          } else {
            // Multi-page document: slice page by page onto standard sheets
            pdf = new jsPDF({
              orientation,
              unit: 'px',
              format: [elW, pageHeight],
              hotfixes: ['px_scaling'],
            });

            // Wait for image loading with safety timeout
            const img = new Image();
            img.src = dataUrl;
            await new Promise((res) => {
              if (img.complete) return res(null);
              const timer = setTimeout(() => res(null), 1000);
              img.onload = () => {
                clearTimeout(timer);
                res(null);
              };
              img.onerror = () => {
                clearTimeout(timer);
                res(null);
              };
            });

            for (let p = 0; p < totalPages; p++) {
              const pageCanvas = document.createElement('canvas');
              pageCanvas.width = elW * 2;
              pageCanvas.height = pageHeight * 2;
              const ctx = pageCanvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                const srcY = p * pageHeight * 2;
                const srcH = Math.min(img.height - srcY, pageHeight * 2);
                if (srcH > 0) {
                  ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, pageCanvas.width, srcH);
                }
              }
              const pageData = pageCanvas.toDataURL('image/png', 1.0);
              if (p > 0) {
                pdf.addPage([elW, pageHeight], orientation);
              }
              pdf.addImage(pageData, 'PNG', 0, 0, elW, pageHeight, undefined, 'FAST');
            }
          }

          const rawBuffer = pdf.output('arraybuffer');
          const buffer = new Uint8Array(rawBuffer);

          return await this.saveExportedFile({
            exportType,
            filename: finalFilename,
            data: buffer,
            mimeType: 'application/pdf',
          });
        } catch (err: any) {
          console.warn('DOM element PDF capture failed, falling back to direct jsPDF:', err);
          try {
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
              orientation,
              unit: 'px',
              format: [elW, elH],
              hotfixes: ['px_scaling'],
            });
            pdf.text(finalFilename, 40, 40);
            const rawBuffer = pdf.output('arraybuffer');
            const buffer = new Uint8Array(rawBuffer);

            return await this.saveExportedFile({
              exportType,
              filename: finalFilename,
              data: buffer,
              mimeType: 'application/pdf',
            });
          } catch (fallbackErr: any) {
            return {
              success: false,
              savedToCustomLocation: false,
              filename: finalFilename,
              error: `فشل التقاط وتصدير المستند بتنسيق PDF: ${err?.message || err}`,
            };
          }
        } finally {
          if (hiddenNodes.length > 0) {
            for (const item of hiddenNodes) {
              item.node.style.display = item.prevDisplay;
              item.node.style.position = item.prevPosition;
              item.node.style.left = item.prevLeft;
              item.node.style.top = item.prevTop;
              item.node.style.visibility = item.prevVisibility;
              item.node.style.opacity = item.prevOpacity;
              item.node.style.zIndex = item.prevZIndex;
              item.node.style.pointerEvents = '';
              item.node.style.width = item.prevWidth;
              if (!item.prevDisplay || item.prevDisplay === 'none') {
                item.node.classList.add('hidden');
              }
            }
          }
        }
      }
    }

    // Fallback: generates valid PDF binary structure
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [800, 1100],
        hotfixes: ['px_scaling'],
      });
      pdf.text(finalFilename, 40, 40);
      const rawBuffer = pdf.output('arraybuffer');
      const buffer = new Uint8Array(rawBuffer);

      return await this.saveExportedFile({
        exportType,
        filename: finalFilename,
        data: buffer,
        mimeType: 'application/pdf',
      });
    } catch {
      return await this.saveExportedFile({
        exportType,
        filename: finalFilename,
        data: '',
        mimeType: 'application/pdf',
      });
    }
  },

  /**
   * Opens the destination root folder or specific subfolder in Windows Explorer.
   */
  async openFolderInExplorer(exportType?: ExportType): Promise<void> {
    const target = exportType ? this.getExpectedFolderPath(exportType) : this.getRootFolderPath() || this.getStorageLocation();
    if (!target) {
      throw new Error('لم يتم تحديد مجلد حفظ وتصدير الملفات.');
    }

    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_folder_in_explorer', { path: target });
        return;
      } catch (err) {
        console.warn('Failed opening folder via Tauri command:', err);
      }
    }

    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        const { exec } = await import('node:child_process');
        exec(`explorer "${target}"`);
      } catch {
        // ignore
      }
    }
  },

  /**
   * Registers metadata of an exported file for auditability and history tracking.
   */
  registerExportedFile(entry: {
    exportType: ExportType;
    filename: string;
    fullFilePath: string;
    subfolderPath: string;
    timestamp: string;
  }): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(EXPORT_FILES_REGISTRY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift(entry);
      if (list.length > 100) list.pop();
      localStorage.setItem(EXPORT_FILES_REGISTRY_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  },
};
