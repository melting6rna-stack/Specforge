import { EquipmentItem, Category, SpecTemplate, ProjectWorkspace, EquipmentSpecParam, ChangeLog } from '../types';
import { formatTagNo, parseTagNo } from './tagNumbering';

export interface DatabasePayload {
  version: string;
  lastUpdated: string;
  updatedBy?: string;
  projects?: ProjectWorkspace[];
  categories?: Category[];
  templates?: SpecTemplate[];
  items: EquipmentItem[];
  schemaType?: 'tokki-equipment' | 'specforge-v2' | 'generic';
  rawDocument?: any;
}

const DB_STORE_NAME = 'specforge_project_handles';

// IndexedDB wrapper to persist FileSystemFileHandle across browser reloads per project
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

export async function saveFileHandleForProject(projectId: string, handle: FileSystemFileHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, projectId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedFileHandleForProject(projectId: string): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(projectId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function removeSavedFileHandleForProject(projectId: string): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete(projectId);
      tx.oncomplete = () => resolve();
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Universal Coating / Painting Specification Extractor.
 * Robustly inspects all potential locations where Copilot or human authors place painting information:
 * 1. raw.coating (object with specification/color/target_part/note OR raw string)
 * 2. raw.paint / raw.painting / raw['塗装'] / raw['塗装仕様'] / raw['外面塗装'] / raw['内面塗装']
 * 3. raw.specifications array (items named 塗装, 塗装仕様, 外面塗装, etc.)
 * 4. raw.materials array (parts named 塗装, 外面塗装, 表面処理, etc.)
 * 5. raw.requirements array (type === '塗装要求' or text mentioning 塗装, 防食, マンセル, エポキシ, ウレタン)
 * 6. raw.remarks array (lines mentioning 塗装, 防食, マンセル, エポキシ, ウレタン)
 */
function extractCoatingInfo(raw: any): {
  coatingText: string | null;
  coatingObj: {
    specification: string | null;
    color: string | null;
    target_part: string | null;
    note: string | null;
  };
  cleanedRemarks: string[];
} {
  let specText: string | null = null;
  let colorText: string | null = null;
  let targetPart: string | null = null;
  let noteText: string | null = null;

  // 1. Check raw.coating
  if (typeof raw.coating === 'string' && raw.coating.trim()) {
    specText = raw.coating.trim();
  } else if (raw.coating && typeof raw.coating === 'object') {
    specText = raw.coating.specification || raw.coating.spec || raw.coating.name || raw.coating.type || raw.coating.value || null;
    colorText = raw.coating.color || raw.coating.munsell || null;
    targetPart = raw.coating.target_part || raw.coating.part || null;
    noteText = raw.coating.note || raw.coating.remarks || null;
  }

  // 2. Check direct keys: 塗装, 塗装仕様, paint, painting, 外面塗装, 内面塗装
  const directPaint = raw['塗装仕様'] || raw['塗装'] || raw.paint || raw.painting || raw.coating_spec || raw['外面塗装'] || raw['内面塗装'];
  if (directPaint && !specText) {
    if (typeof directPaint === 'string') {
      specText = directPaint.trim();
    } else if (typeof directPaint === 'object') {
      specText = directPaint.specification || directPaint.value || JSON.stringify(directPaint);
    }
  }

  // 3. Check materials array for painting
  if (Array.isArray(raw.materials)) {
    const paintMat = raw.materials.find((m: any) => 
      m && (
        String(m.part || '').includes('塗装') || 
        String(m.part || '').includes('表面処理') || 
        String(m.value || '').includes('塗装') || 
        String(m.value || '').includes('エポキシ')
      )
    );
    if (paintMat && !specText) {
      specText = `${paintMat.part ? paintMat.part + ': ' : ''}${paintMat.value || ''}${paintMat.condition ? ` (${paintMat.condition})` : ''}`.trim();
    }
  }

  // 4. Check requirements array
  if (Array.isArray(raw.requirements)) {
    const paintReq = raw.requirements.find((r: any) => 
      r && (
        r.type === '塗装要求' || 
        String(r.text || '').includes('塗装') || 
        String(r.text || '').includes('防食') ||
        String(r.text || '').includes('塗色') ||
        String(r.text || '').includes('マンセル')
      )
    );
    if (paintReq && !specText) {
      specText = String(paintReq.text || '').replace(/^【.*?】/, '').trim();
    }
  }

  // 5. Check remarks array and separate painting lines from general remarks
  const rawRemarks: string[] = Array.isArray(raw.remarks) ? raw.remarks : (typeof raw.remarks === 'string' ? [raw.remarks] : []);
  const cleanedRemarks: string[] = [];

  rawRemarks.forEach(r => {
    const str = String(r || '').trim();
    if (!str) return;
    const isPaint = str.includes('塗装') || str.includes('防食') || str.includes('塗色') || str.includes('マンセル') || str.includes('エポキシ') || str.includes('ウレタン');
    if (isPaint) {
      if (!specText) {
        specText = str.replace(/^【(塗装|塗装仕様|防食)】/, '').replace(/^(塗装仕様|塗装|防食)[：:]\s*/, '').trim();
      }
    } else {
      cleanedRemarks.push(str);
    }
  });

  // Extract color if mentioned in specText (e.g. "エポキシ塗装 マンセル5Y7/1")
  if (specText && !colorText) {
    const munsellMatch = specText.match(/([0-9.]+[A-Z]+[0-9.]+\/[0-9.]+|N-[0-9.]+|マンセル\s*[:：]?\s*[\w./]+)/i);
    if (munsellMatch) {
      colorText = munsellMatch[0];
    }
  }

  // Assemble consolidated single string for 1 specification item
  let fullCoatingString: string | null = null;
  if (specText) {
    const parts = [
      specText,
      colorText && !specText.includes(colorText) ? `色: ${colorText}` : '',
      targetPart && !specText.includes(targetPart) ? `(${targetPart})` : '',
      noteText && !specText.includes(noteText) ? `[${noteText}]` : ''
    ].filter(Boolean);
    fullCoatingString = parts.join(' ');
  }

  return {
    coatingText: fullCoatingString,
    coatingObj: {
      specification: specText,
      color: colorText,
      target_part: targetPart || '外面',
      note: noteText
    },
    cleanedRemarks
  };
}

/**
 * Normalizes any uploaded/linked JSON data into SpecForge's database structure.
 * Supports:
 * 1. tokki-equipment schema (schema_version 1.0 & 1.1, document, equipment)
 * 2. standard SpecForge payload { items: [...], categories: [...], ... }
 * 3. raw array of items / legacy formats
 */
export function normalizeJsonToDatabase(
  rawJson: any,
  projectId: string,
  defaultCategoryId: string
): {
  items: EquipmentItem[];
  categories?: Category[];
  templates?: SpecTemplate[];
  projects?: ProjectWorkspace[];
  schemaType: 'tokki-equipment' | 'specforge-v2' | 'generic';
  rawDocument?: any;
} {
  if (!rawJson) {
    throw new Error('JSONデータが空です。');
  }

  // Case 1: Tokki Equipment intermediate schema (schema_version === "1.0" or "1.1" or presence of document & equipment)
  if (rawJson.equipment && Array.isArray(rawJson.equipment)) {
    const rawEqList = rawJson.equipment;
    const foundCategories: Record<string, Category> = {};

    // 1. If document or root defines project-specific categories, load them
    const rootCats = Array.isArray(rawJson.categories) 
      ? rawJson.categories 
      : (Array.isArray(rawJson.document?.categories) ? rawJson.document.categories : []);

    rootCats.forEach((catItem: any) => {
      const name = typeof catItem === 'string' ? catItem.trim() : String(catItem?.name || '').trim();
      if (name && !foundCategories[name]) {
        foundCategories[name] = {
          id: `cat-${projectId}-${name}`,
          projectId,
          name
        };
      }
    });

    // 2. Extract categories from equipment list
    rawEqList.forEach((eq: any) => {
      const catName = eq.category?.trim();
      if (catName && !foundCategories[catName]) {
        foundCategories[catName] = {
          id: `cat-${projectId}-${catName}`,
          projectId,
          name: catName
        };
      }
    });

    // Ensure at least one default category
    if (!foundCategories['未分類 / その他'] && !foundCategories['その他']) {
      foundCategories['その他'] = {
        id: `cat-${projectId}-etc`,
        projectId,
        name: '未分類 / その他'
      };
    }

    const parsedCategories = Object.values(foundCategories);
    const normalizedItems: EquipmentItem[] = rawEqList.map((eq: any, idx: number) => {
      return normalizeTokkiEquipmentItem(eq, projectId, defaultCategoryId, idx);
    });

    const doc = rawJson.document || {};
    const projectInfo: ProjectWorkspace | undefined = doc.project_name ? {
      id: projectId,
      name: doc.project_name,
      code: doc.document_id || `DOC-${Date.now()}`,
      clientName: '特記仕様書',
      description: `${doc.document_type || '特記仕様書'} (ステータス: ${doc.status || '編集中'})`,
      createdAt: (doc.updated_at ? doc.updated_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
      schemaType: 'tokki-equipment',
      rawDocument: doc
    } : undefined;

    return {
      items: normalizedItems,
      categories: parsedCategories.length > 0 ? parsedCategories : undefined,
      projects: projectInfo ? [projectInfo] : undefined,
      schemaType: 'tokki-equipment',
      rawDocument: doc
    };
  }

  // Case 2: Standard SpecForge payload { items: [...], categories: [...], ... }
  if (rawJson.items && Array.isArray(rawJson.items)) {
    const normalizedItems: EquipmentItem[] = rawJson.items.map((it: any, idx: number) => {
      return normalizeSingleItem(it, projectId, defaultCategoryId, idx);
    });

    const projectCats = Array.isArray(rawJson.categories) 
      ? rawJson.categories.map((c: any) => ({ 
          id: c.id ? (c.id.includes(projectId) ? c.id : `cat-${projectId}-${c.id}`) : `cat-${projectId}-${c.name}`,
          name: typeof c === 'string' ? c : c.name,
          color: c.color || 'blue',
          projectId 
        })) 
      : undefined;

    return {
      items: normalizedItems,
      categories: projectCats,
      templates: Array.isArray(rawJson.templates) ? rawJson.templates : undefined,
      projects: Array.isArray(rawJson.projects) ? rawJson.projects : undefined,
      schemaType: 'specforge-v2'
    };
  }

  // Case 3: Array of equipment items at top level or nested in generic key
  let rawList: any[] = [];
  if (Array.isArray(rawJson)) {
    rawList = rawJson;
  } else if (Array.isArray(rawJson.equipmentList)) {
    rawList = rawJson.equipmentList;
  } else if (Array.isArray(rawJson.records)) {
    rawList = rawJson.records;
  } else if (Array.isArray(rawJson.data)) {
    rawList = rawJson.data;
  } else if (typeof rawJson === 'object') {
    const arrayKey = Object.keys(rawJson).find(k => Array.isArray(rawJson[k]));
    if (arrayKey) {
      rawList = rawJson[arrayKey];
    }
  }

  if (rawList.length === 0) {
    if (rawJson.name || rawJson['機器名']) {
      rawList = [rawJson];
    } else {
      throw new Error('有効な機器データ配列（equipment, items 等）を検出できませんでした。');
    }
  }

  const items: EquipmentItem[] = rawList.map((it: any, idx: number) => {
    return normalizeSingleItem(it, projectId, defaultCategoryId, idx);
  });

  return { items, schemaType: 'generic' };
}

/**
 * Normalizes an item from the Tokki Equipment schema format
 * Automatically recognizes coating specifications and project-specific categories
 */
function normalizeTokkiEquipmentItem(
  eq: any,
  projectId: string,
  defaultCategoryId: string,
  index: number
): EquipmentItem {
  const now = new Date().toISOString().slice(0, 10);
  const tagNo = eq.id || eq.tagNo || formatTagNo('03', index + 1);
  const parsedCls = parseTagNo(tagNo);
  const itemClassification = parsedCls.classification;
  const name = eq.name || `機器-${index + 1}`;
  
  // Quantity
  let quantity = 1;
  let unit = '台';
  if (typeof eq.quantity === 'object' && eq.quantity !== null) {
    quantity = Number(eq.quantity.value ?? 1) || 1;
    unit = eq.quantity.unit || '台';
  } else if (typeof eq.quantity === 'number') {
    quantity = eq.quantity;
  }

  // Specifications
  let specs: EquipmentSpecParam[] = [];
  if (Array.isArray(eq.specifications)) {
    specs = eq.specifications.map((s: any, sIdx: number) => ({
      id: `sp-${index}-${sIdx}`,
      name: s.item || s.name || '仕様項目',
      value: String(s.value ?? ''),
      unit: s.unit || ''
    }));
  }

  // Coating Extraction: Promoted to 1 discrete specification item in specs
  const { coatingText, coatingObj, cleanedRemarks } = extractCoatingInfo(eq);
  if (coatingText && !specs.some(s => s.name.includes('塗装') || s.name.includes('防食'))) {
    specs.push({
      id: `sp-${index}-coating`,
      name: '塗装仕様',
      value: coatingText,
      unit: ''
    });
  }

  // Materials
  let materialStr = '';
  if (Array.isArray(eq.materials)) {
    materialStr = eq.materials
      .map((m: any) => `${m.part}: ${m.value || ''}${m.condition ? ` (${m.condition})` : ''}`)
      .join(', ');
  }

  const action = eq.action || 'その他';
  const purpose = eq.purpose || null;

  // Parse structured history if present
  let history: ChangeLog[] | undefined = undefined;
  if (Array.isArray(eq.history) && eq.history.length > 0) {
    history = eq.history;
  }

  // Project-scoped category ID
  const categoryId = eq.category ? `cat-${projectId}-${eq.category.trim()}` : defaultCategoryId;

  // Notes (特記事項) - Cleaned of painting so painting does not duplicate here!
  const noteParts = [
    purpose ? `【用途】${purpose}` : '',
    action ? `【区分】${action}` : '',
    ...cleanedRemarks
  ].filter(Boolean);

  return {
    id: tagNo,
    projectId,
    tagNo,
    classification: itemClassification,
    name,
    quantity,
    unit,
    deliveryDate: now,
    categoryId,
    notes: noteParts.join(' / '),
    specs: specs.length > 0 ? specs : undefined,
    coating: coatingObj || (specs.some(s => s.name.includes('塗装')) ? {
      specification: specs.find(s => s.name.includes('塗装'))?.value || null,
      color: null,
      target_part: '外面',
      note: null
    } : undefined),
    material: materialStr || undefined,
    materials: eq.materials,
    accessories: eq.accessories,
    requirements: eq.requirements,
    remarks: cleanedRemarks,
    action,
    purpose,
    source: eq.source,
    edit: eq.edit,
    unclassified: eq.unclassified,
    rawTokki: eq,
    history,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeSingleItem(
  raw: any,
  projectId: string,
  defaultCategoryId: string,
  index: number
): EquipmentItem {
  const now = new Date().toISOString().slice(0, 10);
  const name = raw.name || raw['機器名'] || raw.equipmentName || raw.title || `機器-${index + 1}`;
  const tagNo = raw.tagNo || raw['機器番号'] || raw['タグ番号'] || raw.tag || raw.id || formatTagNo('03', index + 1);
  const parsedGenericCls = parseTagNo(tagNo);
  
  let quantity = 1;
  let unit = '台';
  if (typeof raw.quantity === 'object' && raw.quantity !== null) {
    quantity = Number(raw.quantity.value ?? 1) || 1;
    unit = raw.quantity.unit || '台';
  } else {
    quantity = Number(raw.quantity ?? raw['数量'] ?? raw.qty ?? 1) || 1;
    unit = raw.unit || raw['単位'] || '台';
  }

  const deliveryDate = raw.deliveryDate || raw['納入時期'] || raw['希望納期'] || raw['納期'] || now;
  const categoryId = raw.categoryId || defaultCategoryId;
  const deliveryLocation = raw.deliveryLocation || raw['納入場所'] || '';

  // Parse specifications
  let specs: EquipmentSpecParam[] = [];
  if (Array.isArray(raw.specifications)) {
    specs = raw.specifications.map((s: any, sIdx: number) => ({
      id: `sp-${index}-${sIdx}`,
      name: s.item || s.name || '仕様項目',
      value: String(s.value ?? ''),
      unit: s.unit || ''
    }));
  } else if (Array.isArray(raw.specs)) {
    specs = raw.specs.map((s: any, sIdx: number) => ({
      id: s.id || `sp-${index}-${sIdx}`,
      name: s.name || s['項目名'] || s.label || '仕様項目',
      value: String(s.value ?? s['数値'] ?? s.val ?? ''),
      unit: s.unit || s['単位'] || ''
    }));
  } else if (raw.specs && typeof raw.specs === 'object') {
    specs = Object.entries(raw.specs).map(([k, v], sIdx) => ({
      id: `sp-${index}-${sIdx}`,
      name: k,
      value: String(v),
      unit: ''
    }));
  }

  // Coating Extraction: Promoted to 1 discrete specification item
  const { coatingText, coatingObj, cleanedRemarks } = extractCoatingInfo(raw);
  if (coatingText && !specs.some(s => s.name.includes('塗装') || s.name.includes('防食'))) {
    specs.push({
      id: `sp-${index}-coating`,
      name: '塗装仕様',
      value: coatingText,
      unit: ''
    });
  }

  const rawDia = raw.diameter || raw['口径'] || raw.size || '';
  const rawMat = raw.material || raw['材質'] || '';

  if (specs.length === 0) {
    if (rawDia && rawDia !== '-') {
      specs.push({ id: `sp-${index}-dia`, name: '口径', value: String(rawDia), unit: '' });
    }
    if (rawMat && rawMat !== '-') {
      specs.push({ id: `sp-${index}-mat`, name: '材質', value: String(rawMat), unit: '' });
    }
  }

  // Clean painting out of notes so it does not duplicate
  let notes = raw.notes || raw['特記事項'] || raw['備考'] || cleanedRemarks.join(' / ') || '';
  if (notes && coatingText) {
    notes = notes
      .split(/[\n/]/)
      .filter((line: string) => !line.includes('塗装') && !line.includes('防食') && !line.includes('マンセル'))
      .join(' / ')
      .trim();
  }

  // Parse materials array (materials情報)
  let parsedMaterials: Array<{ part: string; value: string | null; condition: string | null; note: string | null }> | undefined = undefined;
  const rawMaterials = raw.materials || raw['材質構成'] || raw['材料'] || raw['材質内訳'];
  if (Array.isArray(rawMaterials) && rawMaterials.length > 0) {
    parsedMaterials = rawMaterials.map((m: any) => {
      if (typeof m === 'string') {
        const parts = m.split(/[:：]/);
        return {
          part: parts[0]?.trim() || '本体',
          value: parts[1]?.trim() || parts[0]?.trim(),
          condition: null,
          note: null
        };
      }
      return {
        part: String(m.part || m.name || m['部位'] || m['部品'] || '本体'),
        value: m.value !== undefined ? (m.value !== null ? String(m.value) : null) : (m['材質'] || m.material || null),
        condition: m.condition || m['条件'] || m['仕様'] || null,
        note: m.note || m.remarks || m['備考'] || null
      };
    });
  } else if (rawMaterials && typeof rawMaterials === 'object') {
    parsedMaterials = Object.entries(rawMaterials).map(([part, val]) => ({
      part,
      value: String(val ?? ''),
      condition: null,
      note: null
    }));
  } else if (rawMat && rawMat !== '-') {
    parsedMaterials = [{
      part: '本体',
      value: String(rawMat),
      condition: null,
      note: null
    }];
  }

  // Parse accessories array (accessories情報)
  let parsedAccessories: Array<{ name: string; quantity: number | null; unit: string | null; note: string | null }> | undefined = undefined;
  const rawAccessories = raw.accessories || raw['付属品'] || raw['予備品'] || raw['付属品一覧'];
  if (Array.isArray(rawAccessories) && rawAccessories.length > 0) {
    parsedAccessories = rawAccessories.map((a: any) => {
      if (typeof a === 'string') {
        return {
          name: a.trim(),
          quantity: 1,
          unit: '式',
          note: null
        };
      }
      return {
        name: String(a.name || a.title || a['品名'] || a['名称'] || '付属品'),
        quantity: typeof a.quantity === 'number' ? a.quantity : (a.quantity ? Number(a.quantity) || null : null),
        unit: a.unit || a['単位'] || null,
        note: a.note || a.remarks || a['備考'] || null
      };
    });
  }

  return {
    id: raw.id || String(tagNo),
    projectId,
    tagNo: String(tagNo),
    classification: raw.classification || parsedGenericCls.classification,
    equipmentType: raw.equipmentType || raw['機器種別'] || undefined,
    name: String(name),
    quantity,
    unit: String(unit),
    deliveryDate: String(deliveryDate),
    isIssued: Boolean(raw.isIssued || raw['発行']),
    categoryId,
    deliveryLocation: deliveryLocation ? String(deliveryLocation) : undefined,
    notes: notes || undefined,
    specs: specs.length > 0 ? specs : undefined,
    coating: coatingObj,
    diameter: rawDia ? String(rawDia) : undefined,
    material: rawMat ? String(rawMat) : undefined,
    materials: parsedMaterials,
    accessories: parsedAccessories,
    action: raw.action || undefined,
    purpose: raw.purpose || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    history: Array.isArray(raw.history) ? raw.history : undefined
  };
}

/**
 * Reads database JSON from a linked FileSystemFileHandle with full error capture.
 */
export async function readFromProjectHandle(
  handle: FileSystemFileHandle,
  projectId: string,
  defaultCategoryId: string
): Promise<{
  payload: DatabasePayload;
  fileName: string;
}> {
  try {
    const perm = await (handle as any).queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      const req = await (handle as any).requestPermission({ mode: 'read' });
      if (req !== 'granted') {
        throw new Error('JSONファイルへの読み取り権限が拒否されました。再度ファイルを選択してください。');
      }
    }

    const file = await handle.getFile();
    const text = await file.text();
    if (!text.trim()) {
      return {
        payload: {
          version: '1.1',
          lastUpdated: new Date().toISOString(),
          items: [],
          schemaType: 'specforge-v2'
        },
        fileName: file.name
      };
    }

    const raw = JSON.parse(text);
    const normalized = normalizeJsonToDatabase(raw, projectId, defaultCategoryId);

    const payload: DatabasePayload = {
      version: raw.schema_version || raw.version || '1.1',
      lastUpdated: raw.document?.updated_at || raw.lastUpdated || new Date().toISOString(),
      projects: normalized.projects,
      categories: normalized.categories,
      templates: normalized.templates,
      items: normalized.items,
      schemaType: normalized.schemaType,
      rawDocument: normalized.rawDocument
    };

    return {
      payload,
      fileName: file.name
    };
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found') || err.message?.includes('A requested file or directory could not be found')) {
      throw new Error('紐づけ元のJSONファイルが見つかりません。ファイルが移動または削除された可能性があります。');
    }
    if (err.name === 'NotAllowedError' || err.message?.includes('permission')) {
      throw new Error('ファイルへのアクセス権限がありません。再度ファイルを選択してください。');
    }
    throw err;
  }
}

/**
 * Writes updated database JSON back to the linked FileSystemFileHandle.
 * Automatically formats output according to the detected schema:
 * - If tokki-equipment schema: preserves schema_version 1.1, document, and equipment fields
 * - Accurately serializes categories both in document.categories, root categories, and per-equipment category
 * - Accurately serializes coating (塗装) specifications
 * - Records change history in both structured history array and schema-safe remarks
 */
export async function writeToProjectHandle(
  handle: FileSystemFileHandle,
  payload: DatabasePayload,
  schemaType?: 'tokki-equipment' | 'specforge-v2' | 'generic',
  project?: ProjectWorkspace
): Promise<void> {
  try {
    const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const req = await (handle as any).requestPermission({ mode: 'readwrite' });
      if (req !== 'granted') {
        throw new Error('JSONファイルへの書き込み権限が許可されませんでした。');
      }
    }

    const isTokki = schemaType === 'tokki-equipment' || 
                    payload.schemaType === 'tokki-equipment' || 
                    project?.schemaType === 'tokki-equipment';

    let fileContent: any;

    if (isTokki) {
      // Build strictly formatted Tokki Equipment schema JSON (v1.1)
      const equipmentList = payload.items.map((item, idx) => {
        const catName = payload.categories?.find(c => c.id === item.categoryId)?.name || item.rawTokki?.category || null;

        // Specifications array mapping:
        // Guarantees item name is non-empty (satisfies minLength: 1 requirement)
        const specifications = (item.specs || []).map(s => ({
          item: s.name.trim() || '仕様項目',
          value: s.value,
          unit: s.unit?.trim() || null,
          note: null
        }));

        // Coating (塗装) mapping
        const coatingSpec = (item.specs || []).find(s => s.name.includes('塗装') || s.name.includes('防食'));
        let coatingObj = item.coating;
        if (!coatingObj && coatingSpec) {
          coatingObj = {
            specification: coatingSpec.value || null,
            color: null,
            target_part: '外面',
            note: null
          };
        }
        if (!coatingObj) {
          coatingObj = {
            specification: null,
            color: null,
            target_part: null,
            note: null
          };
        }

        // Materials array mapping
        let materials = item.materials;
        if (!materials || materials.length === 0) {
          if (item.material) {
            materials = [{
              part: '本体',
              value: item.material,
              condition: null,
              note: null
            }];
          } else {
            materials = [];
          }
        }

        // Validate id pattern: ^[0-9]{2}-[0-9]{3,}$ (e.g. 03-001, 04-001, 08-001)
        let eqId = item.tagNo || item.id;
        if (!eqId || !/^[0-9]{2}-[0-9]{3,}$/.test(eqId)) {
          const cls = item.classification || parseTagNo(item.tagNo).classification || '03';
          eqId = formatTagNo(cls, idx + 1);
        }

        // Quantity object
        const quantityObj = {
          value: item.quantity,
          unit: item.unit || '台',
          note: null,
          original_text: `${item.quantity}${item.unit || '台'}`
        };

        // Schema-safe change history in remarks (for backward compatibility)
        const remarksList = [...(item.remarks || [])];
        if (item.history && item.history.length > 0) {
          const latestLogs = item.history.slice(0, 3);
          latestLogs.forEach(h => {
            const entry = `[履歴: ${h.timestamp} ${h.fieldLabel}「${h.oldValue}」→「${h.newValue}」${h.reason ? ` (${h.reason})` : ''}]`;
            if (!remarksList.includes(entry)) {
              remarksList.unshift(entry);
            }
          });
        }

        const eqObj: any = {
          id: eqId,
          name: item.name,
          category: catName,
          action: item.action || 'その他',
          purpose: item.purpose || null,
          quantity: quantityObj,
          specifications,
          coating: coatingObj,
          materials,
          accessories: item.accessories || [],
          requirements: item.requirements || [],
          remarks: remarksList,
          history: item.history || [],
          source: item.source || {
            page_start: null,
            page_end: null,
            section: null,
            original_text: null
          },
          edit: {
            status: item.edit?.status || (item.history && item.history.length > 0 ? '要確認' : '未確認'),
            modified: (item.history && item.history.length > 0) || !!item.edit?.modified,
            modified_at: new Date().toISOString()
          },
          unclassified: item.unclassified || []
        };

        return eqObj;
      });

      const doc = project?.rawDocument || payload.rawDocument || {};
      const categoryNames = payload.categories?.map(c => c.name) || [];

      fileContent = {
        schema_version: '1.1',
        document: {
          document_id: doc.document_id || project?.code || `DOC-${new Date().getFullYear()}`,
          file_name: doc.file_name || project?.linkedJsonFileName || 'tokki_equipment.json',
          project_name: doc.project_name || project?.name || '特記仕様書機器データ',
          document_type: doc.document_type || '特記仕様書',
          status: doc.status || '編集中',
          categories: categoryNames,
          updated_at: new Date().toISOString()
        },
        categories: categoryNames,
        equipment: equipmentList
      };
    } else {
      fileContent = {
        version: payload.version || '2.0',
        lastUpdated: new Date().toISOString(),
        projects: payload.projects,
        categories: payload.categories,
        templates: payload.templates,
        items: payload.items
      };
    }

    const writable = await (handle as any).createWritable();
    await writable.write(JSON.stringify(fileContent, null, 2));
    await writable.close();
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
      throw new Error('書き込み先のJSONファイルが見つかりません。ファイルが移動または削除された可能性があります。');
    }
    throw err;
  }
}
