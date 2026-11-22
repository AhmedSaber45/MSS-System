export type AppModule = 'accessories' | 'mss' | 'both' | 'none';

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  allowedModules: AppModule;
  defaultStoreId?: string;
  assignedStoreIds: string[];
  credentialVersion: number;
  permissionVersion: number;
}

export interface StoredSession {
  sessionToken: string;
  user: AuthenticatedUser;
  expiresAt: string;
  lastOnlineValidationAt: string;
  lastActivityAt?: string;
  offlineMaxDays: number;
  deviceInfo?: string;
}

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'offline_authorized'
  | 'offline_expired'
  | 'revoked'
  | 'credential_changed'
  | 'account_disabled'
  | 'inactivity_expired';

export interface LoginCredentials {
  username: string;
  accessCode: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  status?: AuthStatus;
}

export interface AuthContextType {
  user: AuthenticatedUser | null;
  session: StoredSession | null;
  status: AuthStatus;
  isOnline: boolean;
  isOfflineAuthorized: boolean;
  offlineDaysRemaining: number;
  errorMessage: string | null;
  canAccess: (module: 'accessories' | 'mss') => boolean;
  requireAccess: (module: 'accessories' | 'mss') => boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => Promise<void>;
  revalidate: () => Promise<boolean>;
  clearError: () => void;
}
