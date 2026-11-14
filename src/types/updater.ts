export type UpdateStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'UP_TO_DATE'
  | 'DOWNLOADING'
  | 'READY_TO_INSTALL'
  | 'ERROR'
  | 'OFFLINE';

export interface UpdateInfo {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  downloadProgress: number; // 0 to 100
  isMandatory: boolean;
  lastChecked: string | null;
  errorMessage?: string | null;
  preUpdateBackupFilename?: string | null;
}

export interface PlatformReleaseArtifact {
  signature: string;
  url: string;
}

export interface TauriUpdateManifest {
  version: string;
  notes: string;
  pub_date: string;
  platforms: {
    'windows-x86_64': PlatformReleaseArtifact;
    [key: string]: PlatformReleaseArtifact;
  };
}
