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

export interface BackupConfig {
  autoBackupEnabled: boolean;
  schedule: 'daily' | 'on_startup' | 'hourly';
  retentionCount: number; // e.g. 10
  lastAutoBackupDate?: string;
}
