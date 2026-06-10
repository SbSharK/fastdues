import { useState, useEffect } from 'react';
import type { SyncConfig } from '../types';

interface GoogleDriveHookProps {
  syncConfig: SyncConfig;
  updateSyncConfig: (config: Partial<SyncConfig>) => void;
  exportStateToJSON: () => string;
  importStateFromJSON: (jsonString: string) => boolean;
  performSync: () => void;
}

export const useGoogleDrive = ({
  syncConfig,
  updateSyncConfig,
  exportStateToJSON,
  importStateFromJSON,
  performSync,
}: GoogleDriveHookProps) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [tokenExpiration, setTokenExpiration] = useState<number | null>(null);

  // Automatically load Google Identity Services Script
  useEffect(() => {
    const idScript = document.getElementById('google-gis-script');
    if (!idScript) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.id = 'google-gis-script';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // Helper to check if token is expired
  const isTokenExpired = () => {
    if (!accessToken || !tokenExpiration) return true;
    return Date.now() >= tokenExpiration;
  };

  // Sign in using Google Identity Services (OAuth2 Implicit Flow)
  const connectGoogleDrive = (customClientId?: string) => {
    const cId = customClientId || syncConfig.clientId;
    
    // Fallback: If no Client ID is specified, run Simulator Mode
    if (!cId) {
      updateSyncConfig({
        isConnected: true,
        isEnabled: true,
        email: 'simulator.user@gmail.com',
        clientId: '',
      });
      performSync(); // Initial sync
      return;
    }

    try {
      // @ts-ignore
      if (typeof google === 'undefined') {
        throw new Error('Google identity library not loaded yet. Please wait a moment and try again.');
      }

      // @ts-ignore
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error_description) {
            setSyncError(response.error_description);
            return;
          }
          if (response.access_token) {
            setAccessToken(response.access_token);
            setTokenExpiration(Date.now() + Number(response.expires_in) * 1000);
            
            // Fetch user info using token
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            })
              .then((res) => res.json())
              .then((userInfo) => {
                updateSyncConfig({
                  clientId: cId,
                  isConnected: true,
                  isEnabled: true,
                  email: userInfo.email || 'connected.user@gmail.com',
                });
                setSyncError(null);
                // Trigger initial sync
                uploadBackup(response.access_token);
              })
              .catch((err) => {
                console.error(err);
                updateSyncConfig({
                  clientId: cId,
                  isConnected: true,
                  isEnabled: true,
                  email: 'connected.user@gmail.com',
                });
                uploadBackup(response.access_token);
              });
          }
        },
      });
      client.requestAccessToken();
    } catch (e: any) {
      setSyncError(e.message || 'Failed to initialize Google Auth');
      console.error(e);
    }
  };

  // Disconnect Google Drive
  const disconnectGoogleDrive = () => {
    setAccessToken(null);
    setTokenExpiration(null);
    updateSyncConfig({
      isConnected: false,
      isEnabled: false,
      email: null,
      lastSyncHash: null,
    });
  };

  // Actual upload backup function via Drive REST API
  const uploadBackup = async (token: string) => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const dbContent = exportStateToJSON();
      const fileName = 'dues_tracker_backup.json';

      // 1. Search for existing file
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const searchData = await searchRes.json();
      const existingFile = searchData.files && searchData.files[0];

      let uploadRes;
      if (existingFile) {
        // 2. Update existing file (PATCH)
        uploadRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: dbContent,
          }
        );
      } else {
        // 3. Create new file (Multipart POST)
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
        };
        const boundary = 'foo_bar_boundary';
        
        const multipartBody = 
          `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
          `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${dbContent}` +
          `\r\n--${boundary}--`;

        uploadRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );
      }

      if (uploadRes.ok) {
        performSync();
      } else {
        const errorText = await uploadRes.text();
        throw new Error(`Upload failed: ${uploadRes.status} ${errorText}`);
      }
    } catch (e: any) {
      console.error('Drive backup failed:', e);
      setSyncError(e.message || 'Backup failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore backup from Google Drive
  const restoreBackup = async (token: string): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const fileName = 'dues_tracker_backup.json';
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id)`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const searchData = await searchRes.json();
      const existingFile = searchData.files && searchData.files[0];

      if (!existingFile) {
        throw new Error('No backup file found in Google Drive');
      }

      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (fileRes.ok) {
        const fileContent = await fileRes.text();
        const success = importStateFromJSON(fileContent);
        if (success) {
          performSync();
          return true;
        } else {
          throw new Error('Backup file format is invalid');
        }
      } else {
        throw new Error('Failed to download backup file');
      }
    } catch (e: any) {
      console.error('Drive restore failed:', e);
      setSyncError(e.message || 'Restore failed');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Integrated sync trigger that manages OAuth2 token refreshing
  const triggerSync = async (): Promise<boolean> => {
    // Simulator Mode Trigger
    if (!syncConfig.clientId) {
      setIsSyncing(true);
      return new Promise((resolve) => {
        setTimeout(() => {
          performSync();
          setIsSyncing(false);
          resolve(true);
        }, 1200);
      });
    }

    if (isTokenExpired() || !accessToken) {
      // Token is missing/expired, request authorization again
      return new Promise((resolve) => {
        try {
          // @ts-ignore
          const client = google.accounts.oauth2.initTokenClient({
            client_id: syncConfig.clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: async (response: any) => {
              if (response.access_token) {
                setAccessToken(response.access_token);
                setTokenExpiration(Date.now() + Number(response.expires_in) * 1000);
                await uploadBackup(response.access_token);
                resolve(true);
              } else {
                setSyncError('Failed to refresh authentication token');
                resolve(false);
              }
            },
          });
          client.requestAccessToken();
        } catch (err: any) {
          setSyncError(err.message || 'Failed to refresh login');
          resolve(false);
        }
      });
    } else {
      await uploadBackup(accessToken);
      return true;
    }
  };

  // Restore trigger
  const triggerRestore = async (): Promise<boolean> => {
    // Simulator Mode Restore
    if (!syncConfig.clientId) {
      setIsSyncing(true);
      return new Promise((resolve) => {
        setTimeout(() => {
          // Import empty/sandbox data
          setIsSyncing(false);
          resolve(false); // Fail mock restore unless we generate dummy json
        }, 1000);
      });
    }

    if (isTokenExpired() || !accessToken) {
      return new Promise((resolve) => {
        try {
          // @ts-ignore
          const client = google.accounts.oauth2.initTokenClient({
            client_id: syncConfig.clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: async (response: any) => {
              if (response.access_token) {
                setAccessToken(response.access_token);
                setTokenExpiration(Date.now() + Number(response.expires_in) * 1000);
                const success = await restoreBackup(response.access_token);
                resolve(success);
              } else {
                resolve(false);
              }
            },
          });
          client.requestAccessToken();
        } catch (err) {
          resolve(false);
        }
      });
    } else {
      return await restoreBackup(accessToken);
    }
  };

  return {
    isSyncing,
    syncError,
    connectGoogleDrive,
    disconnectGoogleDrive,
    triggerSync,
    triggerRestore,
    isSimulatorMode: !syncConfig.clientId && syncConfig.isConnected,
  };
};
