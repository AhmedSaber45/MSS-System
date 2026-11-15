export type BackupTriggerType = 'scheduled' | 'after_operation' | 'manual' | 'safeguard';
export type BackupOverallStatus = 'success' | 'partial' | 'failed';

export interface BackupDestinationResult {
  path: string;
  status: 'success' | 'failed';
  file_path?: string;
  size_bytes?: number;
  size_formatted?: string;
  error?: string;
}

export interface BackupItem {
  id: string;
  filename: string;
  filepath: string;
  size_bytes: number;
  size_formatted: string;
  backup_type: 'manual' | 'auto' | 'safeguard';
  trigger_type?: BackupTriggerType;
  date: string;
  status: string; // e.g. 'سليم ومتحقق منه' | 'نجاح جزئي' | 'فشل'
  overall_status?: BackupOverallStatus;
  destinations?: BackupDestinationResult[];
  error_details?: string;
}

export type BackupScheduleMode = 'time' | 'interval';

export interface BackupConfig {
  autoBackupEnabled: boolean; // Master toggle
  timeBackupEnabled?: boolean; // Time-based auto backup toggle
  eventBackupEnabled?: boolean; // Event-based auto backup toggle
  scheduleMode: BackupScheduleMode; // 'time' (specific time) or 'interval' (every X minutes/hours)
  specificTime: string; // e.g. "22:00" (10:00 PM)
  intervalMinutes?: number; // e.g. 1, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440
  intervalHours?: number; // Backwards compatibility: e.g. 1, 2, 3, 6, 12, 24
  destinations: string[]; // List of independent backup destinations (e.g. ["D:\\MSS Backups", "E:\\System Backups"])
  destinationFolder?: string; // Backwards compatibility: legacy single target folder
  retentionCount: number; // e.g. 10
  lastAutoBackupDate?: string; // YYYY-MM-DD
  lastAutoBackupTimestamp?: string; // ISO string
  nextScheduledBackup?: string; // formatted display string
}

export interface DestinationValidationResult {
  path: string;
  valid: boolean;
  error?: string;
}

export interface MultiBackupResult {
  id: string;
  filename: string;
  trigger_type: BackupTriggerType;
  date: string;
  overall_status: BackupOverallStatus;
  total_destinations: number;
  successful_destinations: number;
  failed_destinations: number;
  destinations: BackupDestinationResult[];
  size_bytes: number;
  size_formatted: string;
  error_details?: string;
}
