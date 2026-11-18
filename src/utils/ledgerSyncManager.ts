import {
  EquipmentItem,
  ProjectWorkspace,
  SpecIssuanceRecord,
  SpecLedgerFile,
} from '../types';
import {
  PermissionRequiredError,
  FileMissingError,
  checkFileHandlePermission,
  requestFileHandlePermission,
} from './sharedSyncManager';

const DB_STORE_NAME = 'specforge_project_handles';
const LEDGER_KEY_PREFIX = 'spec_ledger_';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_STORE_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLedgerHandleForProject(
  projectId: string,
  handle: FileSystemFileHandle
): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, `${LEDGER_KEY_PREFIX}${projectId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedLedgerHandleForProject(
  projectId: string
): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(`${LEDGER_KEY_PREFIX}${projectId}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function removeSavedLedgerHandleForProject(
  projectId: string
): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete(`${LEDGER_KEY_PREFIX}${projectId}`);
      tx.oncomplete = () => resolve();
    });
  } catch {
    // ignore
  }
}

export function createEmptyLedgerPayload(
  project?: Partial<ProjectWorkspace>,
  projectIdOverride?: string
): SpecLedgerFile {
  return {
    schemaType: 'specforge-issuance-ledger',
    version: '1.0',
    projectId: project?.id || projectIdOverride || 'prj-main',
    projectOrderNo: project?.orderNo || '',
    projectCode: project?.code || '',
    projectName: project?.name || '',
    lastUpdated: new Date().toISOString(),
    records: [],
  };
}

export function normalizeLedgerJson(
  rawJson: any,
  projectId: string,
  project?: Partial<ProjectWorkspace>
): SpecLedgerFile {
  if (!rawJson || typeof rawJson !== 'object') {
    return createEmptyLedgerPayload(project, projectId);
  }

  const rawRecords = Array.isArray(rawJson)
    ? rawJson
    : Array.isArray(rawJson.records)
      ? rawJson.records
      : [];

  const records: SpecIssuanceRecord[] = rawRecords
    .filter((r: any) => r && typeof r === 'object')
    .map((r: any, idx: number) => ({
      id: String(r.id || `spec-${Date.now()}-${idx}`),
      projectId,
      title: String(r.title || (Array.isArray(r.itemTagNos) ? r.itemTagNos[0] : '') || r.docNo || `仕様書-${idx + 1}`),
      docNo: String(r.docNo || ''),
      templateId: String(r.templateId || ''),
      templateName: String(r.templateName || ''),
      orderedItemIds: Array.isArray(r.orderedItemIds) ? r.orderedItemIds.map(String) : [],
      primaryItemId: String(r.primaryItemId || (Array.isArray(r.orderedItemIds) ? r.orderedItemIds[0] : '') || ''),
      itemTagNos: Array.isArray(r.itemTagNos) ? r.itemTagNos.map(String) : [],
      itemNames: Array.isArray(r.itemNames) ? r.itemNames.map(String) : [],
      currentRevision: (Number(r.currentRevision) >= 0 && Number(r.currentRevision) <= 3
        ? Number(r.currentRevision)
        : 0) as 0 | 1 | 2 | 3,
      revisions: Array.isArray(r.revisions) ? r.revisions : [],
      createdAt: String(r.createdAt || new Date().toISOString()),
      updatedAt: String(r.updatedAt || r.createdAt || new Date().toISOString()),
    }));

  return {
    schemaType: 'specforge-issuance-ledger',
    version: String(rawJson.version || '1.0') as '1.0',
    projectId,
    projectOrderNo: rawJson.projectOrderNo ?? project?.orderNo ?? '',
    projectCode: rawJson.projectCode ?? project?.code ?? '',
    projectName: rawJson.projectName ?? project?.name ?? '',
    lastUpdated: String(rawJson.lastUpdated || new Date().toISOString()),
    records,
  };
}

export async function readLedgerFromHandle(
  handle: FileSystemFileHandle,
  projectId: string,
  project?: Partial<ProjectWorkspace>,
  options?: { allowPromptRequest?: boolean }
): Promise<{ ledger: SpecLedgerFile; fileName: string }> {
  try {
    const allowPrompt = options?.allowPromptRequest ?? false;
    const perm = await checkFileHandlePermission(handle, 'read');
    if (perm !== 'granted') {
      if (!allowPrompt) {
        throw new PermissionRequiredError(
          'ブラウザの更新または新規ウィンドウ起動のため、発行台帳JSONへの再アクセス許可が必要です。'
        );
      }
      const req = await requestFileHandlePermission(handle, 'readwrite').catch(async () => {
        return await requestFileHandlePermission(handle, 'read');
      });
      if (req !== 'granted') {
        throw new PermissionRequiredError(
          '発行台帳JSONへのアクセス許可が保留または拒否されました。もう一度クリックして許可してください。'
        );
      }
    }

    const file = await handle.getFile();
    const text = await file.text();
    if (!text.trim()) {
      return {
        ledger: createEmptyLedgerPayload(project, projectId),
        fileName: file.name,
      };
    }

    const parsed = JSON.parse(text);
    const ledger = normalizeLedgerJson(parsed, projectId, project);
    return { ledger, fileName: file.name };
  } catch (err: any) {
    if (err instanceof PermissionRequiredError || err instanceof FileMissingError) {
      throw err;
    }
    if (
      err.name === 'NotFoundError' ||
      err.message?.includes('not found') ||
      err.message?.includes('A requested file or directory could not be found')
    ) {
      throw new FileMissingError(
        '紐づけ元の仕様書発行台帳JSONファイルが見つかりません。移動または削除された可能性があります。'
      );
    }
    if (
      err.name === 'SecurityError' ||
      err.name === 'NotAllowedError' ||
      err.message?.toLowerCase().includes('permission') ||
      err.message?.includes('activation')
    ) {
      throw new PermissionRequiredError(
        '発行台帳JSONへのアクセス許可が必要です。ボタンをクリックして連動を再開してください。'
      );
    }
    throw err;
  }
}

export async function writeLedgerToHandle(
  handle: FileSystemFileHandle,
  ledger: SpecLedgerFile,
  options?: { allowPromptRequest?: boolean }
): Promise<void> {
  try {
    const allowPrompt = options?.allowPromptRequest ?? false;
    const perm = await checkFileHandlePermission(handle, 'readwrite');
    if (perm !== 'granted') {
      if (!allowPrompt) {
        throw new PermissionRequiredError(
          '発行台帳JSONへの書き込みには再アクセス許可が必要です。'
        );
      }
      const req = await requestFileHandlePermission(handle, 'readwrite');
      if (req !== 'granted') {
        throw new PermissionRequiredError(
          '発行台帳JSONへの書き込み許可が得られませんでした。もう一度お試しください。'
        );
      }
    }

    const serialized: SpecLedgerFile = {
      ...ledger,
      schemaType: 'specforge-issuance-ledger',
      version: '1.0',
      lastUpdated: new Date().toISOString(),
    };

    const writable = await (handle as any).createWritable();
    await writable.write(JSON.stringify(serialized, null, 2));
    await writable.close();
  } catch (err: any) {
    if (err instanceof PermissionRequiredError || err instanceof FileMissingError) {
      throw err;
    }
    if (
      err.name === 'NotFoundError' ||
      err.message?.includes('not found') ||
      err.message?.includes('A requested file or directory could not be found')
    ) {
      throw new FileMissingError(
        '書き込み先の仕様書発行台帳JSONファイルが見つかりません。'
      );
    }
    if (
      err.name === 'SecurityError' ||
      err.name === 'NotAllowedError' ||
      err.message?.toLowerCase().includes('permission') ||
      err.message?.includes('activation')
    ) {
      throw new PermissionRequiredError(
        '発行台帳JSONへの書き込み許可が必要です。'
      );
    }
    throw err;
  }
}

/**
 * Generates compact equipment tag range title for specification ledger storage.
 * Examples:
 * - ['03-001'] => '03-001'
 * - ['03-001', '03-002', '03-003', '03-004'] => '03-001～004'
 * - ['03-001', '03-003', '03-004'] => '03-001, 03-003～004'
 * - ['03-001', '03-002', '04-001'] => '03-001～002 / 04-001'
 */
export function formatEquipmentTagRangeTitle(items: EquipmentItem[]): string {
  const tags = Array.from(
    new Set(
      items
        .map((it) => (it.tagNo || '').trim())
        .filter(Boolean)
    )
  );

  if (tags.length === 0) return '機器未選択';
  if (tags.length === 1) return tags[0];

  type ParsedTag = { raw: string; prefix: string; num: number; width: number };
  const parsedList: ParsedTag[] = [];
  const otherTags: string[] = [];

  for (const tag of tags) {
    const m = tag.match(/^([0-9A-Za-z]+-)([0-9]+)$/);
    if (m) {
      parsedList.push({
        raw: tag,
        prefix: m[1],
        num: parseInt(m[2], 10),
        width: m[2].length,
      });
    } else {
      otherTags.push(tag);
    }
  }

  // Group by prefix and sort numerically
  const byPrefix: Record<string, ParsedTag[]> = {};
  for (const p of parsedList) {
    if (!byPrefix[p.prefix]) byPrefix[p.prefix] = [];
    byPrefix[p.prefix].push(p);
  }

  const prefixGroups: string[] = [];
  for (const prefix of Object.keys(byPrefix).sort()) {
    const sorted = byPrefix[prefix].sort((a, b) => a.num - b.num);
    const runs: string[] = [];
    let runStart = sorted[0];
    let runPrev = sorted[0];

    const flushRun = (start: ParsedTag, end: ParsedTag) => {
      if (start.num === end.num) {
        runs.push(start.raw);
      } else {
        const endStr = String(end.num).padStart(end.width, '0');
        runs.push(`${start.raw}～${endStr}`);
      }
    };

    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      if (curr.num === runPrev.num + 1) {
        runPrev = curr;
      } else {
        flushRun(runStart, runPrev);
        runStart = curr;
        runPrev = curr;
      }
    }
    flushRun(runStart, runPrev);
    prefixGroups.push(runs.join(', '));
  }

  const allParts = [...prefixGroups, ...otherTags];
  return allParts.join(' / ');
}
