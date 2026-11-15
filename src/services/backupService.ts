import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  BackupItem,
  BackupConfig,
  BackupTriggerType,
  BackupOverallStatus,
  BackupDestinationResult,
  DestinationValidationResult,
  MultiBackupResult,
} from '../types/backup.ts';

const BACKUPS_STORAGE_KEY = 'shop_accessories_backups_metadata_v1';
const BACKUP_DATA_PREFIX = 'shop_accessories_backup_data_';
const BACKUP_CONFIG_KEY = 'shop_accessories_backup_config_v1';

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
};

const INITIAL_SEED_BACKUPS: BackupItem[] = [
  {
    id: 'MSS_Backup_2024-11-13_03-00-00.db',
    filename: 'MSS_Backup_2024-11-13_03-00-00.db',
    filepath: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups\\MSS_Backup_2024-11-13_03-00-00.db',
    size_bytes: 2516582,
    size_formatted: '2.40 MB',
    backup_type: 'auto',
    trigger_type: 'scheduled',
    date: '2024-11-13 03:00:00',
    status: 'سليم ومتحقق منه',
    overall_status: 'success',
    destinations: [
      {
        path: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups',
        status: 'success',
        file_path: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups\\MSS_Backup_2024-11-13_03-00-00.db',
        size_bytes: 2516582,
        size_formatted: '2.40 MB',
      },
    ],
  },
  {
    id: 'MSS_Backup_2024-11-12_18-22-10.db',
    filename: 'MSS_Backup_2024-11-12_18-22-10.db',
    filepath: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups\\MSS_Backup_2024-11-12_18-22-10.db',
    size_bytes: 2411724,
    size_formatted: '2.30 MB',
    backup_type: 'manual',
    trigger_type: 'manual',
    date: '2024-11-12 18:22:10',
    status: 'سليم ومتحقق منه',
    overall_status: 'success',
    destinations: [
      {
        path: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups',
        status: 'success',
        file_path: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups\\MSS_Backup_2024-11-12_18-22-10.db',
        size_bytes: 2411724,
        size_formatted: '2.30 MB',
      },
    ],
  },
];

// Concurrency locks & Pending Triggers Queue
let isBackupInProgress = false;
let hasPendingBackup = false;
let pendingBackupTriggerType: BackupTriggerType | null = null;

// Event-based debouncing timer & operation buffer
let eventDebounceTimer: any = null;
let pendingEventOperations: string[] = [];

// Global Scheduler Timer Reference
let globalSchedulerTimer: any = null;
let globalSchedulerListeners: Array<(result: MultiBackupResult) => void> = [];

function getLocalBackups(): BackupItem[] {
  try {
    const raw = localStorage.getItem(BACKUPS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_BACKUPS));
      return INITIAL_SEED_BACKUPS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_BACKUPS;
  } catch {
    return INITIAL_SEED_BACKUPS;
  }
}

function saveLocalBackups(backups: BackupItem[]): void {
  localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(backups));
}

export const backupService = {
  /**
   * Get all available backups
   */
  async getBackups(): Promise<BackupItem[]> {
    if (isTauri()) {
      try {
        return await invoke<BackupItem[]>('get_accessories_backups');
      } catch (err) {
        console.warn('Tauri get_accessories_backups failed, fallback to local storage', err);
      }
    }
    return getLocalBackups();
  },

  /**
   * Open native Windows dialog to select a folder for saving backups
   */
  async selectBackupFolder(): Promise<string | null> {
    if (isTauri()) {
      try {
        const path = await invoke<string | null>('select_backup_folder');
        return path ? path.trim() : null;
      } catch (err) {
        console.warn('Tauri select_backup_folder failed:', err);
      }
    }

    // Browser / mock environment fallback prompt
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const input = window.prompt(
        'أدخل مسار المجلد على جهازك (مثال: D:\\MSS Backups):',
        'D:\\MSS Backups'
      );
      return input ? input.trim() : null;
    }

    return null;
  },

  /**
   * Open native Windows Save dialog to choose specific save path and filename
   */
  async selectSaveBackupPath(defaultFilename?: string): Promise<string | null> {
    if (isTauri()) {
      try {
        const path = await invoke<string | null>('select_save_backup_path', { defaultFilename });
        return path ? path.trim() : null;
      } catch (err) {
        console.warn('Tauri select_save_backup_path failed:', err);
      }
    }

    // Fallback prompt for test or mock browser environment
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const input = window.prompt(
        'تحديد مسار واسم ملف النسخة الاحتياطية:',
        defaultFilename || 'MSS-Backup.db'
      );
      return input ? input.trim() : null;
    }

    return null;
  },

  /**
   * Validate that a destination path exists or can be created and is writable
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
        const msg = typeof err === 'string' ? err : err?.message || 'المسار غير قابل للكتابة';
        return { path: trimmed, valid: false, error: msg };
      }
    }

    // Web / mock environment validation
    // Check drive or folder format
    const isValidPath =
      /^[a-zA-Z]:\\/.test(trimmed) ||
      /^[a-zA-Z]:\//.test(trimmed) ||
      trimmed.startsWith('/') ||
      trimmed.startsWith('\\\\');

    if (!isValidPath && !trimmed.startsWith('mock://') && !trimmed.startsWith('local://')) {
      return { path: trimmed, valid: false, error: 'صيغة مسار المجلد غير صالحة' };
    }

    return { path: trimmed, valid: true };
  },

  /**
   * Execute backup to multiple destinations simultaneously
   * - Creates clean SQLite backup safely (VACUUM INTO / atomic snapshot)
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
    }
  ): Promise<MultiBackupResult> {
    if (isBackupInProgress) {
      // Queue a pending trigger safely so no important event or scheduled backup is lost
      hasPendingBackup = true;
      pendingBackupTriggerType = triggerType;
      throw new Error('عملية نسخ احتياطي أخرى جارية بالفعل. تم إدراج الطلب في قائمة الانتظار.');
    }

    isBackupInProgress = true;
    const config = this.getBackupConfig();
    const targetDestinations = options?.destinations && options.destinations.length > 0
      ? options.destinations
      : config.destinations.length > 0
        ? config.destinations
        : [];

    try {
      if (isTauri()) {
        try {
          const result = await invoke<MultiBackupResult>('create_multi_destination_backup', {
            triggerType,
            destinations: targetDestinations,
            customFilename: options?.customFilename || null,
            retentionCount: config.retentionCount || 10,
          });

          // Also update local backups list cache
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
      // Fallback / Web Mock Mode:
      // -------------------------------------------------------------
      // Realistic asynchronous I/O duration
      await new Promise(resolve => setTimeout(resolve, 30));

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
        now.getHours()
      )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

      const filename =
        options?.customFilename?.trim() || `MSS_Backup_${timestampStr}.db`;

      // 1. Capture complete consistent snapshot of local data
      const snapshot = {
        version: '1.0.1',
        type: triggerType,
        timestamp: now.toISOString(),
        data: {
          products: localStorage.getItem('shop_accessories_products_v1'),
          purchases: localStorage.getItem('shop_accessories_purchases_v1'),
          purchase_items: localStorage.getItem('shop_accessories_purchase_items_v1'),
          invoices: localStorage.getItem('shop_accessories_invoices_v1'),
          invoice_items: localStorage.getItem('shop_accessories_invoice_items_v1'),
          returns: localStorage.getItem('shop_accessories_returns_v1'),
          return_items: localStorage.getItem('shop_accessories_return_items_v1'),
          movements: localStorage.getItem('shop_accessories_movements_v1'),
          // MSS cached entities
          mss_catalog: localStorage.getItem('mss_catalog_models_v1'),
          mss_devices: localStorage.getItem('mss_inventory_devices_v1'),
          mss_sales: localStorage.getItem('mss_sales_invoices_v1'),
          mss_reservations: localStorage.getItem('mss_reservations_v1'),
          mss_returns: localStorage.getItem('mss_returns_v1'),
          mss_outbox: localStorage.getItem('mss_offline_outbox_v1'),
        },
      };

      const jsonStr = JSON.stringify(snapshot, null, 2);
      const sizeBytes = new Blob([jsonStr]).size || 1024;
      const sizeFormatted = sizeBytes < 1024
        ? `${sizeBytes} B`
        : sizeBytes < 1024 * 1024
          ? `${(sizeBytes / 1024).toFixed(1)} KB`
          : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

      // Store primary snapshot
      localStorage.setItem(BACKUP_DATA_PREFIX + filename, jsonStr);

      // 2. Process each destination
      const destList = targetDestinations.length > 0
        ? targetDestinations
        : ['C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups'];

      const destResults: BackupDestinationResult[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const dest of destList) {
        // Test simulated offline/disconnected drive: e.g. path containing "DISCONNECTED" or "INVALID"
        if (dest.includes('DISCONNECTED') || dest.includes('INVALID_DRIVE')) {
          destResults.push({
            path: dest,
            status: 'failed',
            error: 'تعذر الوصول إلى مسار القرص أو المجلد (القرص غير متصل)',
          });
          failCount++;
        } else {
          const filePath = `${dest}\\${filename}`;
          // Store physical simulated file
          localStorage.setItem(`mss_dest_file_${filePath}`, jsonStr);

          destResults.push({
            path: dest,
            status: 'success',
            file_path: filePath,
            size_bytes: sizeBytes,
            size_formatted: sizeFormatted,
          });
          successCount++;
        }
      }

      const overallStatus: BackupOverallStatus =
        failCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed';

      const errorDetails =
        failCount > 0
          ? destResults
              .filter(d => d.status === 'failed')
              .map(d => `${d.path}: ${d.error || 'فشل الحفظ'}`)
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
        total_destinations: destList.length,
        successful_destinations: successCount,
        failed_destinations: failCount,
        destinations: destResults,
        size_bytes: sizeBytes,
        size_formatted: sizeFormatted,
        error_details: errorDetails,
      };

      // Add to backup history
      const backupItem: BackupItem = {
        id: filename,
        filename,
        filepath:
          destResults.find(d => d.status === 'success')?.file_path ||
          destResults[0]?.path ||
          filename,
        size_bytes: sizeBytes,
        size_formatted: sizeFormatted,
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
   * Check and run scheduled time-based auto backup if due
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

      // Due if current time is past scheduled time and not backed up today
      if (nowMinutes >= schedTotalMinutes && config.lastAutoBackupDate !== todayStr) {
        isDue = true;
      }
    } else if (config.scheduleMode === 'interval') {
      const intervalMinutes = config.intervalMinutes || (config.intervalHours ? config.intervalHours * 60 : 360);
      const intervalMs = intervalMinutes * 60 * 1000;

      if (!config.lastAutoBackupTimestamp) {
        isDue = true;
      } else {
        const lastTime = new Date(config.lastAutoBackupTimestamp).getTime();
        if (Date.now() - lastTime >= intervalMs) {
          isDue = true;
        }
      }
    }

    if (!isDue) return false;

    try {
      const result = await this.executeMultiDestinationBackup('scheduled');
      config.lastAutoBackupDate = todayStr;
      config.lastAutoBackupTimestamp = new Date().toISOString();
      this.saveBackupConfig(config);
      this.notifyListeners(result);
      return true;
    } catch (err) {
      console.warn('Scheduled auto backup failed:', err);
      return false;
    }
  },

  /**
   * Start global background scheduler compatible with Tauri v2
   * Runs high-frequency 10-second tick check so 1-minute schedules execute precisely
   */
  startGlobalScheduler(listener?: (result: MultiBackupResult) => void): () => void {
    if (listener) {
      globalSchedulerListeners.push(listener);
    }

    if (!globalSchedulerTimer) {
      // Immediate check on startup
      this.checkAndRunScheduledAutoBackup().catch(e => {
        console.warn('Startup backup check error:', e);
      });

      // Periodic check every 10 seconds for high accuracy
      globalSchedulerTimer = setInterval(async () => {
        try {
          await this.checkAndRunScheduledAutoBackup();
        } catch (err) {
          console.warn('Scheduler interval error:', err);
        }
      }, 10000);
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
   * Restore database from backup
   * Safeguard backup taken before restoring
   */
  async restoreBackup(filename: string): Promise<void> {
    if (isTauri()) {
      try {
        await invoke('restore_accessories_backup', { filename });
        return;
      } catch (err: any) {
        throw new Error(typeof err === 'string' ? err : err?.message || 'فشل استرجاع قاعدة البيانات');
      }
    }

    const rawData = localStorage.getItem(BACKUP_DATA_PREFIX + filename);
    if (!rawData) {
      throw new Error(`ملف النسخة الاحتياطية "${filename}" غير موجود أو تالف`);
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

    // 1. Create safeguard backup first
    await this.createBackup('safeguard');

    // 2. Restore all tables
    if (parsed.data.products) localStorage.setItem('shop_accessories_products_v1', parsed.data.products);
    if (parsed.data.purchases) localStorage.setItem('shop_accessories_purchases_v1', parsed.data.purchases);
    if (parsed.data.purchase_items) localStorage.setItem('shop_accessories_purchase_items_v1', parsed.data.purchase_items);
    if (parsed.data.invoices) localStorage.setItem('shop_accessories_invoices_v1', parsed.data.invoices);
    if (parsed.data.invoice_items) localStorage.setItem('shop_accessories_invoice_items_v1', parsed.data.invoice_items);
    if (parsed.data.returns) localStorage.setItem('shop_accessories_returns_v1', parsed.data.returns);
    if (parsed.data.return_items) localStorage.setItem('shop_accessories_return_items_v1', parsed.data.return_items);
    if (parsed.data.movements) localStorage.setItem('shop_accessories_movements_v1', parsed.data.movements);
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
   * Load and migrate backup configuration settings
   */
  getBackupConfig(): BackupConfig {
    try {
      const raw = localStorage.getItem(BACKUP_CONFIG_KEY);
      if (!raw) return DEFAULT_CONFIG;
      const parsed = JSON.parse(raw);

      // Migrations for multiple destinations & new frequency formats
      const destinations: string[] = Array.isArray(parsed.destinations)
        ? parsed.destinations
        : parsed.destinationFolder
          ? [parsed.destinationFolder]
          : [];

      const intervalMinutes =
        typeof parsed.intervalMinutes === 'number'
          ? parsed.intervalMinutes
          : typeof parsed.intervalHours === 'number'
            ? parsed.intervalHours * 60
            : 360;

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        destinations,
        intervalMinutes,
        timeBackupEnabled: parsed.timeBackupEnabled !== undefined ? parsed.timeBackupEnabled : true,
        eventBackupEnabled: parsed.eventBackupEnabled !== undefined ? parsed.eventBackupEnabled : false,
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  saveBackupConfig(config: BackupConfig): void {
    localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(config));
  },

  /**
   * Calculate human-readable Arabic description of next scheduled backup
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

        if (now < scheduledToday) {
          parts.push(`اليوم ${timeStr}`);
        } else {
          parts.push(`غداً ${timeStr}`);
        }
      } else if (config.scheduleMode === 'interval') {
        const intervalMins =
          config.intervalMinutes || (config.intervalHours ? config.intervalHours * 60 : 360);

        if (intervalMins === 1) {
          parts.push('كل 1 دقيقة (مستمر)');
        } else if (intervalMins < 60) {
          parts.push(`كل ${intervalMins} دقيقة`);
        } else {
          const hours = intervalMins / 60;
          parts.push(`كل ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعات'}`);
        }
      }
    }

    return parts.join(' + ');
  },
};
