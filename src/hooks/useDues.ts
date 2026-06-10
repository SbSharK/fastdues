import { useState, useEffect } from 'react';
import type { Contact, Transaction, SyncConfig, AppState } from '../types';

const STORAGE_KEY = 'dues_tracker_state';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Simple hash function for dirty state checking
const getHash = (obj: any): string => {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
};

export const useDues = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    clientId: '',
    isConnected: false,
    isEnabled: false,
    lastBackupTime: null,
    email: null,
    lastSyncHash: null,
  });

  // Load state on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed: AppState = JSON.parse(raw);
        if (parsed.contacts) setContacts(parsed.contacts);
        if (parsed.currencySymbol) setCurrencySymbol(parsed.currencySymbol);
        if (parsed.syncConfig) setSyncConfig(parsed.syncConfig);
      } catch (e) {
        console.error('Error loading state from localStorage', e);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  const saveState = (updatedContacts: Contact[], updatedCurrency: string, updatedSync: SyncConfig) => {
    const state: AppState = {
      contacts: updatedContacts,
      currencySymbol: updatedCurrency,
      syncConfig: updatedSync,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const addContact = (name: string, phone: string) => {
    const newContact: Contact = {
      id: generateId(),
      name,
      phone: phone || '',
      transactions: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [newContact, ...contacts];
    setContacts(updated);
    saveState(updated, currencySymbol, syncConfig);
  };

  const updateContact = (id: string, name: string, phone: string) => {
    const updated = contacts.map((c) =>
      c.id === id ? { ...c, name, phone } : c
    );
    setContacts(updated);
    saveState(updated, currencySymbol, syncConfig);
  };

  const deleteContact = (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    saveState(updated, currencySymbol, syncConfig);
  };

  const clearContactHistory = (id: string) => {
    const updated = contacts.map((c) =>
      c.id === id ? { ...c, transactions: [] } : c
    );
    setContacts(updated);
    saveState(updated, currencySymbol, syncConfig);
  };

  const addTransaction = (
    contactId: string,
    amount: number,
    type: 'gave' | 'took',
    description: string,
    date: string
  ) => {
    const newTx: Transaction = {
      id: generateId(),
      amount,
      type,
      date: date || new Date().toISOString().split('T')[0],
      description: description || (type === 'gave' ? 'Gave money' : 'Received money'),
    };

    const updated = contacts.map((c) => {
      if (c.id === contactId) {
        return {
          ...c,
          transactions: [newTx, ...c.transactions],
        };
      }
      return c;
    });

    setContacts(updated);
    saveState(updated, currencySymbol, syncConfig);
  };

  const deleteTransaction = (contactId: string, transactionId: string) => {
    const updated = contacts.map((c) => {
      if (c.id === contactId) {
        return {
          ...c,
          transactions: c.transactions.filter((t) => t.id !== transactionId),
        };
      }
      return c;
    });

    setContacts(updated);
    saveState(updated, currencySymbol, syncConfig);
  };

  const updateTransaction = (
    contactId: string,
    transactionId: string,
    amount: number,
    type: 'gave' | 'took',
    description: string,
    date: string
  ) => {
    const updated = contacts.map((c) => {
      if (c.id === contactId) {
        return {
          ...c,
          transactions: c.transactions.map((t) =>
            t.id === transactionId ? { ...t, amount, type, description, date } : t
          ),
        };
      }
      return c;
    });

    setContacts(updated);
    saveState(updated, currencySymbol, syncConfig);
  };

  const changeCurrency = (symbol: string) => {
    setCurrencySymbol(symbol);
    saveState(contacts, symbol, syncConfig);
  };

  const updateSyncConfig = (updatedFields: Partial<SyncConfig>) => {
    const updated = { ...syncConfig, ...updatedFields };
    setSyncConfig(updated);
    saveState(contacts, currencySymbol, updated);
  };

  // Export state to local JSON file
  const exportStateToJSON = (): string => {
    const state: AppState = {
      contacts,
      currencySymbol,
      syncConfig,
    };
    return JSON.stringify(state, null, 2);
  };

  // Import state from JSON string
  const importStateFromJSON = (jsonString: string): boolean => {
    try {
      const parsed: AppState = JSON.parse(jsonString);
      if (Array.isArray(parsed.contacts)) {
        setContacts(parsed.contacts);
        if (parsed.currencySymbol) setCurrencySymbol(parsed.currencySymbol);
        
        const mergedSync = { ...syncConfig, ...parsed.syncConfig };
        setSyncConfig(mergedSync);

        saveState(parsed.contacts, parsed.currencySymbol || currencySymbol, mergedSync);
        return true;
      }
    } catch (e) {
      console.error('Failed to parse import JSON', e);
    }
    return false;
  };

  // Determine cloud status based on hash comparison
  const getCloudStatus = (): 'disconnected' | 'synced' | 'pending_sync' => {
    if (!syncConfig.isConnected || !syncConfig.isEnabled) {
      return 'disconnected'; // Red
    }
    const currentHash = getHash(contacts);
    if (syncConfig.lastSyncHash === currentHash) {
      return 'synced'; // Green
    }
    return 'pending_sync'; // Grey
  };

  // Perform virtual sync (updates lastSyncHash)
  const performSync = () => {
    const currentHash = getHash(contacts);
    const updatedSync = {
      ...syncConfig,
      lastBackupTime: new Date().toISOString(),
      lastSyncHash: currentHash,
    };
    setSyncConfig(updatedSync);
    saveState(contacts, currencySymbol, updatedSync);
  };

  return {
    contacts,
    currencySymbol,
    syncConfig,
    cloudStatus: getCloudStatus(),
    currentHash: getHash(contacts),
    addContact,
    updateContact,
    deleteContact,
    clearContactHistory,
    addTransaction,
    deleteTransaction,
    updateTransaction,
    changeCurrency,
    updateSyncConfig,
    exportStateToJSON,
    importStateFromJSON,
    performSync,
  };
};
