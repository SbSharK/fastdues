import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  Search, 
  Cloud, 
  Plus, 
  ArrowLeft, 
  Trash2, 
  Edit, 
  Settings as SettingsIcon, 
  MoreVertical, 
  Calendar, 
  Check, 
  LogOut, 
  RefreshCw, 
  X, 
  User, 
  Phone, 
  Info,
  Download,
  Upload,
  Sun,
  Moon
} from 'lucide-react';
import { useDues } from './hooks/useDues';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import type { Contact, Transaction } from './types';

export default function App() {
  // --- States & Hooks ---
  const dues = useDues();
  const gd = useGoogleDrive({
    syncConfig: dues.syncConfig,
    updateSyncConfig: dues.updateSyncConfig,
    exportStateToJSON: dues.exportStateToJSON,
    importStateFromJSON: dues.importStateFromJSON,
    performSync: dues.performSync,
  });

  const [activeScreen, setActiveScreen] = useState<'home' | 'contact-detail' | 'settings'>('home');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Initialize theme based on user preference or system theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme_preference') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(systemPrefersDark ? 'dark' : 'light');
    }
  }, []);

  // Listen for system theme changes dynamically
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('theme_preference');
      if (!savedTheme) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme_preference', newTheme);
  };
  
  // Navigation / UI States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'getting' | 'giving' | 'settled'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'success' | 'error'>('info');

  // Contact Modals
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactModalMode, setContactModalMode] = useState<'add' | 'edit'>('add');
  const [contactFormName, setContactFormName] = useState('');
  const [contactFormPhone, setContactFormPhone] = useState('');

  // Transaction Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalMode, setTxModalMode] = useState<'add' | 'edit'>('add');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [txFormAmount, setTxFormAmount] = useState('');
  const [txFormType, setTxFormType] = useState<'gave' | 'took'>('gave');
  const [txFormDesc, setTxFormDesc] = useState('');
  const [txFormDate, setTxFormDate] = useState(new Date().toISOString().split('T')[0]);

  // Context Menus
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Show Toast Helper ---
  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- Daily Backup Trigger ---
  useEffect(() => {
    const checkDailyBackup = async () => {
      if (dues.syncConfig.isConnected && dues.syncConfig.isEnabled) {
        const lastBackup = dues.syncConfig.lastBackupTime;
        const todayStr = new Date().toISOString().split('T')[0];
        
        if (!lastBackup || lastBackup.split('T')[0] !== todayStr) {
          showToast('Triggering daily Google Drive backup...', 'info');
          const success = await gd.triggerSync();
          if (success) {
            showToast('Daily backup synced successfully!', 'success');
          } else {
            showToast('Daily background backup failed', 'error');
          }
        }
      }
    };
    // Run brief check shortly after loading
    const timer = setTimeout(checkDailyBackup, 2500);
    return () => clearTimeout(timer);
  }, [dues.syncConfig.isConnected, dues.syncConfig.isEnabled, dues.syncConfig.lastBackupTime, dues.contacts]);

  // --- Calculations ---
  const selectedContact = dues.contacts.find(c => c.id === selectedContactId);

  const calculateContactBalance = (contact: Contact) => {
    return contact.transactions.reduce((sum, tx) => {
      // Gave = user lent money to contact. Outstanding balance increases.
      // Took = contact returned/user borrowed money. Outstanding balance decreases.
      return tx.type === 'gave' ? sum + tx.amount : sum - tx.amount;
    }, 0);
  };

  const totals = dues.contacts.reduce(
    (acc, contact) => {
      const bal = calculateContactBalance(contact);
      if (bal > 0) {
        acc.getting += bal;
      } else if (bal < 0) {
        acc.giving += Math.abs(bal);
      }
      return acc;
    },
    { getting: 0, giving: 0 }
  );

  const netBalance = totals.getting - totals.giving;

  // --- Filtering Contacts ---
  const filteredContacts = dues.contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.phone.includes(searchQuery);
    
    if (!matchesSearch) return false;

    const balance = calculateContactBalance(c);
    if (activeFilter === 'getting') return balance > 0;
    if (activeFilter === 'giving') return balance < 0;
    if (activeFilter === 'settled') return balance === 0;
    return true; // 'all'
  });

  // --- Event Handlers ---
  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactFormName.trim()) return;

    if (contactModalMode === 'add') {
      dues.addContact(contactFormName.trim(), contactFormPhone.trim());
      showToast('Contact added successfully', 'success');
    } else if (contactModalMode === 'edit' && selectedContactId) {
      dues.updateContact(selectedContactId, contactFormName.trim(), contactFormPhone.trim());
      showToast('Contact updated successfully', 'success');
    }
    
    setIsContactModalOpen(false);
    setContactFormName('');
    setContactFormPhone('');
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(txFormAmount);
    if (isNaN(amt) || amt <= 0 || !selectedContactId) return;

    if (txModalMode === 'add') {
      dues.addTransaction(selectedContactId, amt, txFormType, txFormDesc.trim(), txFormDate);
      showToast('Transaction added', 'success');
    } else if (txModalMode === 'edit' && selectedTxId) {
      dues.updateTransaction(selectedContactId, selectedTxId, amt, txFormType, txFormDesc.trim(), txFormDate);
      showToast('Transaction updated', 'success');
    }

    setIsTxModalOpen(false);
    setTxFormAmount('');
    setTxFormDesc('');
    setTxFormDate(new Date().toISOString().split('T')[0]);
    setSelectedTxId(null);
  };

  const openAddContactModal = () => {
    setContactModalMode('add');
    setContactFormName('');
    setContactFormPhone('');
    setIsContactModalOpen(true);
  };

  const openEditContactModal = () => {
    if (!selectedContact) return;
    setContactModalMode('edit');
    setContactFormName(selectedContact.name);
    setContactFormPhone(selectedContact.phone);
    setIsContactModalOpen(true);
    setIsContactMenuOpen(false);
  };

  const openAddTxModal = (type: 'gave' | 'took') => {
    setTxModalMode('add');
    setTxFormType(type);
    setTxFormAmount('');
    setTxFormDesc('');
    setTxFormDate(new Date().toISOString().split('T')[0]);
    setIsTxModalOpen(true);
  };

  const openEditTxModal = (tx: Transaction) => {
    setTxModalMode('edit');
    setSelectedTxId(tx.id);
    setTxFormType(tx.type);
    setTxFormAmount(tx.amount.toString());
    setTxFormDesc(tx.description);
    setTxFormDate(tx.date);
    setIsTxModalOpen(true);
  };

  const handleDeleteContact = () => {
    if (!selectedContactId) return;
    if (confirm('Are you sure you want to delete this contact and all their ledger history?')) {
      dues.deleteContact(selectedContactId);
      setActiveScreen('home');
      setSelectedContactId(null);
      setIsContactMenuOpen(false);
      showToast('Contact deleted', 'info');
    }
  };

  const handleClearContactHistory = () => {
    if (!selectedContactId) return;
    if (confirm('Are you sure you want to clear this contact\'s ledger history?')) {
      dues.clearContactHistory(selectedContactId);
      setIsContactMenuOpen(false);
      showToast('History cleared', 'info');
    }
  };

  const handleDeleteTransaction = (txId: string) => {
    if (!selectedContactId) return;
    if (confirm('Delete this transaction?')) {
      dues.deleteTransaction(selectedContactId, txId);
      setIsTxModalOpen(false);
      showToast('Transaction deleted', 'info');
    }
  };

  const handleLocalExport = () => {
    const data = dues.exportStateToJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dues_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    showToast('Backup JSON downloaded', 'success');
  };

  const handleLocalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const contents = event.target?.result as string;
      const success = dues.importStateFromJSON(contents);
      if (success) {
        showToast('Backup imported successfully', 'success');
      } else {
        showToast('Invalid backup file format', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleCloudSyncBtnClick = () => {
    if (dues.cloudStatus === 'disconnected') {
      setActiveScreen('settings');
      showToast('Please enable cloud sync in settings', 'info');
    } else {
      handleManualCloudSync();
    }
  };

  const handleManualCloudSync = async () => {
    showToast('Syncing with Google Drive...', 'info');
    const success = await gd.triggerSync();
    if (success) {
      showToast('Sync completed successfully!', 'success');
    } else {
      showToast(gd.syncError || 'Sync failed. Check credentials.', 'error');
    }
  };

  const handleManualCloudRestore = async () => {
    if (confirm('This will replace your current device data with the Google Drive backup. Proceed?')) {
      showToast('Downloading backup from Drive...', 'info');
      const success = await gd.triggerRestore();
      if (success) {
        showToast('Restore completed successfully!', 'success');
      } else {
        showToast(gd.syncError || 'Failed to download backup.', 'error');
      }
    }
  };

  // --- Dynamic Color Mapping for cloudStatus ---
  const getCloudStatusColor = () => {
    if (dues.cloudStatus === 'synced') return 'green';
    if (dues.cloudStatus === 'pending_sync') return 'grey';
    return 'red';
  };

  return (
    <div className={`app-container ${theme}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className="glass-panel text-sm animate-fade-in" 
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            padding: '10px 20px',
            border: toastType === 'success' 
              ? '1px solid rgba(52, 211, 153, 0.4)' 
              : toastType === 'error' 
                ? '1px solid rgba(244, 63, 94, 0.4)' 
                : '1px solid rgba(255, 255, 255, 0.2)',
            background: toastType === 'success' 
              ? 'rgba(6, 78, 59, 0.8)' 
              : toastType === 'error' 
                ? 'rgba(159, 18, 57, 0.8)' 
                : 'rgba(30, 27, 75, 0.85)',
            color: '#fff',
            borderRadius: '40px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          {toastType === 'success' && <Check size={16} className="text-emerald-400" />}
          {toastMessage}
        </div>
      )}

      {/* --- Sidebar Navigation Drawer --- */}
      {isDrawerOpen && (
        <div 
          className="drawer-overlay animate-fade-in"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 50,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <div 
            className="drawer-menu glass-panel"
            style={{
              width: '80%',
              height: '100%',
              borderRadius: '0 24px 24px 0',
              borderTop: 'none',
              borderBottom: 'none',
              borderLeft: 'none',
              background: 'linear-gradient(180deg, rgba(20, 16, 41, 0.95) 0%, rgba(11, 9, 20, 0.98) 100%)',
              padding: '30px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              animation: 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <img src="/fastDues.svg" alt="FastDues" className="app-logo-img" style={{ height: '54px', width: 'auto', alignSelf: 'flex-start' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Personal Ledger App</p>
            </div>

            {/* Total Balance Card */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: '16px', 
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Overall Balance</span>
              <div 
                style={{ 
                  fontSize: '1.8rem', 
                  fontWeight: 700, 
                  marginTop: '4px',
                  color: netBalance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}
              >
                {netBalance < 0 ? '-' : ''}{dues.currencySymbol}{Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {netBalance >= 0 ? 'Net Receivable (To get)' : 'Net Payable (To give)'}
              </span>
            </div>

            {/* Nav List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <button 
                className="glass-button" 
                style={{ 
                  justifyContent: 'flex-start', 
                  background: activeScreen === 'home' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  padding: '14px 16px'
                }}
                onClick={() => { setActiveScreen('home'); setIsDrawerOpen(false); }}
              >
                <User size={18} style={{ marginRight: '8px', color: 'var(--accent-purple)' }} />
                Ledger Home
              </button>

              <button 
                className="glass-button" 
                style={{ 
                  justifyContent: 'flex-start', 
                  background: activeScreen === 'settings' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  padding: '14px 16px'
                }}
                onClick={() => { setActiveScreen('settings'); setIsDrawerOpen(false); }}
              >
                <SettingsIcon size={18} style={{ marginRight: '8px', color: 'var(--accent-purple)' }} />
                Cloud & Settings
              </button>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '15px 0' }} />

              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); showToast('Thank you for using Dues Tracker!', 'success'); }}
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '10px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem', gap: '12px' }}
              >
                <Info size={16} />
                Rate Application
              </a>
            </div>

            {/* Version */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Version 2.3.0 (Capacitor Hybrid)
            </div>
          </div>
        </div>
      )}

      {/* css injection for animations */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* --- SCREEN 1: HOME DASHBOARD --- */}
      {activeScreen === 'home' && (
        <>
          {/* Main App Header */}
          <header className="app-header">
            <button 
              className="glass-button" 
              style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', border: 'none' }}
              onClick={() => setIsDrawerOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img src="/fastDues.svg" alt="FastDues" className="app-logo-img" style={{ height: '46px', width: 'auto' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Theme Toggle Button */}
              <button 
                className="glass-button" 
                style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', border: 'none' }}
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* Cloud sync button */}
              <button 
                className={`btn-status ${getCloudStatusColor()}`}
                onClick={handleCloudSyncBtnClick}
                title={`Cloud status: ${dues.cloudStatus}. Click to Sync.`}
              >
                {gd.isSyncing ? (
                  <RefreshCw size={20} className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
                ) : (
                  <Cloud size={20} />
                )}
              </button>
            </div>
          </header>

          {/* Screen Content Wrapper */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Dashboard Net Balance Card */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: '24px 20px', 
                background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4) 0%, rgba(15, 12, 30, 0.6) 100%)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>NET BALANCE</span>
              <h2 
                style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 700, 
                  margin: '8px 0',
                  color: netBalance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}
              >
                {netBalance < 0 ? '-' : ''}{dues.currencySymbol}{Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
              <div 
                className="pulse text-xs font-semibold" 
                style={{ 
                  color: netBalance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  opacity: 0.8
                }}
              >
                {netBalance >= 0 ? 'You will receive overall' : 'You must settle overall'}
              </div>

              {/* Dividers & Split */}
              <div 
                style={{ 
                  display: 'flex', 
                  borderTop: '1px solid rgba(255,255,255,0.06)', 
                  marginTop: '20px', 
                  paddingTop: '16px' 
                }}
              >
                <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>YOU WILL GET</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-emerald)', marginTop: '4px' }}>
                    {dues.currencySymbol}{totals.getting.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>YOU WILL GIVE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-rose)', marginTop: '4px' }}>
                    {dues.currencySymbol}{totals.giving.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="Search contact name or phone..." 
                  style={{ width: '100%', paddingLeft: '48px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <X 
                    size={16} 
                    style={{ position: 'absolute', right: '16px', color: 'var(--text-muted)', cursor: 'pointer' }} 
                    onClick={() => setSearchQuery('')}
                  />
                )}
              </div>

              {/* Filter Tabs */}
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  padding: '4px', 
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '16px', 
                  border: '1px solid rgba(255,255,255,0.04)' 
                }}
              >
                {(['all', 'getting', 'giving', 'settled'] as const).map((filter) => (
                  <button 
                    key={filter}
                    className="glass-button"
                    style={{ 
                      flex: 1, 
                      padding: '8px 4px', 
                      fontSize: '0.75rem', 
                      borderRadius: '12px',
                      textTransform: 'uppercase',
                      background: activeFilter === filter ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: 'none',
                      color: activeFilter === filter ? '#fff' : 'var(--text-secondary)'
                    }}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter === 'getting' ? 'Getting' : filter === 'giving' ? 'Giving' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Contacts Ledger List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ledger Contacts</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredContacts.length} contacts</span>
              </div>

              {filteredContacts.length === 0 ? (
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '40px 20px', 
                    textAlign: 'center', 
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    borderStyle: 'dashed'
                  }}
                >
                  {searchQuery ? 'No contacts match your search' : 'No ledger entries. Tap + to add someone!'}
                </div>
              ) : (
                filteredContacts.map(contact => {
                  const bal = calculateContactBalance(contact);
                  return (
                    <div 
                      key={contact.id}
                      className="glass-panel animate-fade-in"
                      style={{ 
                        padding: '16px 20px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedContactId(contact.id);
                        setActiveScreen('contact-detail');
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* Avatar */}
                        <div 
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '22px',
                            background: bal > 0 
                              ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)' 
                              : bal < 0 
                                ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(225, 29, 72, 0.05) 100%)' 
                                : 'linear-gradient(135deg, rgba(167, 139, 250, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)',
                            border: bal > 0 
                              ? '1px solid rgba(52, 211, 153, 0.3)' 
                              : bal < 0 
                                ? '1px solid rgba(244, 63, 94, 0.3)' 
                                : '1px solid rgba(167, 139, 250, 0.2)',
                            color: bal > 0 
                              ? 'var(--accent-emerald)' 
                              : bal < 0 
                                ? 'var(--accent-rose)' 
                                : 'var(--accent-purple)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '1.1rem'
                          }}
                        >
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Contact details */}
                        <div>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>{contact.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {contact.phone || 'No phone number'}
                          </div>
                        </div>
                      </div>

                      {/* Outstanding Dues */}
                      <div style={{ textAlign: 'right' }}>
                        <div 
                          style={{ 
                            fontWeight: 700, 
                            fontSize: '1rem',
                            color: bal > 0 
                              ? 'var(--accent-emerald)' 
                              : bal < 0 
                                ? 'var(--accent-rose)' 
                                : 'var(--text-muted)'
                          }}
                        >
                          {bal > 0 ? '' : bal < 0 ? '-' : ''}
                          {dues.currencySymbol}{Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {bal > 0 ? 'Gets' : bal < 0 ? 'Gives' : 'Settled'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>

            {/* Floating Action Button to Add Contact */}
            <button className="fab" onClick={openAddContactModal} title="Add New Contact">
              <Plus size={28} />
            </button>
        </>
      )}

      {/* --- SCREEN 2: CONTACT LEDGER DETAIL --- */}
      {activeScreen === 'contact-detail' && selectedContact && (
        <>
          {/* Header */}
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                className="glass-button" 
                style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', border: 'none' }}
                onClick={() => { setActiveScreen('home'); setSelectedContactId(null); }}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 style={{ fontSize: '1.25rem' }}>{selectedContact.name}</h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{selectedContact.phone || 'No Phone'}</p>
              </div>
            </div>

            {/* Dropdown Options trigger */}
            <div style={{ position: 'relative' }}>
              <button 
                className="glass-button" 
                style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', border: 'none' }}
                onClick={() => setIsContactMenuOpen(!isContactMenuOpen)}
              >
                <MoreVertical size={20} />
              </button>

              {/* Menu items absolute dropdown */}
              {isContactMenuOpen && (
                <>
                  <div 
                    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 40 }} 
                    onClick={() => setIsContactMenuOpen(false)}
                  />
                  <div 
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '46px',
                      background: 'rgba(15, 12, 30, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      padding: '8px',
                      zIndex: 51,
                      minWidth: '160px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      animation: 'fadeIn 0.15s ease-out'
                    }}
                  >
                    <button 
                      className="glass-button" 
                      style={{ border: 'none', justifyContent: 'flex-start', padding: '10px 12px', fontSize: '0.85rem' }}
                      onClick={openEditContactModal}
                    >
                      <Edit size={14} style={{ marginRight: '8px' }} /> Edit Contact
                    </button>
                    <button 
                      className="glass-button" 
                      style={{ border: 'none', justifyContent: 'flex-start', padding: '10px 12px', fontSize: '0.85rem' }}
                      onClick={handleClearContactHistory}
                    >
                      <RefreshCw size={14} style={{ marginRight: '8px' }} /> Clear History
                    </button>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />
                    <button 
                      className="glass-button" 
                      style={{ border: 'none', justifyContent: 'flex-start', padding: '10px 12px', fontSize: '0.85rem', color: 'var(--accent-rose)' }}
                      onClick={handleDeleteContact}
                    >
                      <Trash2 size={14} style={{ marginRight: '8px', color: 'var(--accent-rose)' }} /> Delete Contact
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Ledger Content */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Total Balance Card */}
            {(() => {
              const bal = calculateContactBalance(selectedContact);
              return (
                <div 
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: bal > 0 
                      ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.25) 0%, rgba(15, 12, 30, 0.4) 100%)' 
                      : bal < 0 
                        ? 'linear-gradient(135deg, rgba(159, 18, 57, 0.25) 0%, rgba(15, 12, 30, 0.4) 100%)' 
                        : 'linear-gradient(135deg, rgba(30, 41, 59, 0.25) 0%, rgba(15, 12, 30, 0.4) 100%)',
                    borderColor: bal > 0 
                      ? 'rgba(52, 211, 153, 0.2)' 
                      : bal < 0 
                        ? 'rgba(244, 63, 94, 0.2)' 
                        : 'rgba(255,255,255,0.08)'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Outstanding Balance</span>
                  <h2 
                    style={{ 
                      fontSize: '2.2rem', 
                      fontWeight: 700, 
                      marginTop: '6px',
                      color: bal > 0 
                        ? 'var(--accent-emerald)' 
                        : bal < 0 
                          ? 'var(--accent-rose)' 
                          : '#fff'
                    }}
                  >
                    {bal < 0 ? '-' : ''}{dues.currencySymbol}{Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {bal > 0 ? `${selectedContact.name} owes you` : bal < 0 ? `You owe ${selectedContact.name}` : 'All settled!'}
                  </p>
                </div>
              );
            })()}

            {/* Ledger Transactions Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', paddingLeft: '4px' }}>Ledger Ledger History</span>
              
              {selectedContact.transactions.length === 0 ? (
                <div 
                  className="glass-panel" 
                  style={{ 
                    padding: '50px 20px', 
                    textAlign: 'center', 
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem'
                  }}
                >
                  No transactions recorded. Use buttons below to log a payment!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedContact.transactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="glass-panel animate-fade-in"
                      style={{ 
                        padding: '14px 16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)'
                      }}
                      onClick={() => openEditTxModal(tx)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {/* Title note */}
                        <div style={{ color: '#fff', fontWeight: 500, fontSize: '0.9rem' }}>{tx.description}</div>
                        {/* Date info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <Calendar size={12} />
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      {/* Right side Amount */}
                      <div style={{ textAlign: 'right' }}>
                        <div 
                          style={{ 
                            fontWeight: 700, 
                            fontSize: '1rem',
                            color: tx.type === 'gave' ? 'var(--accent-rose)' : 'var(--accent-emerald)'
                          }}
                        >
                          {tx.type === 'gave' ? '+' : '-'}{dues.currencySymbol}{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {tx.type === 'gave' ? 'Gave (Lent)' : 'Got (Received)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>

          {/* Bottom Action Footer for ledger entry */}
          <footer 
            style={{ 
              padding: '16px 20px', 
              display: 'flex', 
              gap: '12px', 
              borderTop: '1px solid var(--glass-border)',
              background: 'rgba(15, 12, 30, 0.8)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <button 
              className="glass-button" 
              style={{ 
                flex: 1, 
                borderColor: 'rgba(244, 63, 94, 0.4)', 
                background: 'rgba(244, 63, 94, 0.08)',
                color: 'var(--accent-rose)' 
              }}
              onClick={() => openAddTxModal('gave')}
            >
              You Gave (Lent)
            </button>
            <button 
              className="glass-button" 
              style={{ 
                flex: 1, 
                borderColor: 'rgba(52, 211, 153, 0.4)', 
                background: 'rgba(52, 211, 153, 0.08)',
                color: 'var(--accent-emerald)' 
              }}
              onClick={() => openAddTxModal('took')}
            >
              You Got (Recvd)
            </button>
          </footer>
        </>
      )}

      {/* --- SCREEN 3: SETTINGS & BACKUP --- */}
      {activeScreen === 'settings' && (
        <>
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                className="glass-button" 
                style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', border: 'none' }}
                onClick={() => { setActiveScreen('home'); setSelectedContactId(null); }}
              >
                <ArrowLeft size={20} />
              </button>
              <h1 style={{ fontSize: '1.25rem' }}>Cloud & Settings</h1>
            </div>
          </header>

          <main style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Currency configuration */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Default Currency</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['₹', '$', '€', '£'].map((sym) => (
                  <button
                    key={sym}
                    className="glass-button"
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: dues.currencySymbol === sym ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.03)',
                      borderColor: dues.currencySymbol === sym ? 'var(--accent-purple)' : 'var(--glass-border)',
                      fontSize: '1.1rem',
                      fontWeight: 600
                    }}
                    onClick={() => dues.changeCurrency(sym)}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Drive Integration card */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Google Drive Backup</h3>
                <span 
                  className={`btn-status ${getCloudStatusColor()}`} 
                  style={{ width: '32px', height: '32px', cursor: 'default' }}
                >
                  <Cloud size={16} />
                </span>
              </div>

              {/* Status details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Status:</span>
                  <span style={{ fontWeight: 600, color: dues.syncConfig.isConnected ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                    {dues.syncConfig.isConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                {dues.syncConfig.isConnected && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Google Account:</span>
                      <span style={{ color: '#fff' }}>{dues.syncConfig.email}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Last Backup:</span>
                      <span style={{ color: '#fff' }}>
                        {dues.syncConfig.lastBackupTime 
                          ? new Date(dues.syncConfig.lastBackupTime).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Sync Status:</span>
                      <span style={{ color: dues.cloudStatus === 'synced' ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                        {dues.cloudStatus === 'synced' ? 'Synced (All backed up)' : 'Pending Changes (Grey)'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Client ID field config */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OAuth Google Client ID (Optional for Real Sync)</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="e.g. 12345-abcde.apps.googleusercontent.com"
                  style={{ fontSize: '0.85rem', padding: '10px' }}
                  value={dues.syncConfig.clientId}
                  onChange={(e) => dues.updateSyncConfig({ clientId: e.target.value.trim() })}
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  Leave empty to use the <b>Interactive Simulator Mode</b>. If you provide a Client ID, it triggers actual Google Identity Login and backs up to your Google Drive (`dues_tracker_backup.json`).
                </p>
              </div>

              {/* Action buttons for Cloud Sync */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {!dues.syncConfig.isConnected ? (
                  <button 
                    className="glass-button" 
                    style={{ background: 'linear-gradient(135deg, var(--accent-purple) 0%, #7c3aed 100%)', border: 'none' }}
                    onClick={() => {
                      gd.connectGoogleDrive();
                      showToast('Cloud connection set up!', 'success');
                    }}
                  >
                    Set Up Cloud Backup
                  </button>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        className="glass-button" 
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)' }}
                        disabled={gd.isSyncing}
                        onClick={handleManualCloudSync}
                      >
                        {gd.isSyncing ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Upload size={16} />
                        )}
                        Backup Now
                      </button>
                      <button 
                        className="glass-button" 
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)' }}
                        disabled={gd.isSyncing}
                        onClick={handleManualCloudRestore}
                      >
                        <Download size={16} />
                        Restore
                      </button>
                    </div>

                    {/* Enable Switch */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Auto Daily Backup</span>
                      <button
                        className="glass-button"
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.8rem',
                          background: dues.syncConfig.isEnabled ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.04)',
                          borderColor: dues.syncConfig.isEnabled ? 'var(--accent-emerald)' : 'var(--glass-border)',
                        }}
                        onClick={() => dues.updateSyncConfig({ isEnabled: !dues.syncConfig.isEnabled })}
                      >
                        {dues.syncConfig.isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <button 
                      className="glass-button" 
                      style={{ border: 'none', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.05)', fontSize: '0.85rem' }}
                      onClick={gd.disconnectGoogleDrive}
                    >
                      <LogOut size={16} style={{ marginRight: '8px' }} /> Disconnect Drive Account
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Local Storage Export/Import */}
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Local Device Backups</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Export or import ledger data directly as a local JSON file on your device. Useful for offline physical storage backups.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="glass-button" style={{ flex: 1 }} onClick={handleLocalExport}>
                  <Download size={16} />
                  Export JSON
                </button>
                <button 
                  className="glass-button" 
                  style={{ flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                  Import JSON
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".json"
                onChange={handleLocalImport}
              />
            </div>

            {/* Tutorial Alert */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: '16px', 
                border: '1px dashed var(--accent-purple)', 
                background: 'rgba(167, 139, 250, 0.02)',
                display: 'flex',
                gap: '12px'
              }}
            >
              <Info size={20} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>How to link Google Drive</h4>
                <ol style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '14px', lineHeight: '1.4' }}>
                  <li>Go to Google Cloud Developer Console.</li>
                  <li>Create a project, configure OAuth Consent screen (User Type: External).</li>
                  <li>Add testing email users and credentials for Web Client ID.</li>
                  <li>Add URI redirects: `http://localhost:5173` or your production domain.</li>
                  <li>Paste the generated Client ID above.</li>
                </ol>
              </div>
            </div>
          </main>
        </>
      )}

      {/* --- MODAL: ADD / EDIT CONTACT --- */}
      {isContactModalOpen && (
        <div 
          className="modal-overlay animate-fade-in"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}
          onClick={() => setIsContactModalOpen(false)}
        >
          <form 
            className="glass-panel animate-slide-up"
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(15, 12, 30, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddContactSubmit}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>
                {contactModalMode === 'add' ? 'Add New Contact' : 'Edit Contact Details'}
              </h2>
              <button 
                type="button" 
                className="glass-button" 
                style={{ padding: '6px', borderRadius: '50%', border: 'none', background: 'transparent' }}
                onClick={() => setIsContactModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Input Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Full Name</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="Enter name" 
                  style={{ width: '100%', paddingLeft: '40px' }}
                  required
                  value={contactFormName}
                  onChange={(e) => setContactFormName(e.target.value)}
                />
              </div>
            </div>

            {/* Input Phone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Phone Number (Optional)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Phone size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="tel" 
                  className="glass-input" 
                  placeholder="Enter phone number" 
                  style={{ width: '100%', paddingLeft: '40px' }}
                  value={contactFormPhone}
                  onChange={(e) => setContactFormPhone(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="glass-button"
              style={{ 
                background: 'linear-gradient(135deg, var(--accent-purple) 0%, #7c3aed 100%)', 
                border: 'none', 
                padding: '14px', 
                fontWeight: 600,
                marginTop: '6px'
              }}
            >
              {contactModalMode === 'add' ? 'Create Contact' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* --- MODAL: ADD / EDIT TRANSACTION --- */}
      {isTxModalOpen && (
        <div 
          className="modal-overlay animate-fade-in"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}
          onClick={() => setIsTxModalOpen(false)}
        >
          <form 
            className="glass-panel animate-slide-up"
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'rgba(15, 12, 30, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleTxSubmit}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>
                {txModalMode === 'add' ? 'New Ledger Entry' : 'Edit Ledger Entry'}
              </h2>
              <button 
                type="button" 
                className="glass-button" 
                style={{ padding: '6px', borderRadius: '50%', border: 'none', background: 'transparent' }}
                onClick={() => setIsTxModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Type selector: Gave / Took */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="glass-button"
                style={{
                  flex: 1,
                  background: txFormType === 'gave' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor: txFormType === 'gave' ? 'var(--accent-rose)' : 'var(--glass-border)',
                  color: txFormType === 'gave' ? 'var(--accent-rose)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}
                onClick={() => setTxFormType('gave')}
              >
                You Gave (Lent)
              </button>
              <button
                type="button"
                className="glass-button"
                style={{
                  flex: 1,
                  background: txFormType === 'took' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor: txFormType === 'took' ? 'var(--accent-emerald)' : 'var(--glass-border)',
                  color: txFormType === 'took' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}
                onClick={() => setTxFormType('took')}
              >
                You Got (Recvd)
              </button>
            </div>

            {/* Input Amount */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Amount</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span 
                  style={{ 
                    position: 'absolute', 
                    left: '16px', 
                    fontSize: '1.2rem', 
                    fontWeight: 600, 
                    color: txFormType === 'gave' ? 'var(--accent-rose)' : 'var(--accent-emerald)' 
                  }}
                >
                  {dues.currencySymbol}
                </span>
                <input 
                  type="number" 
                  step="any"
                  className="glass-input" 
                  placeholder="0.00" 
                  style={{ 
                    width: '100%', 
                    paddingLeft: '40px',
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    color: txFormType === 'gave' ? 'var(--accent-rose)' : 'var(--accent-emerald)'
                  }}
                  required
                  value={txFormAmount}
                  onChange={(e) => setTxFormAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Input Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Transaction Date</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="date" 
                  className="glass-input" 
                  style={{ width: '100%', paddingLeft: '40px' }}
                  required
                  value={txFormDate}
                  onChange={(e) => setTxFormDate(e.target.value)}
                />
              </div>
            </div>

            {/* Input Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Description / Notes</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="e.g. given on phonepe, tea, dinner"
                value={txFormDesc}
                onChange={(e) => setTxFormDesc(e.target.value)}
              />
              {/* Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {['PhonePe', 'GPay', 'Cash', 'Dinner', 'Tea', 'Borrowed'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className="glass-button"
                    style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '10px' }}
                    onClick={() => setTxFormDesc(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              {txModalMode === 'edit' && selectedTxId && (
                <button
                  type="button"
                  className="glass-button"
                  style={{ borderColor: 'rgba(244,63,94,0.3)', color: 'var(--accent-rose)' }}
                  onClick={() => handleDeleteTransaction(selectedTxId)}
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button 
                type="submit" 
                className="glass-button"
                style={{ 
                  flex: 1,
                  background: 'linear-gradient(135deg, var(--accent-purple) 0%, #7c3aed 100%)', 
                  border: 'none', 
                  padding: '14px', 
                  fontWeight: 600
                }}
              >
                {txModalMode === 'add' ? 'Save Transaction' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
