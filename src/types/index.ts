export interface Transaction {
  id: string;
  amount: number;
  type: 'gave' | 'took'; // 'gave' = lent (increases outstanding due), 'took' = borrowed/received (decreases due)
  date: string;
  description: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  transactions: Transaction[];
  createdAt: string;
}

export interface SyncConfig {
  clientId: string;
  isConnected: boolean;
  isEnabled: boolean;
  lastBackupTime: string | null;
  email: string | null;
  lastSyncHash: string | null; // Used to check if local state matches cloud state
}

export type CloudStatus = 'disconnected' | 'synced' | 'pending_sync';

export interface AppState {
  contacts: Contact[];
  currencySymbol: string;
  syncConfig: SyncConfig;
}
