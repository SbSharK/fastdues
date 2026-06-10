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

  // Pull to Refresh / Net Balance states
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNetBalance, setShowNetBalance] = useState(false);
  const touchStart = useRef<number | null>(null);

  // Simulated Contacts Picker Modal
  const [isSimContactModalOpen, setIsSimContactModalOpen] = useState(false);
  const [simSearchQuery, setSimSearchQuery] = useState('');

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

  // --- Pull to Refresh Touch Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = e.currentTarget;
    if (container.scrollTop === 0 && !isRefreshing) {
      touchStart.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart.current === null || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStart.current;
    if (diff > 0) {
      setPullOffset(Math.min(diff * 0.4, 80));
    }
  };

  const handleTouchEnd = () => {
    if (touchStart.current === null) return;
    touchStart.current = null;
    
    if (pullOffset > 50) {
      setIsRefreshing(true);
      // Simulate reload animation
      setTimeout(() => {
        setIsRefreshing(false);
        setShowNetBalance(true);
        showToast('Overall balance updated', 'success');
      }, 1200);
    }
    setPullOffset(0);
  };

  // --- Import from Contacts helper ---
  const handleImportFromContacts = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        // @ts-ignore
        const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
        if (contacts && contacts.length > 0) {
          const c = contacts[0];
          const name = c.name && c.name[0] ? c.name[0] : '';
          const phone = c.tel && c.tel[0] ? c.tel[0] : '';
          setContactFormName(name);
          setContactFormPhone(phone);
          showToast('Imported contact details!', 'success');
          return;
        }
      } catch (err) {
        console.error('Contacts API failed:', err);
        showToast('Failed to access contacts', 'error');
        return;
      }
    }
    // Fallback: Simulator mode
    setIsSimContactModalOpen(true);
  };

  // Mock Contacts for Simulator Mode
  const simulatedContacts = [
    { name: 'Amol Potdar', phone: '9637263330' },
    { name: 'Rahul Sharma', phone: '9876543210' },
    { name: 'Priya Patel', phone: '9123456789' },
    { name: 'Amit Kumar', phone: '9988776655' },
    { name: 'Sneha Reddy', phone: '9500012345' },
    { name: 'Deepak Singh', phone: '9440054321' },
    { name: 'Anjali Gupta', phone: '9300067890' },
    { name: 'Vikram Malhotra', phone: '9200011223' },
    { name: 'Sunita Verma', phone: '9100044556' },
    { name: 'Rohan Joshi', phone: '9000099887' }
  ];

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
          onClick={() => setIsDrawerOpen(false)}
        >
          <div 
            className="drawer-menu glass-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <img src="/fastDues.svg" alt="FastDues" className="app-logo-img" style={{ height: '62px', width: 'auto', alignSelf: 'flex-start' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Personal Ledger App</p>
            </div>

            {/* Total Balance Card */}
            <div 
              className="glass-panel" 
              style={{ 
                padding: '16px'
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
                  background: activeScreen === 'home' ? 'var(--active-btn-bg)' : 'transparent',
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
                  background: activeScreen === 'settings' ? 'var(--active-btn-bg)' : 'transparent',
                  border: 'none',
                  padding: '14px 16px'
                }}
                onClick={() => { setActiveScreen('settings'); setIsDrawerOpen(false); }}
              >
                <SettingsIcon size={18} style={{ marginRight: '8px', color: 'var(--accent-purple)' }} />
                Cloud & Settings
              </button>

              <div style={{ borderTop: '1px solid var(--glass-border)', margin: '15px 0' }} />

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
        @keyframes slideInDown {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes ballBounce {
          0%, 100% {
            transform: translateY(0) scale(1.1, 0.9);
            animation-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
          }
          45% {
            transform: translateY(-24px) scale(0.9, 1.15);
          }
          50% {
            transform: translateY(-26px) scale(1, 1);
            animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45);
          }
          55% {
            transform: translateY(-24px) scale(0.9, 1.15);
          }
          95% {
            transform: translateY(0) scale(1.15, 0.85);
          }
        }
        @keyframes lineBounce {
          0%, 100% {
            d: path("M 0 40 Q 200 40 400 40");
          }
          95% {
            d: path("M 0 40 Q 200 46 400 40");
          }
        }
        .bounce-ball-active {
          animation: ballBounce 0.8s infinite;
          transform-origin: 200px 40px;
        }
        .bounce-line-active {
          animation: lineBounce 0.8s infinite;
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
               <img src="/fastDues.svg" alt="FastDues" className="app-logo-img" style={{ height: '54px', width: 'auto' }} />
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
          <main 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px',
              position: 'relative'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Pull to Refresh Indicator */}
            {(pullOffset > 0 || isRefreshing) && (
              <div 
                style={{
                  height: isRefreshing ? '60px' : `${pullOffset}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  transition: pullOffset === 0 ? 'height 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
                  flexShrink: 0,
                  width: '100%'
                }}
              >
                <svg 
                  viewBox="0 0 400 80" 
                  preserveAspectRatio="none"
                  style={{ 
                    width: '100%', 
                    height: '80px', 
                    overflow: 'visible'
                  }}
                >
                  {isRefreshing ? (
                    <>
                      <path 
                        className="bounce-line-active"
                        d="M 0 40 Q 200 40 400 40"
                        fill="none" 
                        stroke="var(--accent-purple)" 
                        strokeWidth="3.5" 
                        strokeLinecap="round"
                      />
                      <circle 
                        className="bounce-ball-active"
                        cx="200" 
                        cy="40" 
                        r="8" 
                        fill="var(--accent-purple)"
                      />
                    </>
                  ) : (
                    <>
                      <path 
                        d={`M 0 15 Q 200 ${15 + pullOffset * 0.7} 400 15`}
                        fill="none" 
                        stroke="var(--accent-purple)" 
                        strokeWidth="3.5" 
                        strokeLinecap="round"
                        style={{
                          transition: pullOffset === 0 ? 'd 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
                        }}
                      />
                      <circle 
                        cx="200" 
                        cy={15 + pullOffset * 0.7} 
                        r="8" 
                        fill="var(--accent-purple)"
                        style={{
                          transition: pullOffset === 0 ? 'cy 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
                        }}
                      />
                    </>
                  )}
                </svg>
              </div>
            )}

            {/* Dashboard Net Balance Card */}
            {showNetBalance && (
              <div 
                className="glass-panel animate-fade-in" 
                style={{ 
                  padding: '24px 20px', 
                  background: 'var(--card-gradient)',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  animation: 'slideInDown 0.3s ease-out',
                  flexShrink: 0
                }}
              >
                {/* Dismiss Button */}
                <button 
                  type="button" 
                  className="glass-button" 
                  style={{ 
                    position: 'absolute', 
                    top: '12px', 
                    right: '12px', 
                    padding: '4px', 
                    borderRadius: '50%', 
                    border: 'none', 
                    background: 'transparent',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() => setShowNetBalance(false)}
                >
                  <X size={14} />
                </button>

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
                    borderTop: '1px solid var(--glass-border)', 
                    marginTop: '20px', 
                    paddingTop: '16px' 
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid var(--glass-border)' }}>
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
            )}

            {/* Search and Filter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0 }}>
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
                  background: 'var(--glass-bg)',
                  borderRadius: '16px', 
                  border: '1px solid var(--glass-border)' 
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
                      background: activeFilter === filter ? 'var(--active-btn-bg)' : 'transparent',
                      border: 'none',
                      color: activeFilter === filter ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter === 'getting' ? 'Getting' : filter === 'giving' ? 'Giving' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Contacts Ledger List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
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
                              ? 'rgba(52, 211, 153, 0.12)' 
                              : bal < 0 
                                ? 'rgba(244, 63, 94, 0.12)' 
                                : 'rgba(167, 139, 250, 0.1)',
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
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{contact.name}</div>
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
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--glass-border)',
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
                    <div style={{ borderTop: '1px solid var(--glass-border)', margin: '4px 0' }} />
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
                      ? 'rgba(52, 211, 153, 0.12)' 
                      : bal < 0 
                        ? 'rgba(244, 63, 94, 0.12)' 
                        : 'rgba(30, 41, 59, 0.12)',
                    borderColor: bal > 0 
                      ? 'rgba(52, 211, 153, 0.2)' 
                      : bal < 0 
                        ? 'rgba(244, 63, 94, 0.2)' 
                        : 'var(--glass-border)'
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
                          : 'var(--text-primary)'
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
                        cursor: 'pointer'
                      }}
                      onClick={() => openEditTxModal(tx)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {/* Title note */}
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem' }}>{tx.description}</div>
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
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Default Currency</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['₹', '$', '€', '£'].map((sym) => (
                  <button
                    key={sym}
                    className="glass-button"
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: dues.currencySymbol === sym ? 'var(--accent-purple-glow)' : 'var(--glass-bg)',
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
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Google Drive Backup</h3>
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
                      <span style={{ color: 'var(--text-primary)' }}>{dues.syncConfig.email}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Last Backup:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
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
                    style={{ background: 'var(--accent-purple)', border: 'none' }}
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
                        style={{ flex: 1 }}
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
                        style={{ flex: 1 }}
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
                          background: dues.syncConfig.isEnabled ? 'var(--accent-emerald-glow)' : 'var(--glass-bg)',
                          borderColor: dues.syncConfig.isEnabled ? 'var(--accent-emerald)' : 'var(--glass-border)',
                        }}
                        onClick={() => dues.updateSyncConfig({ isEnabled: !dues.syncConfig.isEnabled })}
                      >
                        {dues.syncConfig.isEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <button 
                      className="glass-button" 
                      style={{ border: 'none', color: 'var(--accent-rose)', background: 'var(--accent-rose-glow)', fontSize: '0.85rem' }}
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
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Local Device Backups</h3>
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
                background: 'var(--accent-purple-glow)',
                display: 'flex',
                gap: '12px'
              }}
            >
              <Info size={20} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>How to link Google Drive</h4>
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
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)'
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddContactSubmit}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
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

            {contactModalMode === 'add' && (
              <button
                type="button"
                className="glass-button"
                style={{
                  width: '100%',
                  background: 'var(--active-btn-bg)',
                  borderColor: 'var(--accent-purple)',
                  color: 'var(--accent-purple)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px'
                }}
                onClick={handleImportFromContacts}
              >
                <User size={16} /> Import from Device Contacts
              </button>
            )}

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
                background: 'var(--accent-purple)', 
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
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)'
            }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleTxSubmit}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
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
                  background: txFormType === 'gave' ? 'var(--accent-rose-glow)' : 'var(--glass-bg)',
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
                  background: txFormType === 'took' ? 'var(--accent-emerald-glow)' : 'var(--glass-bg)',
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

      {/* --- MODAL: SIMULATOR CONTACTS PICKER --- */}
      {isSimContactModalOpen && (
        <div 
          className="modal-overlay animate-fade-in"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}
          onClick={() => setIsSimContactModalOpen(false)}
        >
          <div 
            className="glass-panel animate-slide-up"
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'var(--drawer-bg)',
              border: '1px solid var(--glass-border)',
              maxHeight: '80%',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Select Contact (Simulated)
              </h2>
              <button 
                type="button" 
                className="glass-button" 
                style={{ padding: '6px', borderRadius: '50%', border: 'none', background: 'transparent' }}
                onClick={() => setIsSimContactModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sim Search Bar */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="glass-input" 
                placeholder="Search simulated contacts..." 
                style={{ width: '100%', paddingLeft: '40px', paddingTop: '10px', paddingBottom: '10px', fontSize: '0.9rem' }}
                value={simSearchQuery}
                onChange={(e) => setSimSearchQuery(e.target.value)}
              />
            </div>

            {/* Sim Contact List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '300px' }}>
              {simulatedContacts
                .filter(c => c.name.toLowerCase().includes(simSearchQuery.toLowerCase()) || c.phone.includes(simSearchQuery))
                .map((contact, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="glass-button"
                    style={{
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      width: '100%',
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px'
                    }}
                    onClick={() => {
                      setContactFormName(contact.name);
                      setContactFormPhone(contact.phone);
                      setIsSimContactModalOpen(false);
                      showToast(`Imported contact: ${contact.name}`, 'success');
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{contact.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{contact.phone}</div>
                    </div>
                    <User size={16} style={{ color: 'var(--accent-purple)' }} />
                  </button>
                ))
              }
              {simulatedContacts.filter(c => c.name.toLowerCase().includes(simSearchQuery.toLowerCase()) || c.phone.includes(simSearchQuery)).length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No simulated contacts found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
