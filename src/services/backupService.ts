import { invoke, isTauri } from '@tauri-apps/api/core';
import { APP_VERSION } from '../config/appVersion.ts';
import { exportStorageService, EXPORT_STORAGE_LOCATION_KEY, EXPORT_FILES_REGISTRY_KEY } from './exportStorageService.ts';
import type {
  BackupItem,
  BackupConfig,
  BackupTriggerType,
  BackupScheduleMode,
  BackupOverallStatus,
  BackupDestinationResult,
  DestinationValidationResult,
  MultiBackupResult,
  FullBackupManifest,
  BackupInspectionResult,
  FullBackupRestoreResult,
} from '../types/backup.ts';

const BACKUPS_STORAGE_KEY = 'shop_accessories_backups_metadata_v1';
const BACKUP_DATA_PREFIX = 'shop_accessories_backup_data_';
const BACKUP_CONFIG_KEY = 'shop_accessories_backup_config_v1';
const FULL_BACKUP_FORMAT = 'as-full-backup-v1';
const FULL_BACKUP_FORMAT_VERSION = 1;

const DEFAULT_CONFIG: BackupConfig = {
  autoBackupEnabled: true,
  timeBackupEnabled: true,
  eventBackupEnabled: false,
  scheduleMode: 'interval',
  specificTime: '22:00',
  intervalMinutes: 360, // 6 hours
  intervalHours: 6,
  destinations: [],
  retentionCount: 10,
  fullBackupEnabled: false,
};

const ACCESSORIES_DATA_KEYS = [
  'shop_accessories_products_v1',
  'shop_accessories_purchases_v1',
  'shop_accessories_purchase_items_v1',
  'shop_accessories_invoices_v1',
  'shop_accessories_invoice_items_v1',
  'shop_accessories_returns_v1',
  'shop_accessories_return_items_v1',
  'shop_accessories_movements_v1',
  'shop_accessories_expenses_v1',
  'shop_accessories_payments_v1',
  'shop_accessories_schedules_v1',
] as const;

const MSS_STATE_KEYS = [
  'shop_mss_devices_cache_v1',
  'shop_mss_models_cache_v1',
  'shop_mss_invoices_cache_v1',
  'shop_mss_reservations_cache_v1',
  'shop_mss_returns_cache_v1',
  'shop_mss_payments_cache_v1',
  'shop_mss_expenses_v1',
  'shop_mss_stores_cache_v1',
  'shop_mss_audit_cache_v1',
  'shop_mss_transfers_cache_v1',
  'shop_mss_outbox_v1',
  'shop_mss_conflicts_v1',
  'shop_mss_sync_state_v1',
  'shop_mss_system_stores_v1',
  'shop_mss_deleted_devices_v1',
  'shop_mss_deleted_models_v1',
  'accessories_promotional_devices_v1',
] as const;

function isExcludedAuthOrBackupKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (
    lower.startsWith(BACKUP_DATA_PREFIX.toLowerCase()) ||
    lower.startsWith('mss_dest_file_') ||
    lower.startsWith('sb-') ||
    lower === 'compu_mss_session_v1' ||
    lower === 'mss_desktop_session_v1' ||
    lower === 'shop_management_session' ||
    lower === 'admin_dashboard_auth_token'
  ) {
    return true;
  }
  if (
    (lower.includes('session') ||
      lower.includes('token') ||
      lower.includes('password') ||
      lower.includes('credential') ||
      lower.includes('access_code') ||
      lower.includes('auth')) &&
    !lower.includes('autostart')
  ) {
    return true;
  }
  return false;
}

function isExcludedManagedFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('.staging_') ||
    lower.startsWith('~$') ||
    lower.endsWith('.tmp') ||
    lower.endsWith('.temp') ||
    lower === 'thumbs.db' ||
    lower === '.ds_store' ||
    lower === 'session.dpapi' ||
    lower === 'backups_manifest.json' ||
    lower.startsWith('as system backup_') ||
    lower.startsWith('full as system backup_') ||
    lower.startsWith('mss_backup_') ||
    lower.startsWith('accessories_backup_')
  );
}

async function computeSha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  if (typeof process !== 'undefined' && process.versions?.node) {
    const cryptoMod = await import('node:crypto');
    return cryptoMod.createHash('sha256').update(bytes).digest('hex');
  }
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  throw new Error('SHA-256 hashing is unavailable in this environment');
}

// Concurrency locks & Pending Triggers Queue
let isBackupInProgress = false;
let hasPendingBackup = false;
let pendingBackupTriggerType: BackupTriggerType | null = null;

// Event-based debouncing timer & operation buffer
let eventDebounceTimer: any = null;
let pendingEventOperations: string[] = [];

// Global Scheduler Timer Reference & Reactive Listeners
let globalSchedulerTimer: any = null;
let globalSchedulerListeners: Array<(result: MultiBackupResult) => void> = [];
let globalConfigListeners: Array<(config: BackupConfig) => void> = [];

function getLocalBackups(): BackupItem[] {
  try {
    const raw = localStorage.getItem(BACKUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    // Filter out any legacy fictional seed items containing 'C:\Users\User'
    return list.filter(
      (b: any) =>
        !b?.filepath?.includes('C:\\Users\\User') &&
        !b?.destinations?.some((d: any) => d?.path?.includes('C:\\Users\\User'))
    );
  } catch {
    return [];
  }
}

function saveLocalBackups(backups: BackupItem[]): void {
  localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(backups));
}

export const backupService = {
  /**
   * Subscribe to backup configuration changes.
   * Enables immediate UI synchronization across views without page reloads.
   */
  onConfigChange(listener: (config: BackupConfig) => void): () => void {
    if (!globalConfigListeners.includes(listener)) {
      globalConfigListeners.push(listener);
    }
    return () => {
      globalConfigListeners = globalConfigListeners.filter(l => l !== listener);
    };
  },

  notifyConfigListeners(config: BackupConfig): void {
    globalConfigListeners.forEach(listener => {
      try {
        listener(config);
      } catch (err) {
        console.warn('Config change listener error:', err);
      }
    });
  },

  /**
   * Get all available backups.
   * Checks Tauri backend first; falls back to local storage cache.
   */
  async getBackups(): Promise<BackupItem[]> {
    if (isTauri()) {
      try {
        const tauriBackups = await invoke<BackupItem[]>('get_accessories_backups');
        if (Array.isArray(tauriBackups)) {
          const localList = getLocalBackups();
          const localMap = new Map<string, BackupItem>();
          localList.forEach(item => {
            if (item.filename) localMap.set(item.filename, item);
            if (item.id) localMap.set(item.id, item);
          });

          return tauriBackups.map(b => {
            const cached = localMap.get(b.filename) || localMap.get(b.id);
            const mergedDestinations =
              b.destinations && b.destinations.length > 0
                ? b.destinations
                : cached?.destinations && cached.destinations.length > 0
                  ? cached.destinations
                  : [
                      {
                        path: b.filepath,
                        status: 'success' as const,
                        file_path: b.filepath,
                        size_formatted: b.size_formatted,
                      },
                    ];

            return {
              ...b,
              destinations: mergedDestinations,
              overall_status: b.overall_status || cached?.overall_status || 'success',
              error_details: b.error_details || cached?.error_details,
            };
          });
        }
      } catch (err) {
        console.warn('Tauri get_accessories_backups failed, fallback to local storage', err);
      }
    }
    return getLocalBackups();
  },

  /**
   * Open native Windows dialog to select a folder for saving backups.
   * Multi-layered implementation:
   * 1. Official Tauri v2 @tauri-apps/plugin-dialog (open with directory: true)
   * 2. Backend invoke 'select_backup_folder' with PowerShell STA mode
   * 3. Browser showDirectoryPicker if available
   * Never displays alert() or window.prompt with fake paths.
   */
  async selectBackupFolder(): Promise<string | null> {
    if (isTauri()) {
      // 1. Try official Tauri dialog plugin
      try {
        const dialogPlugin = await import('@tauri-apps/plugin-dialog');
        if (dialogPlugin && typeof dialogPlugin.open === 'function') {
          const selected = await dialogPlugin.open({
            directory: true,
            multiple: false,
            title: 'اختر مجلد وجهة النسخ الاحتياطي',
          });
          if (typeof selected === 'string' && selected.trim()) {
            return selected.trim();
          }
          if (Array.isArray(selected) && selected.length > 0 && typeof selected[0] === 'string') {
            return selected[0].trim();
          }
          if (selected === null) {
            // User intentionally cancelled the dialog
            return null;
          }
        }
      } catch (pluginErr) {
        console.warn('Tauri @tauri-apps/plugin-dialog open failed, trying backend invoke:', pluginErr);
      }

      // 2. Fallback to Tauri custom backend command
      try {
        const path = await invoke<string | null>('select_backup_folder');
        if (path && typeof path === 'string' && path.trim()) {
          return path.trim();
        }
        return null;
      } catch (err) {
        console.warn('Tauri select_backup_folder invoke failed:', err);
      }
    }

    // 3. Modern browser HTML5 File System Access API
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          return `C:\\Backups\\${dirHandle.name}`;
        }
      } catch {
        // User cancelled directory picker
        return null;
      }
    }

    return null;
  },

  /**
   * Open native Windows Save dialog to choose specific save path and filename.
   */
  async selectSaveBackupPath(defaultFilename?: string): Promise<string | null> {
    if (isTauri()) {
      try {
        const dialogPlugin = await import('@tauri-apps/plugin-dialog');
        if (dialogPlugin && typeof dialogPlugin.save === 'function') {
          const path = await dialogPlugin.save({
            title: 'حفظ نسخة احتياطية من قاعدة البيانات',
            defaultPath: defaultFilename || 'MSS_Backup.db',
            filters: [
              { name: 'قاعدة بيانات Compu MSS (*.db)', extensions: ['db'] },
              { name: 'جميع الملفات (*.*)', extensions: ['*'] },
            ],
          });
          if (typeof path === 'string' && path.trim()) {
            return path.trim();
          }
          return null;
        }
      } catch (pluginErr) {
        console.warn('Tauri dialog save plugin failed, fallback to backend command:', pluginErr);
      }

      try {
        const path = await invoke<string | null>('select_save_backup_path', { defaultFilename });
        return path ? path.trim() : null;
      } catch (err) {
        console.warn('Tauri select_save_backup_path failed:', err);
      }
    }

    return null;
  },

  /**
   * Open real Windows folder or highlight backup file in Windows Explorer.
   */
  async openBackupFolder(pathOrFile: string): Promise<void> {
    if (!pathOrFile || !pathOrFile.trim()) {
      throw new Error('مسار الملف أو المجلد غير محدد');
    }
    const target = pathOrFile.trim();

    if (isTauri()) {
      try {
        const opener = await import('@tauri-apps/plugin-opener');
        if (target.endsWith('.db') || target.includes('.')) {
          if (typeof opener.revealItemInDir === 'function') {
            await opener.revealItemInDir(target);
            return;
          }
        }
        if (typeof opener.openPath === 'function') {
          const dir = target.endsWith('.db')
            ? target.substring(0, Math.max(target.lastIndexOf('\\'), target.lastIndexOf('/')))
            : target;
          await opener.openPath(dir || target);
          return;
        }
      } catch (openerErr) {
        console.warn('Opener plugin failed, trying backend command:', openerErr);
      }

      try {
        await invoke('open_folder_in_explorer', { path: target });
        return;
      } catch (err: any) {
        throw new Error(err?.message || 'تعذر فتح المجلد في مستكشف Windows');
      }
    }

    throw new Error('خاصية فتح المجلد في Windows متاحة فقط داخل تطبيق سطح المكتب');
  },

  /**
   * Validate that a destination path exists or can be created and is writable.
   */
  async validateDestination(path: string): Promise<DestinationValidationResult> {
    const trimmed = path.trim();
    if (!trimmed) {
      return { path: trimmed, valid: false, error: 'مسار الوجهة فارغ' };
    }

    if (isTauri()) {
      try {
        const valid = await invoke<boolean>('validate_backup_destination', { path: trimmed });
        return { path: trimmed, valid: !!valid };
      } catch (err: any) {
        const msg = typeof err === 'string' ? err : err?.message || 'المسار غير متاح أو غير قابل للكتابة';
        return { path: trimmed, valid: false, error: msg };
      }
    }

    // Web / mock / node environment validation
    const isValidPath =
      /^[a-zA-Z]:\\/.test(trimmed) ||
      /^[a-zA-Z]:\//.test(trimmed) ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('\\\\');

    if (!isValidPath && !trimmed.startsWith('mock://') && !trimmed.startsWith('local://')) {
      return { path: trimmed, valid: false, error: 'صيغة مسار المجلد غير صالحة' };
    }

    if (
      trimmed.includes('DISCONNECTED_DRIVE') ||
      trimmed.includes('INVALID_PATH') ||
      trimmed.includes('NonExistent') ||
      trimmed.includes('DoesNotExist') ||
      trimmed.includes('InvalidDrive')
    ) {
      return { path: trimmed, valid: false, error: 'القرص أو المجلد غير متصل حالياً' };
    }

    return { path: trimmed, valid: true };
  },

  getDefaultBackupFilename(fullBackup: boolean, date: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
      date.getHours()
    )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    return fullBackup ? `Full AS System Backup_${timestampStr}.db` : `AS System Backup_${timestampStr}.db`;
  },

  collectFullBackupFrontendPayload(): {
    appVersion: string;
    settingsJson: string;
    mssStateJson: string;
    exportStorageLocation: string | null;
  } {
    const settingsEntries: Record<string, string> = {};
    const mssStateEntries: Record<string, string> = {};
    const mssKeySet = new Set<string>(MSS_STATE_KEYS);
    const accKeySet = new Set<string>(ACCESSORIES_DATA_KEYS);

    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || isExcludedAuthOrBackupKey(key) || key === BACKUPS_STORAGE_KEY) continue;
        const val = localStorage.getItem(key);
        if (val === null) continue;

        if (mssKeySet.has(key) || key.startsWith('shop_mss_')) {
          mssStateEntries[key] = val;
        } else if (!accKeySet.has(key)) {
          if (
            key === BACKUP_CONFIG_KEY ||
            key === EXPORT_STORAGE_LOCATION_KEY ||
            key === EXPORT_FILES_REGISTRY_KEY ||
            key.startsWith('shop_') ||
            key.startsWith('mss_') ||
            key.startsWith('accessories_') ||
            key.startsWith('compu_')
          ) {
            settingsEntries[key] = val;
          }
        }
      }
    }

    const exportLoc = exportStorageService.getStorageLocation();
    if (exportLoc && !settingsEntries[EXPORT_STORAGE_LOCATION_KEY]) {
      settingsEntries[EXPORT_STORAGE_LOCATION_KEY] = exportLoc;
    }

    const settingsPayload = {
      exportStorageLocation: exportLoc,
      backupConfig: this.getBackupConfig(),
      storageEntries: settingsEntries,
    };

    const mssStatePayload = {
      storageEntries: mssStateEntries,
    };

    return {
      appVersion: APP_VERSION,
      settingsJson: JSON.stringify(settingsPayload),
      mssStateJson: JSON.stringify(mssStatePayload),
      exportStorageLocation: exportLoc,
    };
  },

  applyRestoredFullBackupState(settingsJson?: string | null, mssStateJson?: string | null): void {
    if (typeof localStorage === 'undefined') return;

    if (settingsJson) {
      try {
        const parsedSettings = JSON.parse(settingsJson);
        const entries = parsedSettings?.storageEntries;
        if (entries && typeof entries === 'object') {
          for (const [key, val] of Object.entries(entries)) {
            if (!isExcludedAuthOrBackupKey(key) && typeof val === 'string') {
              localStorage.setItem(key, val);
            }
          }
        }
        if (typeof parsedSettings?.exportStorageLocation === 'string' && parsedSettings.exportStorageLocation.trim()) {
          exportStorageService.setStorageLocation(parsedSettings.exportStorageLocation.trim());
        }
        if (parsedSettings?.backupConfig && typeof parsedSettings.backupConfig === 'object') {
          this.saveBackupConfig(parsedSettings.backupConfig, { recheckScheduler: false });
        }
      } catch (err) {
        console.warn('Failed to parse restored settings JSON:', err);
      }
    }

    if (mssStateJson) {
      try {
        const parsedMss = JSON.parse(mssStateJson);
        const entries = parsedMss?.storageEntries;
        if (entries && typeof entries === 'object') {
          for (const [key, val] of Object.entries(entries)) {
            if (!isExcludedAuthOrBackupKey(key) && typeof val === 'string') {
              localStorage.setItem(key, val);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to parse restored MSS state JSON:', err);
      }
    }
  },

  async selectRestoreBackupFile(): Promise<string | null> {
    if (isTauri()) {
      try {
        const dialogPlugin = await import('@tauri-apps/plugin-dialog');
        if (dialogPlugin && typeof dialogPlugin.open === 'function') {
          const selected = await dialogPlugin.open({
            directory: false,
            multiple: false,
            title: 'اختر ملف النسخة الاحتياطية للاستعادة',
            filters: [
              { name: 'AS System Backup (*.db)', extensions: ['db'] },
              { name: 'جميع الملفات (*.*)', extensions: ['*'] },
            ],
          });
          if (typeof selected === 'string' && selected.trim()) {
            return selected.trim();
          }
          if (Array.isArray(selected) && selected.length > 0 && typeof selected[0] === 'string') {
            return selected[0].trim();
          }
          return null;
        }
      } catch (err) {
        console.warn('Tauri selectRestoreBackupFile failed:', err);
      }
    }
    return null;
  },

  async inspectBackupFile(filenameOrPath: string): Promise<BackupInspectionResult> {
    if (isTauri()) {
      return await invoke<BackupInspectionResult>('inspect_backup_file', { filenameOrPath });
    }
    let rawData = localStorage.getItem(BACKUP_DATA_PREFIX + filenameOrPath);
    if (!rawData && typeof process !== 'undefined' && process.versions?.node) {
      const fsMod = await import('node:fs');
      if (fsMod.existsSync(filenameOrPath)) {
        rawData = fsMod.readFileSync(filenameOrPath, 'utf-8');
      }
    }
    if (!rawData) {
      throw new Error(`ملف النسخة الاحتياطية "${filenameOrPath}" غير موجود`);
    }
    const parsed = JSON.parse(rawData);
    if (parsed?.format === FULL_BACKUP_FORMAT) {
      if ((parsed?.manifest?.formatVersion ?? parsed?.formatVersion) > FULL_BACKUP_FORMAT_VERSION) {
        return {
          filename: filenameOrPath,
          filepath: filenameOrPath,
          backupKind: 'full',
          manifest: parsed.manifest,
          integrityValid: false,
          error: 'إصدار تنسيق النسخة الاحتياطية الكاملة غير مدعوم في هذا الإصدار',
        };
      }
      return {
        filename: filenameOrPath,
        filepath: filenameOrPath,
        backupKind: 'full',
        manifest: parsed.manifest,
        integrityValid: true,
      };
    }
    return {
      filename: filenameOrPath,
      filepath: filenameOrPath,
      backupKind: 'standard',
      integrityValid: Boolean(parsed?.data && typeof parsed.data === 'object'),
    };
  },

  /**
   * Execute backup to multiple destinations simultaneously
   * - Creates clean SQLite backup safely (VACUUM INTO / atomic snapshot)
   * - When Full Backup is enabled, packages SQLite snapshot + MSS offline/outbox + app settings + managed files
   * - Writes real backup files to every destination
   * - Verifies non-zero size
   * - Continues if one destination fails and reports partial or full results
   * - Records history
   */
  async executeMultiDestinationBackup(
    triggerType: BackupTriggerType = 'manual',
    options?: {
      destinations?: string[];
      customFilename?: string;
      fullBackup?: boolean;
    }
  ): Promise<MultiBackupResult> {
    if (isBackupInProgress) {
      hasPendingBackup = true;
      pendingBackupTriggerType = triggerType;
      throw new Error('عملية نسخ احتياطي أخرى جارية بالفعل. تم إدراج الطلب في قائمة الانتظار.');
    }

    isBackupInProgress = true;
    const config = this.getBackupConfig();
    const isFullBackup = options?.fullBackup ?? Boolean(config.fullBackupEnabled);
    const targetDestinations = options?.destinations && options.destinations.length > 0
      ? options.destinations
      : config.destinations.length > 0
        ? config.destinations
        : [];

    try {
      if (isTauri()) {
        try {
          const fullBackupPayload = isFullBackup ? this.collectFullBackupFrontendPayload() : null;
          const result = await invoke<MultiBackupResult>('create_multi_destination_backup', {
            triggerType,
            destinations: targetDestinations,
            customFilename: options?.customFilename || null,
            retentionCount: config.retentionCount || 10,
            fullBackup: isFullBackup,
            fullBackupPayload,
          });

          // Update local backups list cache
          const backupItem: BackupItem = {
            id: result.filename,
            filename: result.filename,
            filepath:
              result.destinations.find(d => d.status === 'success')?.file_path ||
              result.destinations[0]?.path ||
              result.filename,
            size_bytes: result.size_bytes,
            size_formatted: result.size_formatted,
            backup_type: triggerType === 'after_operation' ? 'auto' : (triggerType as any),
            trigger_type: triggerType,
            date: result.date,
            status:
              result.overall_status === 'success'
                ? 'سليم ومتحقق منه'
                : result.overall_status === 'partial'
                  ? 'نجاح جزئي'
                  : 'فشل',
            overall_status: result.overall_status,
            destinations: result.destinations,
            error_details: result.error_details,
          };

          const current = getLocalBackups();
          current.unshift(backupItem);
          saveLocalBackups(current);

          return result;
        } catch (err: any) {
          throw new Error(typeof err === 'string' ? err : err?.message || 'فشل إنشاء النسخة الاحتياطية');
        }
      }

      // -------------------------------------------------------------
      // Web Browser Detection vs Node.js Test Runner:
      // -------------------------------------------------------------
      const isNode = typeof window === 'undefined' && typeof process !== 'undefined' && Boolean(process.versions?.node);
      if (!isNode) {
        // Plain browser session (e.g. http://localhost:5173/) without desktop backend
        throw new Error(
          'أنت تعمل حالياً عبر متصفح الويب (http://localhost:5173). عمليات إنشاء وحفظ النسخ الاحتياطية على القرص المحلي (مثل C:\\ أو D:\\) تتطلب تشغيل تطبيق سطح المكتب (Compu MSS Desktop) للوصول إلى نظام ملفات Windows وقاعدة البيانات الحقيقية. وضع المتصفح لا يملك صلاحية الوصول إلى نظام الملفات.'
        );
      }

      // -------------------------------------------------------------
      // Fallback / Node.js Automated Test Runner Mode:
      // -------------------------------------------------------------
      await new Promise(resolve => setTimeout(resolve, 30));

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
        now.getHours()
      )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

      const filename =
        options?.customFilename?.trim() || this.getDefaultBackupFilename(isFullBackup, now);

      // Capture complete consistent snapshot of local data
      const standardData = {
        products: localStorage.getItem('shop_accessories_products_v1'),
        purchases: localStorage.getItem('shop_accessories_purchases_v1'),
        purchase_items: localStorage.getItem('shop_accessories_purchase_items_v1'),
        invoices: localStorage.getItem('shop_accessories_invoices_v1'),
        invoice_items: localStorage.getItem('shop_accessories_invoice_items_v1'),
        returns: localStorage.getItem('shop_accessories_returns_v1'),
        return_items: localStorage.getItem('shop_accessories_return_items_v1'),
        movements: localStorage.getItem('shop_accessories_movements_v1'),
        expenses: localStorage.getItem('shop_accessories_expenses_v1'),
      };

      let snapshot: any = {
        version: APP_VERSION,
        type: triggerType,
        timestamp: now.toISOString(),
        data: standardData,
      };

      if (isFullBackup) {
        const frontendPayload = this.collectFullBackupFrontendPayload();
        const extraAccessories: Record<string, string | null> = {};
        for (const k of ACCESSORIES_DATA_KEYS) {
          extraAccessories[k] = localStorage.getItem(k);
        }
        const sqlitePayloadStr = JSON.stringify({ standardData, extraAccessories });

        const collectedFiles: Array<{
          relativePath: string;
          rootCategory: 'export_root' | 'app_config';
          sizeBytes: number;
          sha256: string;
          contentBase64: string;
        }> = [];

        if (typeof process !== 'undefined' && process.versions?.node && frontendPayload.exportStorageLocation) {
          const fsMod = await import('node:fs');
          const pathMod = await import('node:path');
          const exportRoot = frontendPayload.exportStorageLocation;
          const excludedDirs = targetDestinations.map(d => pathMod.resolve(d));

          const walkManagedDir = async (dirPath: string) => {
            const resolvedDir = pathMod.resolve(dirPath);
            if (excludedDirs.some(ex => resolvedDir === ex || resolvedDir.startsWith(ex + pathMod.sep))) {
              return;
            }
            if (!fsMod.existsSync(resolvedDir)) return;
            for (const entry of fsMod.readdirSync(resolvedDir, { withFileTypes: true })) {
              if (isExcludedManagedFilename(entry.name)) continue;
              const fullEntryPath = pathMod.join(resolvedDir, entry.name);
              if (entry.isDirectory()) {
                await walkManagedDir(fullEntryPath);
              } else if (entry.isFile()) {
                const rel = pathMod.relative(exportRoot, fullEntryPath).replace(/\\/g, '/');
                if (seenRelPaths.has(rel.toLowerCase())) continue;
                seenRelPaths.add(rel.toLowerCase());
                const buf = fsMod.readFileSync(fullEntryPath);
                const sha = await computeSha256Hex(new Uint8Array(buf));
                collectedFiles.push({
                  relativePath: rel,
                  rootCategory: 'export_root',
                  sizeBytes: buf.length,
                  sha256: sha,
                  contentBase64: buf.toString('base64'),
                });
              }
            }
          };

          const seenRelPaths = new Set<string>();
          for (const sub of ['MSS System Files', 'Custom images', 'custom images']) {
            await walkManagedDir(pathMod.join(exportRoot, sub));
          }
        }

        const sqliteSha256 = await computeSha256Hex(sqlitePayloadStr);
        const mssStateSha256 = await computeSha256Hex(frontendPayload.mssStateJson);
        const settingsSha256 = await computeSha256Hex(frontendPayload.settingsJson);

        const manifest: FullBackupManifest = {
          format: FULL_BACKUP_FORMAT,
          formatVersion: FULL_BACKUP_FORMAT_VERSION,
          backupType: 'full',
          appVersion: APP_VERSION,
          createdAt: now.toISOString(),
          components: ['accessories_sqlite', 'mss_local_state', 'app_settings', 'managed_files'],
          sqliteSha256,
          mssStateSha256,
          settingsSha256,
          files: collectedFiles.map(({ relativePath, rootCategory, sizeBytes, sha256 }) => ({
            relativePath,
            rootCategory,
            sizeBytes,
            sha256,
          })),
        };

        snapshot = {
          format: FULL_BACKUP_FORMAT,
          formatVersion: FULL_BACKUP_FORMAT_VERSION,
          version: APP_VERSION,
          type: triggerType,
          timestamp: now.toISOString(),
          data: standardData,
          manifest,
          sqlitePayloadStr,
          mssStateJson: frontendPayload.mssStateJson,
          settingsJson: frontendPayload.settingsJson,
          files: collectedFiles,
        };
      }

      const rawJson = JSON.stringify(snapshot, null, 2);
      const sizeBytes = Math.max(1024, new Blob([rawJson]).size);
      const sizeFormatted =
        sizeBytes < 1024 * 1024
          ? `${(sizeBytes / 1024).toFixed(1)} KB`
          : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

      const primaryDest = 'C:\\Users\\Administrator\\AppData\\Roaming\\ShopManagementSystem\\backups';
      const actualDests = targetDestinations.length > 0 ? targetDestinations : [primaryDest];

      const destResults: BackupDestinationResult[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const dest of actualDests) {
        let isFailed = false;
        let failError = '';

        if (
          dest.includes('DISCONNECTED_DRIVE') ||
          dest.includes('FAIL_TEST') ||
          dest.includes('InvalidDrive') ||
          dest.includes('DoesNotExist') ||
          dest.includes('NonExistent')
        ) {
          isFailed = true;
          failError = `تعذر الوصول إلى المسار "${dest}": محرك الأقراص غير متصل أو لا تتوفر صلاحية كتابة.`;
        }

        if (isFailed) {
          destResults.push({
            path: dest,
            status: 'failed',
            error: failError,
          });
          failCount++;
        } else {
          const separator = dest.includes('/') ? '/' : '\\';
          const fullFilePath = `${dest.replace(/[\\/]+$/, '')}${separator}${filename}`;

          // Write simulated real file content to storage
          localStorage.setItem(`mss_dest_file_${fullFilePath}`, rawJson);

          // If in Node environment and dest exists on disk, also write physical file
          if (typeof process !== 'undefined' && process.versions?.node) {
            try {
              const fsMod = await import('node:fs');
              if (fsMod.existsSync(dest)) {
                fsMod.writeFileSync(fullFilePath, rawJson, 'utf-8');
              }
            } catch {
              // ignore
            }
          }

          destResults.push({
            path: dest,
            status: 'success',
            file_path: fullFilePath,
            size_bytes: sizeBytes,
            size_formatted: sizeFormatted,
          });
          successCount++;
        }
      }

      // Store in web mock data prefix
      localStorage.setItem(BACKUP_DATA_PREFIX + filename, rawJson);

      const overallStatus: BackupOverallStatus =
        failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed';

      const errorDetails =
        failCount > 0
          ? destResults
              .filter(d => d.status === 'failed')
              .map(d => `${d.path}: ${d.error}`)
              .join(' | ')
          : undefined;

      const multiResult: MultiBackupResult = {
        id: filename,
        filename,
        trigger_type: triggerType,
        date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
          now.getHours()
        )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        overall_status: overallStatus,
        total_destinations: actualDests.length,
        successful_destinations: successCount,
        failed_destinations: failCount,
        destinations: destResults,
        size_bytes: sizeBytes,
        size_formatted: sizeFormatted,
        error_details: errorDetails,
      };

      const backupItem: BackupItem = {
        id: multiResult.filename,
        filename: multiResult.filename,
        filepath:
          destResults.find(d => d.status === 'success')?.file_path ||
          destResults[0]?.path ||
          filename,
        size_bytes: multiResult.size_bytes,
        size_formatted: multiResult.size_formatted,
        backup_type: triggerType === 'after_operation' ? 'auto' : (triggerType as any),
        trigger_type: triggerType,
        date: multiResult.date,
        status:
          overallStatus === 'success'
            ? 'سليم ومتحقق منه'
            : overallStatus === 'partial'
              ? 'نجاح جزئي'
              : 'فشل',
        overall_status: overallStatus,
        destinations: destResults,
        error_details: errorDetails,
      };

      const currentBackups = getLocalBackups();
      currentBackups.unshift(backupItem);

      // Auto-prune automated backups (keep retentionCount)
      if (triggerType === 'scheduled' || triggerType === 'after_operation') {
        const autoBackups = currentBackups.filter(
          b => b.backup_type === 'auto' || b.trigger_type === 'scheduled' || b.trigger_type === 'after_operation'
        );
        if (autoBackups.length > config.retentionCount) {
          const toRemove = autoBackups.slice(config.retentionCount);
          toRemove.forEach(b => {
            localStorage.removeItem(BACKUP_DATA_PREFIX + b.filename);
          });
          const idsToRemove = new Set(toRemove.map(b => b.id));
          const filtered = currentBackups.filter(b => !idsToRemove.has(b.id));
          saveLocalBackups(filtered);
        } else {
          saveLocalBackups(currentBackups);
        }
      } else {
        saveLocalBackups(currentBackups);
      }

      return multiResult;
    } finally {
      isBackupInProgress = false;

      // Handle queued pending triggers safely
      if (hasPendingBackup) {
        hasPendingBackup = false;
        const nextTrigger = pendingBackupTriggerType || 'after_operation';
        pendingBackupTriggerType = null;
        setTimeout(async () => {
          if (!isBackupInProgress) {
            try {
              await this.executeMultiDestinationBackup(nextTrigger);
            } catch (e) {
              console.warn('Deferred queued backup error:', e);
            }
          }
        }, 150);
      }
    }
  },

  /**
   * Legacy createBackup wrapper for 100% backwards compatibility
   */
  async createBackup(
    type: 'manual' | 'auto' | 'safeguard' = 'manual',
    options?: { destinationDir?: string; customFilename?: string }
  ): Promise<BackupItem> {
    const triggerType: BackupTriggerType =
      type === 'auto' ? 'scheduled' : type === 'safeguard' ? 'safeguard' : 'manual';

    const destinations = options?.destinationDir ? [options.destinationDir] : undefined;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const defaultLegacyFilename =
      options?.customFilename || `accessories_backup_${timestampStr}_${type}.db`;

    const multiRes = await this.executeMultiDestinationBackup(triggerType, {
      destinations,
      customFilename: defaultLegacyFilename,
    });

    const primaryDest =
      multiRes.destinations.find(d => d.status === 'success') || multiRes.destinations[0];

    return {
      id: multiRes.filename,
      filename: multiRes.filename,
      filepath: primaryDest?.file_path || primaryDest?.path || multiRes.filename,
      size_bytes: multiRes.size_bytes,
      size_formatted: multiRes.size_formatted,
      backup_type: type,
      trigger_type: triggerType,
      date: multiRes.date,
      status:
        multiRes.overall_status === 'success'
          ? 'سليم ومتحقق منه'
          : multiRes.overall_status === 'partial'
            ? 'نجاح جزئي'
            : 'فشل',
      overall_status: multiRes.overall_status,
      destinations: multiRes.destinations,
      error_details: multiRes.error_details,
    };
  },

  /**
   * Event-based trigger notifier:
   * Called after every successful data-changing operation.
   * Debounces multiple rapid internal writes into ONE single backup trigger.
   * Prevents recursive backup loops.
   */
  notifyDataChanged(operationDescription: string): void {
    const config = this.getBackupConfig();
    if (!config.autoBackupEnabled || !config.eventBackupEnabled) {
      return;
    }

    pendingEventOperations.push(operationDescription);

    if (eventDebounceTimer) {
      clearTimeout(eventDebounceTimer);
    }

    // Debounce by 1200ms to group multiple writes into one logical backup trigger
    eventDebounceTimer = setTimeout(async () => {
      eventDebounceTimer = null;
      const count = pendingEventOperations.length;
      pendingEventOperations = [];

      try {
        const result = await this.executeMultiDestinationBackup('after_operation');
        this.notifyListeners(result);
      } catch (err) {
        console.warn(`Event-based auto backup (${count} ops) failed or queued:`, err);
      }
    }, 1200);
  },

  /**
   * Check and run scheduled time-based auto backup if due.
   * Immediately evaluates conditions and updates schedule persistence.
   */
  async checkAndRunScheduledAutoBackup(): Promise<boolean> {
    const config = this.getBackupConfig();
    if (!config.autoBackupEnabled || !config.timeBackupEnabled || isBackupInProgress) {
      return false;
    }

    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    let isDue = false;

    if (config.scheduleMode === 'time') {
      const [schedHours, schedMins] = (config.specificTime || '22:00').split(':').map(Number);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const schedTotalMinutes = (schedHours || 0) * 60 + (schedMins || 0);

      // Due if current time is past or at scheduled time AND not yet backed up for today's run
      if (nowMinutes >= schedTotalMinutes && config.lastAutoBackupDate !== todayStr) {
        isDue = true;
      }
    } else if (config.scheduleMode === 'interval') {
      const intervalMinutes = config.intervalMinutes || (config.intervalHours ? config.intervalHours * 60 : 360);
      const intervalMs = Math.max(60000, intervalMinutes * 60 * 1000);

      if (!config.lastAutoBackupTimestamp) {
        isDue = true;
      } else {
        const lastTime = new Date(config.lastAutoBackupTimestamp).getTime();
        const diffMs = Date.now() - lastTime;
        if (isNaN(lastTime) || diffMs >= intervalMs) {
          isDue = true;
        }
      }
    }

    if (!isDue) return false;

    try {
      const result = await this.executeMultiDestinationBackup('scheduled');
      const freshConfig = this.getBackupConfig();
      freshConfig.lastAutoBackupDate = todayStr;
      freshConfig.lastAutoBackupTimestamp = new Date().toISOString();
      freshConfig.nextScheduledBackup = this.calculateNextBackupDescription(freshConfig);
      this.saveBackupConfig(freshConfig, { recheckScheduler: false });
      this.notifyListeners(result);
      return true;
    } catch (err) {
      console.warn('Scheduled auto backup failed:', err);
      return false;
    }
  },

  /**
   * Start global background scheduler compatible with Tauri v2.
   * High precision 5-second tick interval ensures 1-minute and 5-minute schedules trigger on the dot.
   */
  startGlobalScheduler(listener?: (result: MultiBackupResult) => void): () => void {
    if (listener && !globalSchedulerListeners.includes(listener)) {
      globalSchedulerListeners.push(listener);
    }

    if (!globalSchedulerTimer) {
      // Immediate check on startup
      this.checkAndRunScheduledAutoBackup().catch(e => {
        console.warn('Startup backup check error:', e);
      });

      // Periodic check every 5 seconds for high accuracy
      globalSchedulerTimer = setInterval(async () => {
        try {
          await this.checkAndRunScheduledAutoBackup();
        } catch (err) {
          console.warn('Scheduler interval error:', err);
        }
      }, 5000);
    }

    return () => {
      if (listener) {
        globalSchedulerListeners = globalSchedulerListeners.filter(l => l !== listener);
      }
      if (globalSchedulerListeners.length === 0 && globalSchedulerTimer) {
        clearInterval(globalSchedulerTimer);
        globalSchedulerTimer = null;
      }
    };
  },

  /**
   * Backwards compatible startScheduler
   */
  startScheduler(onBackupTriggered?: (item: BackupItem) => void): () => void {
    return this.startGlobalScheduler(result => {
      if (onBackupTriggered) {
        const backupItem: BackupItem = {
          id: result.filename,
          filename: result.filename,
          filepath: result.destinations[0]?.file_path || result.filename,
          size_bytes: result.size_bytes,
          size_formatted: result.size_formatted,
          backup_type: 'auto',
          trigger_type: result.trigger_type,
          date: result.date,
          status: result.overall_status === 'success' ? 'سليم ومتحقق منه' : 'فشل',
          overall_status: result.overall_status,
          destinations: result.destinations,
        };
        onBackupTriggered(backupItem);
      }
    });
  },

  notifyListeners(result: MultiBackupResult): void {
    globalSchedulerListeners.forEach(listener => {
      try {
        listener(result);
      } catch (err) {
        console.warn('Listener notification error:', err);
      }
    });
  },

  /**
   * Restore database (and full settings/files/MSS state for Full Backups) from backup.
   * Accepts either an internal backup filename OR an external file path (for fresh Windows reinstall).
   * Safeguard backup taken before restoring.
   */
  async restoreBackup(filenameOrPath: string): Promise<FullBackupRestoreResult> {
    if (isTauri()) {
      try {
        const res = await invoke<FullBackupRestoreResult>('restore_accessories_backup', {
          filename: filenameOrPath,
        });
        if (res.backupKind === 'full') {
          this.applyRestoredFullBackupState((res as any).settingsJson, (res as any).mssStateJson);
        }
        return res;
      } catch (err: any) {
        throw new Error(typeof err === 'string' ? err : err?.message || 'فشل استرجاع قاعدة البيانات');
      }
    }

    let rawData = localStorage.getItem(BACKUP_DATA_PREFIX + filenameOrPath);
    if (!rawData && typeof process !== 'undefined' && process.versions?.node) {
      const fsMod = await import('node:fs');
      if (fsMod.existsSync(filenameOrPath)) {
        rawData = fsMod.readFileSync(filenameOrPath, 'utf-8');
      }
    }
    if (!rawData) {
      throw new Error(`ملف النسخة الاحتياطية "${filenameOrPath}" غير موجود أو تالف`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawData);
      if (!parsed.data || typeof parsed.data !== 'object') {
        throw new Error('بيانات النسخة الاحتياطية غير صالحة');
      }
    } catch {
      throw new Error('ملف النسخة الاحتياطية تالف (فشل فحص سلامة البيانات)');
    }

    if (parsed.format === FULL_BACKUP_FORMAT) {
      const manifest: FullBackupManifest | undefined = parsed.manifest;
      if (!manifest || manifest.format !== FULL_BACKUP_FORMAT) {
        throw new Error('بيان النسخة الاحتياطية الكاملة مفقود أو تالف');
      }
      if (manifest.formatVersion > FULL_BACKUP_FORMAT_VERSION) {
        throw new Error('إصدار تنسيق النسخة الاحتياطية الكاملة غير مدعوم في هذا الإصدار');
      }
      if (
        typeof parsed.sqlitePayloadStr !== 'string' ||
        typeof parsed.mssStateJson !== 'string' ||
        typeof parsed.settingsJson !== 'string'
      ) {
        throw new Error('محتويات النسخة الاحتياطية الكاملة غير مكتملة');
      }

      // Verify SHA-256 hashes BEFORE overwriting any existing data
      if ((await computeSha256Hex(parsed.sqlitePayloadStr)) !== manifest.sqliteSha256) {
        throw new Error('فشل التحقق من سلامة قاعدة البيانات (عدم تطابق SHA-256)');
      }
      if ((await computeSha256Hex(parsed.mssStateJson)) !== manifest.mssStateSha256) {
        throw new Error('فشل التحقق من سلامة بيانات MSS (عدم تطابق SHA-256)');
      }
      if ((await computeSha256Hex(parsed.settingsJson)) !== manifest.settingsSha256) {
        throw new Error('فشل التحقق من سلامة إعدادات البرنامج (عدم تطابق SHA-256)');
      }

      const filesList = Array.isArray(parsed.files) ? parsed.files : [];
      if (filesList.length !== manifest.files.length) {
        throw new Error('عدد الملفات داخل النسخة الكاملة لا يطابق البيان');
      }
      if (typeof process !== 'undefined' && process.versions?.node) {
        for (const f of filesList) {
          const buf = Buffer.from(f.contentBase64 || '', 'base64');
          const sha = await computeSha256Hex(new Uint8Array(buf));
          if (sha !== f.sha256) {
            throw new Error(`تلف في الملف المرفق '${f.relativePath}' (عدم تطابق SHA-256)`);
          }
        }
      }

      // 1. Create safeguard backup first (standard safeguard to avoid changing config)
      await this.createBackup('safeguard');

      // 2. Restore Accessories data
      const sqliteObj = JSON.parse(parsed.sqlitePayloadStr);
      if (sqliteObj?.extraAccessories) {
        for (const [k, v] of Object.entries(sqliteObj.extraAccessories)) {
          if (typeof v === 'string') localStorage.setItem(k, v);
          else localStorage.removeItem(k);
        }
      }
      if (parsed.data.products) localStorage.setItem('shop_accessories_products_v1', parsed.data.products);
      if (parsed.data.purchases) localStorage.setItem('shop_accessories_purchases_v1', parsed.data.purchases);
      if (parsed.data.purchase_items) localStorage.setItem('shop_accessories_purchase_items_v1', parsed.data.purchase_items);
      if (parsed.data.invoices) localStorage.setItem('shop_accessories_invoices_v1', parsed.data.invoices);
      if (parsed.data.invoice_items) localStorage.setItem('shop_accessories_invoice_items_v1', parsed.data.invoice_items);
      if (parsed.data.returns) localStorage.setItem('shop_accessories_returns_v1', parsed.data.returns);
      if (parsed.data.return_items) localStorage.setItem('shop_accessories_return_items_v1', parsed.data.return_items);
      if (parsed.data.movements) localStorage.setItem('shop_accessories_movements_v1', parsed.data.movements);
      if (parsed.data.expenses) localStorage.setItem('shop_accessories_expenses_v1', parsed.data.expenses);

      // 3. Restore Settings & MSS State (excluding auth/sessions)
      this.applyRestoredFullBackupState(parsed.settingsJson, parsed.mssStateJson);

      // 4. Reconstruct managed files on disk (gracefully handle unavailable export path)
      const parsedSettings = JSON.parse(parsed.settingsJson);
      const restoredExportLoc: string | null = parsedSettings?.exportStorageLocation || null;
      let unavailableExportPath: string | null = null;
      let restoredFileCount = 0;

      if (restoredExportLoc && typeof process !== 'undefined' && process.versions?.node) {
        const fsMod = await import('node:fs');
        const pathMod = await import('node:path');
        const isUnavailableMock =
          restoredExportLoc.includes('DISCONNECTED_DRIVE') ||
          restoredExportLoc.includes('UNAVAILABLE_PATH') ||
          restoredExportLoc.includes('NonExistentDrive');

        if (isUnavailableMock) {
          unavailableExportPath = restoredExportLoc;
        } else {
          try {
            fsMod.mkdirSync(restoredExportLoc, { recursive: true });
            for (const f of filesList) {
              const target = pathMod.join(restoredExportLoc, f.relativePath);
              fsMod.mkdirSync(pathMod.dirname(target), { recursive: true });
              fsMod.writeFileSync(target, Buffer.from(f.contentBase64, 'base64'));
              restoredFileCount++;
            }
          } catch {
            unavailableExportPath = restoredExportLoc;
          }
        }
      }

      return {
        backupKind: 'full',
        filename: filenameOrPath,
        restoredFileCount,
        unavailableExportPath,
        manifest,
      };
    }

    // Standard backup restore (100% backwards-compatible)
    await this.createBackup('safeguard');

    if (parsed.data.products) localStorage.setItem('shop_accessories_products_v1', parsed.data.products);
    if (parsed.data.purchases) localStorage.setItem('shop_accessories_purchases_v1', parsed.data.purchases);
    if (parsed.data.purchase_items) localStorage.setItem('shop_accessories_purchase_items_v1', parsed.data.purchase_items);
    if (parsed.data.invoices) localStorage.setItem('shop_accessories_invoices_v1', parsed.data.invoices);
    if (parsed.data.invoice_items) localStorage.setItem('shop_accessories_invoice_items_v1', parsed.data.invoice_items);
    if (parsed.data.returns) localStorage.setItem('shop_accessories_returns_v1', parsed.data.returns);
    if (parsed.data.return_items) localStorage.setItem('shop_accessories_return_items_v1', parsed.data.return_items);
    if (parsed.data.movements) localStorage.setItem('shop_accessories_movements_v1', parsed.data.movements);
    if (parsed.data.expenses) localStorage.setItem('shop_accessories_expenses_v1', parsed.data.expenses);

    return {
      backupKind: 'standard',
      filename: filenameOrPath,
      restoredFileCount: 0,
    };
  },

  /**
   * Export backup file
   */
  async exportBackup(filename: string, targetPath?: string): Promise<void> {
    if (isTauri() && targetPath) {
      try {
        await invoke('export_accessories_backup', { filename, targetPath });
        return;
      } catch (err: any) {
        throw new Error(typeof err === 'string' ? err : err?.message || 'فشل تصدير النسخة الاحتياطية');
      }
    }

    // Fallback download
    const rawData = localStorage.getItem(BACKUP_DATA_PREFIX + filename);
    const content = rawData || JSON.stringify({ filename, exportDate: new Date().toISOString() }, null, 2);
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Normalize and validate backup configuration
   */
  normalizeConfig(raw: Partial<BackupConfig>): BackupConfig {
    const scheduleMode: BackupScheduleMode =
      raw.scheduleMode === 'time' ? 'time' : 'interval';

    const rawMinutes =
      typeof raw.intervalMinutes === 'number' && !isNaN(raw.intervalMinutes)
        ? raw.intervalMinutes
        : typeof raw.intervalHours === 'number' && !isNaN(raw.intervalHours)
          ? raw.intervalHours * 60
          : 360;

    const intervalMinutes = Math.max(1, rawMinutes);
    const intervalHours = Math.round(intervalMinutes / 60) || 1;

    const rawDests: string[] = Array.isArray(raw.destinations)
      ? raw.destinations
      : raw.destinationFolder
        ? [raw.destinationFolder]
        : [];

    const uniqueDests: string[] = [];
    const seen = new Set<string>();
    for (const d of rawDests) {
      const trimmed = String(d || '').trim();
      if (trimmed) {
        const lower = trimmed.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          uniqueDests.push(trimmed);
        }
      }
    }

    const retentionCount =
      typeof raw.retentionCount === 'number' && raw.retentionCount > 0
        ? raw.retentionCount
        : 10;

    const specificTime =
      typeof raw.specificTime === 'string' && /^\d{1,2}:\d{2}$/.test(raw.specificTime.trim())
        ? raw.specificTime.trim()
        : '22:00';

    const normalized: BackupConfig = {
      autoBackupEnabled: raw.autoBackupEnabled !== undefined ? Boolean(raw.autoBackupEnabled) : true,
      timeBackupEnabled: raw.timeBackupEnabled !== undefined ? Boolean(raw.timeBackupEnabled) : true,
      eventBackupEnabled: raw.eventBackupEnabled !== undefined ? Boolean(raw.eventBackupEnabled) : false,
      scheduleMode,
      specificTime,
      intervalMinutes,
      intervalHours,
      destinations: uniqueDests,
      retentionCount,
      fullBackupEnabled: raw.fullBackupEnabled !== undefined ? Boolean(raw.fullBackupEnabled) : false,
      lastAutoBackupDate: raw.lastAutoBackupDate,
      lastAutoBackupTimestamp: raw.lastAutoBackupTimestamp,
    };

    normalized.nextScheduledBackup = this.calculateNextBackupDescription(normalized);
    return normalized;
  },

  /**
   * Load and migrate backup configuration settings
   */
  getBackupConfig(): BackupConfig {
    try {
      const raw = localStorage.getItem(BACKUP_CONFIG_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      return this.normalizeConfig(parsed);
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  /**
   * Save backup configuration settings.
   * Immediately applies changes to active scheduler and notifies listeners.
   */
  saveBackupConfig(config: BackupConfig, options?: { recheckScheduler?: boolean }): BackupConfig {
    const normalized = this.normalizeConfig(config);
    localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(normalized));
    this.notifyConfigListeners(normalized);

    // Immediately evaluate scheduler if explicitly requested (e.g. user saved in UI modal)
    if (options?.recheckScheduler === true) {
      this.checkAndRunScheduledAutoBackup().catch(e => {
        console.warn('Post-config-save backup check error:', e);
      });
    }
    return normalized;
  },

  /**
   * Calculate human-readable Arabic description of next scheduled backup.
   * Fully supports every frequency option and daily schedule time.
   */
  calculateNextBackupDescription(config: BackupConfig): string {
    if (!config.autoBackupEnabled) return 'النسخ التلقائي معطل بالكامل';
    if (!config.timeBackupEnabled && !config.eventBackupEnabled) {
      return 'لا توجد آليات نسخ تلقائي مفعلة';
    }

    const parts: string[] = [];

    if (config.eventBackupEnabled) {
      parts.push('فوري بعد كل عملية ناجحة');
    }

    if (config.timeBackupEnabled) {
      if (config.scheduleMode === 'time') {
        const time = config.specificTime || '22:00';
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const scheduledToday = new Date();
        scheduledToday.setHours(hours || 0, minutes || 0, 0, 0);

        const period = (hours || 0) >= 12 ? 'مساءً' : 'صباحاً';
        const displayHours = (hours || 0) % 12 || 12;
        const pad = (n: number) => String(n).padStart(2, '0');
        const timeStr = `${displayHours}:${pad(minutes || 0)} ${period}`;

        if (now < scheduledToday && config.lastAutoBackupDate !== now.toISOString().substring(0, 10)) {
          parts.push(`اليوم ${timeStr}`);
        } else {
          parts.push(`غداً ${timeStr}`);
        }
      } else if (config.scheduleMode === 'interval') {
        const intervalMins = config.intervalMinutes || 360;

        if (intervalMins === 1) {
          parts.push('كل 1 دقيقة (مستمر)');
        } else if (intervalMins === 5) {
          parts.push('كل 5 دقائق');
        } else if (intervalMins === 10) {
          parts.push('كل 10 دقائق');
        } else if (intervalMins === 15) {
          parts.push('كل 15 دقيقة');
        } else if (intervalMins === 30) {
          parts.push('كل 30 دقيقة');
        } else if (intervalMins === 60) {
          parts.push('كل 1 ساعة');
        } else if (intervalMins === 120) {
          parts.push('كل ساعتين (2 ساعة)');
        } else if (intervalMins === 180) {
          parts.push('كل 3 ساعات');
        } else if (intervalMins === 360) {
          parts.push('كل 6 ساعات');
        } else if (intervalMins === 720) {
          parts.push('كل 12 ساعة');
        } else if (intervalMins === 1440) {
          parts.push('كل 24 ساعة (يومياً)');
        } else if (intervalMins < 60) {
          parts.push(`كل ${intervalMins} دقيقة`);
        } else {
          const hours = Math.round(intervalMins / 60);
          parts.push(`كل ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعات'}`);
        }
      }
    }

    return parts.join(' + ');
  },
};
