import { EquipmentItem, Category, SpecTemplate, ProjectWorkspace } from '../types';

export interface DatabasePayload {
  version: string;
  lastUpdated: string;
  updatedBy?: string;
  projects: ProjectWorkspace[];
  categories: Category[];
  templates: SpecTemplate[];
  items: EquipmentItem[];
}

export interface SyncConfig {
  mode: 'none' | 'file_handle' | 'network_url';
  networkFileName?: string;
  networkUrl?: string;
  autoSyncIntervalMs: number; // 300,000 = 5 minutes
  autoSyncEnabled: boolean;
  lastSyncTime?: string;
}

const SYNC_CONFIG_KEY = 'specforge_sync_config';
const DB_STORE_NAME = 'specforge_file_handles';
const HANDLE_KEY = 'shared_network_json_handle';

// Simple IndexedDB wrapper to persist FileSystemFileHandle across browser sessions
function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_STORE_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('handles');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFileHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function removeSavedFileHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
    });
  } catch (e) {
    // ignore
  }
}

export function getSyncConfig(): SyncConfig {
  try {
    const saved = localStorage.getItem(SYNC_CONFIG_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    // fallback
  }
  return {
    mode: 'none',
    autoSyncIntervalMs: 300000, // 5 minutes
    autoSyncEnabled: true,
  };
}

export function saveSyncConfig(cfg: SyncConfig) {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
}

/**
 * Reads database JSON from linked FileSystemFileHandle.
 */
export async function readFromHandle(handle: FileSystemFileHandle): Promise<DatabasePayload> {
  // Query permission
  const perm = await (handle as any).queryPermission({ mode: 'read' });
  if (perm !== 'granted') {
    const req = await (handle as any).requestPermission({ mode: 'read' });
    if (req !== 'granted') {
      throw new Error('共有ファイルへの読み取り権限が許可されませんでした');
    }
  }

  const file = await handle.getFile();
  const text = await file.text();
  const data = JSON.parse(text);
  return data;
}

/**
 * Writes updated database JSON back to the linked FileSystemFileHandle.
 */
export async function writeToHandle(handle: FileSystemFileHandle, payload: DatabasePayload): Promise<void> {
  const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    const req = await (handle as any).requestPermission({ mode: 'readwrite' });
    if (req !== 'granted') {
      throw new Error('共有ファイルへの書き込み権限が許可されませんでした');
    }
  }

  const writable = await (handle as any).createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

/**
 * Fetches database JSON from a local network URL.
 */
export async function fetchFromNetworkUrl(url: string): Promise<DatabasePayload> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) {
    throw new Error(`共有ネットワークからのデータ取得に失敗しました (ステータス: ${res.status})`);
  }
  return await res.json();
}
