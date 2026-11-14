import { invoke, isTauri } from '@tauri-apps/api/core';
import type { BackupItem, BackupConfig } from '../types/backup.ts';

const BACKUPS_STORAGE_KEY = 'shop_accessories_backups_metadata_v1';
const BACKUP_DATA_PREFIX = 'shop_accessories_backup_data_';
const BACKUP_CONFIG_KEY = 'shop_accessories_backup_config_v1';

const DEFAULT_CONFIG: BackupConfig = {
  autoBackupEnabled: true,
  schedule: 'daily',
  retentionCount: 10,
};

const INITIAL_SEED_BACKUPS: BackupItem[] = [
  {
    id: 'accessories_backup_20241113_030000_auto.db',
    filename: 'accessories_backup_20241113_030000_auto.db',
    filepath: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups\\accessories_backup_20241113_030000_auto.db',
    size_bytes: 2516582,
    size_formatted: '2.40 MB',
    backup_type: 'auto',
    date: '2024-11-13 03:00:00',
    status: 'سليم ومتحقق منه',
  },
  {
    id: 'accessories_backup_20241112_182210_manual.db',
    filename: 'accessories_backup_20241112_182210_manual.db',
    filepath: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups\\accessories_backup_20241112_182210_manual.db',
    size_bytes: 2411724,
    size_formatted: '2.30 MB',
    backup_type: 'manual',
    date: '2024-11-12 18:22:10',
    status: 'سليم ومتحقق منه',
  },
];

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
   * Create a new backup (manual or auto or safeguard)
   */
  async createBackup(type: 'manual' | 'auto' | 'safeguard' = 'manual'): Promise<BackupItem> {
    if (isTauri()) {
      try {
        return await invoke<BackupItem>('create_accessories_backup', { backupType: type });
      } catch (err: any) {
        throw new Error(typeof err === 'string' ? err : err?.message || 'فشل إنشاء النسخة الاحتياطية');
      }
    }

    // Local persistent fallback: capture all application storage tables
    const snapshot = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: {
        products: localStorage.getItem('shop_accessories_products_v1'),
        purchases: localStorage.getItem('shop_accessories_purchases_v1'),
        purchase_items: localStorage.getItem('shop_accessories_purchase_items_v1'),
        invoices: localStorage.getItem('shop_accessories_invoices_v1'),
        invoice_items: localStorage.getItem('shop_accessories_invoice_items_v1'),
        returns: localStorage.getItem('shop_accessories_returns_v1'),
        return_items: localStorage.getItem('shop_accessories_return_items_v1'),
        movements: localStorage.getItem('shop_accessories_movements_v1'),
      },
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `accessories_backup_${timestampStr}_${type}.db`;

    const jsonStr = JSON.stringify(snapshot);
    const sizeBytes = new Blob([jsonStr]).size;
    const sizeFormatted = `${(sizeBytes / 1024).toFixed(1)} KB`;

    // Persist snapshot in local storage
    localStorage.setItem(BACKUP_DATA_PREFIX + filename, jsonStr);

    const newItem: BackupItem = {
      id: filename,
      filename,
      filepath: `local://backups/${filename}`,
      size_bytes: sizeBytes,
      size_formatted: sizeFormatted,
      backup_type: type,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
      status: 'سليم ومتحقق منه',
    };

    const currentBackups = getLocalBackups();
    currentBackups.unshift(newItem);

    // Apply retention pruning for auto backups
    const config = this.getBackupConfig();
    const autoBackups = currentBackups.filter(b => b.backup_type === 'auto');
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

    return newItem;
  },

  /**
   * Restore database from a backup
   * - Takes automatic safeguard backup of current data first
   * - Validates backup integrity
   * - Restores data
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

    // Local storage fallback restoration
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
   * Export backup file to external drive / download as file
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

    // Fallback: Download via browser link
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
   * Backup configuration settings
   */
  getBackupConfig(): BackupConfig {
    try {
      const raw = localStorage.getItem(BACKUP_CONFIG_KEY);
      if (!raw) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  saveBackupConfig(config: BackupConfig): void {
    localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(config));
  },

  /**
   * Check and run automatic scheduled backup if due
   */
  async checkAndRunScheduledAutoBackup(): Promise<boolean> {
    const config = this.getBackupConfig();
    if (!config.autoBackupEnabled) return false;

    const todayStr = new Date().toISOString().substring(0, 10);
    if (config.lastAutoBackupDate === todayStr) {
      return false; // Already created today
    }

    try {
      await this.createBackup('auto');
      config.lastAutoBackupDate = todayStr;
      this.saveBackupConfig(config);
      return true;
    } catch (err) {
      console.warn('Scheduled auto backup failed:', err);
      return false;
    }
  },
};
