export interface BackupItem {
  id: string;
  filename: string;
  filepath: string;
  size_bytes: number;
  size_formatted: string;
  backup_type: 'manual' | 'auto' | 'safeguard';
  date: string;
  status: string; // 'سليم ومتحقق منه'
}

export type BackupScheduleMode = 'time' | 'interval';

export interface BackupConfig {
  autoBackupEnabled: boolean;
  scheduleMode: BackupScheduleMode; // 'time' (specific time) or 'interval' (every X hours)
  specificTime: string; // e.g. "22:00" (10:00 PM)
  intervalHours: number; // e.g. 1, 2, 3, 6, 12, 24
  destinationFolder?: string; // custom target folder, defaults to %APPDATA%\ShopManagementSystem\backups
  retentionCount: number; // e.g. 10
  lastAutoBackupDate?: string; // YYYY-MM-DD
  lastAutoBackupTimestamp?: string; // ISO string
  nextScheduledBackup?: string; // formatted display string
}
