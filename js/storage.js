'use strict';

async function openDB() {
  return new Promise((resolve, reject) => {
    try {
      if (!window.indexedDB) {
        return reject(new Error('IndexedDB not supported in this browser.'));
      }
      const request = window.indexedDB.open('APLogAnalyzer', 1);
      
      request.onerror = (e) => reject(request.error);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessionData')) {
          db.createObjectStore('sessionData', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (e) => {
        resolve(e.target.result);
      };
    } catch (e) {
      reject(e);
    }
  });
}

async function saveSession(session, rawText) {
  try {
    const db = await openDB();
    const sessionMeta = { ...session };
    delete sessionMeta.rows;
    
    const sessionDataObj = {
      id: session.id,
      rows: session.rows,
      rawText: rawText
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'sessionData'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      
      const storeSessions = tx.objectStore('sessions');
      const storeData = tx.objectStore('sessionData');
      
      storeSessions.put(sessionMeta);
      storeData.put(sessionDataObj);
    });
  } catch (e) {
    console.warn('Failed to save session:', e);
    return null;
  }
}

async function loadSessionList() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('Failed to load session list:', e);
    return [];
  }
}

async function loadSessionData(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessionData', 'readonly');
      const store = tx.objectStore('sessionData');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`Failed to load session data for id ${id}:`, e);
    return null;
  }
}

async function deleteSession(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'sessionData'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      
      const storeSessions = tx.objectStore('sessions');
      const storeData = tx.objectStore('sessionData');
      
      storeSessions.delete(id);
      storeData.delete(id);
    });
  } catch (e) {
    console.warn(`Failed to delete session for id ${id}:`, e);
    return null;
  }
}

async function deleteAllSessions() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['sessions', 'sessionData'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      
      const storeSessions = tx.objectStore('sessions');
      const storeData = tx.objectStore('sessionData');
      
      storeSessions.clear();
      storeData.clear();
    });
  } catch (e) {
    console.warn('Failed to delete all sessions:', e);
    return null;
  }
}

async function getStorageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };
      
      return {
        usage: est.usage,
        quota: est.quota,
        usageStr: est.usage ? formatBytes(est.usage) : '0 B',
        quotaStr: est.quota ? formatBytes(est.quota) : 'Unknown'
      };
    } else {
      return { usage: 0, quota: 0, usageStr: 'Unknown', quotaStr: 'Unknown' };
    }
  } catch (e) {
    console.warn('Failed to get storage estimate:', e);
    return { usage: 0, quota: 0, usageStr: 'Unknown', quotaStr: 'Unknown' };
  }
}

window.Storage = {
  saveSession,
  loadSessionList,
  loadSessionData,
  deleteSession,
  deleteAllSessions,
  getStorageEstimate
};
