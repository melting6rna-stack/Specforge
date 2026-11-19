import { SpecMappingAssetFile, SpecTemplate } from '../types';
import { parseExcelTemplateFile } from './excelTemplateParser';
import { importMappingAssetFromJson } from './exceljsEngine';
import { PermissionRequiredError } from './sharedSyncManager';
import { normalizeSpecTemplate } from './templateUtils';

const DB_STORE_NAME = 'specforge_project_handles';
const FOLDER_HANDLE_KEY = 'template_source_folder_handle';
const FOLDER_CACHE_KEY = 'template_source_folder_cache';

export interface FolderScanStats {
  excelCount: number;
  mappingCount: number;
  pairedCount: number;
}

export interface CachedTemplateFolderPayload {
  folderName: string;
  mode: 'handle' | 'upload_cache';
  lastSyncAt: string;
  stats: FolderScanStats;
  templates: SpecTemplate[];
}

export interface ScannedFolderEntry {
  file: File;
  relativePath: string;
}

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

export async function saveTemplateFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, FOLDER_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedTemplateFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(FOLDER_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function removeSavedTemplateFolderHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete(FOLDER_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function saveCachedFolderTemplates(payload: CachedTemplateFolderPayload): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(payload, FOLDER_CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to cache folder templates in IndexedDB:', e);
  }
}

export async function getCachedFolderTemplates(): Promise<CachedTemplateFolderPayload | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(FOLDER_CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearCachedFolderTemplates(): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete(FOLDER_CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function checkDirectoryHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<'granted' | 'prompt' | 'denied'> {
  try {
    if (typeof (handle as any).queryPermission === 'function') {
      return await (handle as any).queryPermission({ mode });
    }
    return 'granted';
  } catch {
    return 'prompt';
  }
}

export async function requestDirectoryHandlePermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<'granted' | 'prompt' | 'denied'> {
  const current = await checkDirectoryHandlePermission(handle, mode);
  if (current === 'granted') return 'granted';
  if (typeof (handle as any).requestPermission === 'function') {
    return await (handle as any).requestPermission({ mode });
  }
  return 'granted';
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function shouldSkipTemplateFolderFile(fileName: string): boolean {
  const clean = fileName.trim();
  if (!clean) return true;
  if (clean.startsWith('~$') || clean.startsWith('.')) return true;
  if (clean.toLowerCase() === 'thumbs.db') return true;
  return false;
}

export function normalizeStemName(fileName: string): string {
  const nfc = fileName.normalize('NFC').trim();
  const lower = nfc.toLowerCase();
  if (lower.endsWith('.specmap.json')) {
    return nfc.slice(0, -'.specmap.json'.length).trim().toLowerCase();
  }
  if (lower.endsWith('.json')) {
    return nfc.slice(0, -'.json'.length).trim().toLowerCase();
  }
  if (lower.endsWith('.xlsx')) {
    return nfc.slice(0, -'.xlsx'.length).trim().toLowerCase();
  }
  if (lower.endsWith('.xlsm')) {
    return nfc.slice(0, -'.xlsm'.length).trim().toLowerCase();
  }
  return nfc.replace(/\.[^/.]+$/, '').trim().toLowerCase();
}

export function stripExcelExtension(fileName: string): string {
  const nfc = fileName.normalize('NFC').trim();
  const lower = nfc.toLowerCase();
  if (lower.endsWith('.xlsx')) return nfc.slice(0, -5);
  if (lower.endsWith('.xlsm')) return nfc.slice(0, -5);
  return nfc.replace(/\.[^/.]+$/, '');
}

export function getDefaultMappingFileName(template: SpecTemplate): string {
  if (template.mappingFileName && template.mappingFileName.toLowerCase().endsWith('.json')) {
    return template.mappingFileName;
  }
  const excelRef = template.excelFileName || template.masterFileName || template.originalFileName;
  if (excelRef) {
    return `${stripExcelExtension(excelRef)}.specmap.json`;
  }
  const safeName = (template.name || 'template').replace(/[\s/\\?%*:|"<>]/g, '_');
  return `${safeName}.specmap.json`;
}

function getDirPart(relativePath: string): string {
  const norm = relativePath.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(0, idx).normalize('NFC').toLowerCase() : '';
}

function isLikelyMappingAssetJson(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  if (parsed.schemaType === 'specforge-mapping-asset') return true;
  if (Array.isArray(parsed.fields) && (parsed.templateName || parsed.name || parsed.templateId || parsed.masterFileName)) {
    return true;
  }
  return false;
}

/**
 * Pairs .xlsx / .xlsm templates with same-named .specmap.json / .json mapping files
 * from a scanned list of entries inside a reference folder.
 */
export async function loadTemplatesFromScannedEntries(
  entries: ScannedFolderEntry[],
  folderName: string
): Promise<{ templates: SpecTemplate[]; stats: FolderScanStats }> {
  interface ExcelEntry {
    file: File;
    relativePath: string;
    dirPart: string;
    stem: string;
    nameLower: string;
  }
  interface MappingEntry {
    file: File;
    relativePath: string;
    dirPart: string;
    stem: string;
    isSpecmap: boolean;
    asset: SpecMappingAssetFile;
    used: boolean;
  }

  const excelEntries: ExcelEntry[] = [];
  const mappingEntries: MappingEntry[] = [];

  for (const entry of entries) {
    const file = entry.file;
    if (shouldSkipTemplateFolderFile(file.name)) continue;

    const lower = file.name.normalize('NFC').toLowerCase();
    const relPath = entry.relativePath.replace(/\\/g, '/').normalize('NFC');
    const dirPart = getDirPart(relPath);

    if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
      excelEntries.push({
        file,
        relativePath: relPath,
        dirPart,
        stem: normalizeStemName(file.name),
        nameLower: file.name.normalize('NFC').trim().toLowerCase(),
      });
    } else if (lower.endsWith('.specmap.json') || lower.endsWith('.json')) {
      try {
        const text = await file.text();
        if (!text.trim()) continue;
        const parsed = JSON.parse(text);
        if (!isLikelyMappingAssetJson(parsed)) continue;
        const asset = importMappingAssetFromJson(text);
        mappingEntries.push({
          file,
          relativePath: relPath,
          dirPart,
          stem: normalizeStemName(file.name),
          isSpecmap: lower.endsWith('.specmap.json'),
          asset,
          used: false,
        });
      } catch {
        // Ignore invalid or unrelated JSON files
      }
    }
  }

  const pickBestMapping = (candidates: MappingEntry[]): MappingEntry | undefined => {
    if (candidates.length === 0) return undefined;
    const sorted = [...candidates].sort((a, b) => Number(b.isSpecmap) - Number(a.isSpecmap));
    return sorted[0];
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const templates: SpecTemplate[] = [];
  let pairedCount = 0;

  // Sort excel entries cleanly by relative path
  excelEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'ja'));

  for (const ex of excelEntries) {
    // 1. Exact directory + same stem match
    let matched = pickBestMapping(
      mappingEntries.filter((m) => !m.used && m.dirPart === ex.dirPart && m.stem === ex.stem)
    );
    // 2. Same directory + masterFileName / excelFileName match
    if (!matched) {
      matched = pickBestMapping(
        mappingEntries.filter((m) => {
          if (m.used || m.dirPart !== ex.dirPart) return false;
          const ref = (m.asset.excelFileName || m.asset.masterFileName || '').normalize('NFC').trim().toLowerCase();
          return ref !== '' && ref === ex.nameLower;
        })
      );
    }
    // 3. Anywhere in folder + same stem match (when unique or unambiguous)
    if (!matched) {
      matched = pickBestMapping(
        mappingEntries.filter((m) => !m.used && m.stem === ex.stem)
      );
    }
    // 4. Anywhere in folder + masterFileName / excelFileName match
    if (!matched) {
      matched = pickBestMapping(
        mappingEntries.filter((m) => {
          if (m.used) return false;
          const ref = (m.asset.excelFileName || m.asset.masterFileName || '').normalize('NFC').trim().toLowerCase();
          return ref !== '' && ref === ex.nameLower;
        })
      );
    }

    const stemKey = (ex.dirPart ? `${ex.dirPart}/${ex.stem}` : ex.stem).replace(/\s+/g, '_');
    const deterministicId = `tpl-folder::${stemKey}`;
    const excelDisplayName = stripExcelExtension(ex.file.name);

    if (matched) {
      matched.used = true;
      pairedCount++;

      const buffer = await ex.file.arrayBuffer();
      const rawBase64 = arrayBufferToBase64(buffer);

      const tpl = normalizeSpecTemplate({
        id: deterministicId,
        code: matched.asset.templateCode || '',
        name: matched.asset.templateName || excelDisplayName,
        description:
          matched.asset.description ||
          `フォルダ「${folderName}」の雛形Excel (${ex.file.name}) とマッピング定義 (${matched.file.name}) を自動連携`,
        targetCategoryName: matched.asset.targetCategoryName || '汎用',
        columns: ['機器名', '数量', '納期', '特記事項'],
        inspectionStandard: '受入検査基準に準拠する。',
        warrantyPeriod: '引渡完了日より1年間。',
        deliveryTerms: '指定工場受入口納入。',
        notesTemplate: '・仕様に関する特記事項および指示事項を記載。',
        sourceType: 'custom_excel',
        originalFileName: ex.file.name,
        masterFileName: ex.file.name,
        rawWorkbookBase64: rawBase64,
        masterWorkbookBase64: rawBase64,
        fields: matched.asset.fields || [],
        tableMapping: matched.asset.tableMapping,
        sourceLocation: 'folder',
        folderName,
        folderRelativePath: ex.relativePath,
        excelFileName: ex.file.name,
        mappingFileName: matched.file.name,
        hasPairedMappingFile: true,
        updatedAt: matched.asset.exportedAt ? matched.asset.exportedAt.slice(0, 10) : todayStr,
      });

      templates.push(tpl);
    } else {
      const parsed = await parseExcelTemplateFile(ex.file);
      const tpl = normalizeSpecTemplate({
        ...parsed.template,
        id: deterministicId,
        name: excelDisplayName || parsed.template.name,
        description: `フォルダ「${folderName}」から読込 (${ex.file.name}) · 同名マッピングJSON未配置のため既定マッピングを適用`,
        masterFileName: ex.file.name,
        masterWorkbookBase64: parsed.template.rawWorkbookBase64,
        sourceLocation: 'folder',
        folderName,
        folderRelativePath: ex.relativePath,
        excelFileName: ex.file.name,
        mappingFileName: undefined,
        hasPairedMappingFile: false,
        updatedAt: todayStr,
      });
      templates.push(tpl);
    }
  }

  // Also load standalone .specmap.json files that bundle masterWorkbookBase64 when no matching .xlsx sits alongside
  for (const m of mappingEntries) {
    if (m.used || !m.asset.masterWorkbookBase64) continue;
    const stemKey = (m.dirPart ? `${m.dirPart}/${m.stem}` : m.stem).replace(/\s+/g, '_');
    const deterministicId = `tpl-folder::${stemKey}`;
    if (templates.some((t) => t.id === deterministicId)) continue;

    pairedCount++;
    const tpl = normalizeSpecTemplate({
      id: deterministicId,
      code: m.asset.templateCode || '',
      name: m.asset.templateName || stripExcelExtension(m.file.name),
      description:
        m.asset.description ||
        `フォルダ「${folderName}」のマッピング定義 (${m.file.name}) から復元`,
      targetCategoryName: m.asset.targetCategoryName || '汎用',
      columns: ['機器名', '数量', '納期', '特記事項'],
      inspectionStandard: '受入検査基準に準拠する。',
      warrantyPeriod: '引渡完了日より1年間。',
      deliveryTerms: '指定工場受入口納入。',
      notesTemplate: '・仕様に関する特記事項および指示事項を記載。',
      sourceType: 'custom_excel',
      originalFileName: m.asset.excelFileName || m.asset.masterFileName,
      masterFileName: m.asset.masterFileName || m.asset.excelFileName,
      rawWorkbookBase64: m.asset.masterWorkbookBase64,
      masterWorkbookBase64: m.asset.masterWorkbookBase64,
      fields: m.asset.fields || [],
      tableMapping: m.asset.tableMapping,
      sourceLocation: 'folder',
      folderName,
      folderRelativePath: m.relativePath,
      excelFileName: m.asset.excelFileName || m.asset.masterFileName,
      mappingFileName: m.file.name,
      hasPairedMappingFile: true,
      updatedAt: m.asset.exportedAt ? m.asset.exportedAt.slice(0, 10) : todayStr,
    });
    templates.push(tpl);
  }

  return {
    templates,
    stats: {
      excelCount: excelEntries.length,
      mappingCount: mappingEntries.length,
      pairedCount,
    },
  };
}

async function collectDirectoryEntries(
  dirHandle: FileSystemDirectoryHandle,
  prefix = '',
  depth = 0,
  maxDepth = 3
): Promise<ScannedFolderEntry[]> {
  const entries: ScannedFolderEntry[] = [];
  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (shouldSkipTemplateFolderFile(name)) continue;
    const relPath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      const lower = name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.json')) {
        const file = await (handle as FileSystemFileHandle).getFile();
        entries.push({ file, relativePath: relPath });
      }
    } else if (handle.kind === 'directory' && depth < maxDepth) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const subEntries = await collectDirectoryEntries(
        handle as FileSystemDirectoryHandle,
        relPath,
        depth + 1,
        maxDepth
      );
      entries.push(...subEntries);
    }
  }
  return entries;
}

export async function scanDirectoryHandleForTemplates(
  dirHandle: FileSystemDirectoryHandle,
  options?: { allowPromptRequest?: boolean }
): Promise<{ templates: SpecTemplate[]; stats: FolderScanStats; folderName: string }> {
  try {
    const allowPrompt = options?.allowPromptRequest ?? false;
    const perm = await checkDirectoryHandlePermission(dirHandle, 'read');
    if (perm !== 'granted') {
      if (!allowPrompt) {
        throw new PermissionRequiredError(
          '参照元フォルダへの再アクセス許可が必要です。ボタンを1クリックして再読込してください。'
        );
      }
      const req = await requestDirectoryHandlePermission(dirHandle, 'readwrite').catch(async () => {
        return await requestDirectoryHandlePermission(dirHandle, 'read');
      });
      if (req !== 'granted') {
        throw new PermissionRequiredError('参照元フォルダへのアクセス許可が得られませんでした。');
      }
    }

    const scanned = await collectDirectoryEntries(dirHandle);
    const { templates, stats } = await loadTemplatesFromScannedEntries(scanned, dirHandle.name);
    return {
      templates,
      stats,
      folderName: dirHandle.name,
    };
  } catch (err: any) {
    if (err instanceof PermissionRequiredError) throw err;
    if (
      err?.name === 'SecurityError' ||
      err?.name === 'NotAllowedError' ||
      err?.message?.toLowerCase().includes('permission') ||
      err?.message?.includes('activation')
    ) {
      throw new PermissionRequiredError('参照元フォルダへのアクセス許可が必要です。');
    }
    throw err;
  }
}

export async function loadTemplatesFromFileList(
  fileList: FileList | File[]
): Promise<{ templates: SpecTemplate[]; stats: FolderScanStats; folderName: string }> {
  const files = Array.from(fileList);
  let detectedFolderName = '登録フォルダ';
  const entries: ScannedFolderEntry[] = [];

  for (const file of files) {
    if (shouldSkipTemplateFolderFile(file.name)) continue;
    const relRaw = (file as any).webkitRelativePath as string | undefined;
    let relativePath = file.name;
    if (relRaw && relRaw.includes('/')) {
      const parts = relRaw.split('/').filter(Boolean);
      if (parts.length > 1) {
        detectedFolderName = parts[0];
        relativePath = parts.slice(1).join('/');
      }
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.json')) {
      entries.push({ file, relativePath });
    }
  }

  const { templates, stats } = await loadTemplatesFromScannedEntries(entries, detectedFolderName);
  return {
    templates,
    stats,
    folderName: detectedFolderName,
  };
}

export async function writeMappingToTemplateFolder(
  dirHandle: FileSystemDirectoryHandle,
  template: SpecTemplate,
  options?: { allowPromptRequest?: boolean }
): Promise<{ fileName: string }> {
  const allowPrompt = options?.allowPromptRequest ?? true;
  const perm = await checkDirectoryHandlePermission(dirHandle, 'readwrite');
  if (perm !== 'granted') {
    if (!allowPrompt) {
      throw new PermissionRequiredError('参照元フォルダへのマッピングJSON書き込み許可が必要です。');
    }
    const req = await requestDirectoryHandlePermission(dirHandle, 'readwrite');
    if (req !== 'granted') {
      throw new PermissionRequiredError('参照元フォルダへの書き込み権限が許可されませんでした。');
    }
  }

  // Resolve target subdirectory if the template sits inside a subfolder
  let targetDir = dirHandle;
  if (template.folderRelativePath && template.folderRelativePath.includes('/')) {
    const parts = template.folderRelativePath.split('/').filter(Boolean);
    const subDirs = parts.slice(0, -1);
    for (const sub of subDirs) {
      targetDir = await targetDir.getDirectoryHandle(sub, { create: true });
    }
  }

  const targetFileName = getDefaultMappingFileName(template);
  const normalized = normalizeSpecTemplate(template);
  const asset: SpecMappingAssetFile = {
    version: '1.0',
    schemaType: 'specforge-mapping-asset',
    exportedAt: new Date().toISOString(),
    templateId: normalized.id,
    templateName: normalized.name,
    templateCode: normalized.code,
    description: normalized.description,
    targetCategoryName: normalized.targetCategoryName,
    fields: normalized.fields || [],
    masterFileName: normalized.excelFileName || normalized.masterFileName || normalized.originalFileName,
    excelFileName: normalized.excelFileName || normalized.masterFileName || normalized.originalFileName,
    masterWorkbookBase64: normalized.masterWorkbookBase64 || normalized.rawWorkbookBase64,
  };

  const fileHandle = await targetDir.getFileHandle(targetFileName, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(JSON.stringify(asset, null, 2));
  await writable.close();

  return { fileName: targetFileName };
}
