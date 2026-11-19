import { SpecFieldMapping, SpecTemplate } from '../types';

export interface BasicFieldDefinition {
  id: string;
  label: string;
  defaultCell: string;
  type: 'text' | 'date';
  description: string;
  matchLabels: string[];
  matchIds: string[];
}

export const BASIC_FIELD_DEFS: BasicFieldDefinition[] = [
  {
    id: 'f-order-no',
    label: 'オーダーNo.',
    defaultCell: 'C3',
    type: 'text',
    description: '案件サマリー（オーダーNo.）から自動反映',
    matchLabels: ['オーダーno.', 'オーダーno', 'オーダー', '注文番号'],
    matchIds: ['f-order-no', 'f-basic-order']
  },
  {
    id: 'f-project-name',
    label: '案件名',
    defaultCell: 'C5',
    type: 'text',
    description: '案件サマリー（案件名）から自動反映',
    matchLabels: ['案件名', '工事名称 / 件名', '施設名称 / 件名', '工事・件名', '工事名称', '件名'],
    matchIds: ['f-project-name', 'f-basic-title']
  },
  {
    id: 'f-client-name',
    label: '客先名',
    defaultCell: 'G6',
    type: 'text',
    description: '案件サマリー（客先名）から自動反映',
    matchLabels: ['客先名', '発注者', '発注元', '顧客名'],
    matchIds: ['f-client-name', 'f-basic-client']
  },
  {
    id: 'f-docno',
    label: '仕様書番号',
    defaultCell: 'C4',
    type: 'text',
    description: '客先コード・機器番号から自動生成',
    matchLabels: ['仕様書番号', '文書番号'],
    matchIds: ['f-docno', 'f-basic-docno']
  },
  {
    id: 'f-date',
    label: '発行日',
    defaultCell: 'G4',
    type: 'date',
    description: '仕様書発行日',
    matchLabels: ['発行日', '仕様書発行日'],
    matchIds: ['f-date', 'f-basic-date']
  }
];

export interface DetailFieldDefinition {
  id: string;
  label: string;
  defaultCol: string;
  description: string;
}

export const DETAIL_FIELD_DEFS: DetailFieldDefinition[] = [
  {
    id: 'f-detail-name',
    label: '機器名',
    defaultCol: 'C',
    description: '機器名称 (例: ボール弁ユニット, 渦巻ポンプ)'
  },
  {
    id: 'f-detail-qty',
    label: '数量',
    defaultCol: 'F',
    description: '発注数量・単位 (例: 4 台)'
  },
  {
    id: 'f-detail-delivery',
    label: '納期',
    defaultCol: 'G',
    description: '納入指定時期 (例: 2026-09-15)'
  },
  {
    id: 'f-detail-notes',
    label: '特記事項',
    defaultCol: 'H',
    description: '機器ごとの特記事項・備考'
  }
];

const DETAIL_LABEL_SET = new Set(DETAIL_FIELD_DEFS.map(d => d.label));

export interface RevisionFieldDefinition {
  id: string;
  revision: 1 | 2 | 3;
  key: 'no' | 'date' | 'author' | 'content';
  label: string;
  shortLabel: string;
  builtinCell: string;
  type: 'text' | 'date';
  description: string;
}

export const REVISION_FIELD_DEFS: RevisionFieldDefinition[] = [
  // Rev 1
  { id: 'f-rev1-no', revision: 1, key: 'no', label: 'Rev1 リビジョン番号', shortLabel: 'リビジョン番号', builtinCell: 'B31', type: 'text', description: 'Rev.1の版番号（例: Rev1）' },
  { id: 'f-rev1-date', revision: 1, key: 'date', label: 'Rev1 改訂日', shortLabel: '改訂日', builtinCell: 'C31', type: 'date', description: 'Rev.1の改訂年月日' },
  { id: 'f-rev1-author', revision: 1, key: 'author', label: 'Rev1 改訂者', shortLabel: '改訂者', builtinCell: 'D31', type: 'text', description: 'Rev.1の改訂担当者' },
  { id: 'f-rev1-content', revision: 1, key: 'content', label: 'Rev1 変更内容', shortLabel: '変更内容', builtinCell: 'E31', type: 'text', description: 'Rev.1の変更内容概要' },
  // Rev 2
  { id: 'f-rev2-no', revision: 2, key: 'no', label: 'Rev2 リビジョン番号', shortLabel: 'リビジョン番号', builtinCell: 'B32', type: 'text', description: 'Rev.2の版番号（例: Rev2）' },
  { id: 'f-rev2-date', revision: 2, key: 'date', label: 'Rev2 改訂日', shortLabel: '改訂日', builtinCell: 'C32', type: 'date', description: 'Rev.2の改訂年月日' },
  { id: 'f-rev2-author', revision: 2, key: 'author', label: 'Rev2 改訂者', shortLabel: '改訂者', builtinCell: 'D32', type: 'text', description: 'Rev.2の改訂担当者' },
  { id: 'f-rev2-content', revision: 2, key: 'content', label: 'Rev2 変更内容', shortLabel: '変更内容', builtinCell: 'E32', type: 'text', description: 'Rev.2の変更内容概要' },
  // Rev 3
  { id: 'f-rev3-no', revision: 3, key: 'no', label: 'Rev3 リビジョン番号', shortLabel: 'リビジョン番号', builtinCell: 'B33', type: 'text', description: 'Rev.3の版番号（例: Rev3）' },
  { id: 'f-rev3-date', revision: 3, key: 'date', label: 'Rev3 改訂日', shortLabel: '改訂日', builtinCell: 'C33', type: 'date', description: 'Rev.3の改訂年月日' },
  { id: 'f-rev3-author', revision: 3, key: 'author', label: 'Rev3 改訂者', shortLabel: '改訂者', builtinCell: 'D33', type: 'text', description: 'Rev.3の改訂担当者' },
  { id: 'f-rev3-content', revision: 3, key: 'content', label: 'Rev3 変更内容', shortLabel: '変更内容', builtinCell: 'E33', type: 'text', description: 'Rev.3の変更内容概要' },
];

const REVISION_ID_SET = new Set(REVISION_FIELD_DEFS.map(r => r.id));

function isLegacy4SlotSeq(f: SpecFieldMapping | undefined, col: string): number | null {
  if (!f) return null;
  const c1 = (f.cell || '').trim().toUpperCase();
  const c2 = (f.cellSlot2 || '').trim().toUpperCase();
  const c3 = (f.cellSlot3 || '').trim().toUpperCase();
  const c4 = (f.cellSlot4 || '').trim().toUpperCase();
  const m = c1.match(new RegExp(`^${col}(\\d+)$`));
  if (!m) return null;
  const r = Number(m[1]);
  if (c2 === `${col}${r + 1}` && c3 === `${col}${r + 2}` && c4 === `${col}${r + 3}`) {
    return r;
  }
  return null;
}

/**
 * Cleans stale legacy auto-generated coordinates (e.g. C12..H15 from old parseExcelTemplateFile
 * or C3/C5/G6/C4/G4 from old normalizeSpecTemplate) that were previously persisted into
 * IndexedDB folder caches, localStorage, or early .specmap.json files for external Excel sheets.
 */
export function stripLegacyAutoGeneratedCells(tpl: SpecTemplate): SpecTemplate {
  const isExternalExcel =
    tpl.sourceType !== 'preset' ||
    tpl.sourceLocation === 'folder' ||
    Boolean(tpl.rawWorkbookBase64) ||
    Boolean(tpl.masterWorkbookBase64);

  if (!isExternalExcel || !Array.isArray(tpl.fields) || tpl.fields.length === 0) {
    return tpl;
  }

  let fields = tpl.fields;
  let modified = false;

  // 1. Detect legacy 4-row auto-generated detail coordinates (C{r}..C{r+3}, F{r}..F{r+3}, G{r}..G{r+3}, H{r}..H{r+3})
  const detailColMap: Array<{ id: string; col: string }> = [
    { id: 'f-detail-name', col: 'C' },
    { id: 'f-detail-qty', col: 'F' },
    { id: 'f-detail-delivery', col: 'G' },
    { id: 'f-detail-notes', col: 'H' },
  ];

  const rowCounts = new Map<number, string[]>();
  for (const entry of detailColMap) {
    const f = fields.find(x => x.group === 'detail' && x.id === entry.id);
    const startR = isLegacy4SlotSeq(f, entry.col);
    if (startR !== null) {
      const list = rowCounts.get(startR) || [];
      list.push(entry.id);
      rowCounts.set(startR, list);
    }
  }

  const legacyDetailIdsToClear = new Set<string>();
  for (const [, ids] of rowCounts.entries()) {
    // If at least 2 detail fields share the exact untouched 4-consecutive-row C/F/G/H pattern,
    // they came from the old auto-generator and must be cleared.
    if (ids.length >= 2) {
      ids.forEach(id => legacyDetailIdsToClear.add(id));
    }
  }

  if (legacyDetailIdsToClear.size > 0) {
    fields = fields.map(f =>
      legacyDetailIdsToClear.has(f.id)
        ? { ...f, cell: '', cellSlot2: '', cellSlot3: '', cellSlot4: '' }
        : f
    );
    modified = true;
  }

  // 2. For unpaired folder Excel files, clear the exact old auto-generated basic defaults (C3, C5, G6, C4, G4)
  if (tpl.sourceLocation === 'folder' && !tpl.hasPairedMappingFile) {
    const allBasicMatchOldDefaults = BASIC_FIELD_DEFS.every(def => {
      const f = fields.find(x => x.group === 'basic' && x.id === def.id);
      return f && (f.cell || '').trim().toUpperCase() === def.defaultCell;
    });
    if (allBasicMatchOldDefaults) {
      const basicIds = new Set(BASIC_FIELD_DEFS.map(d => d.id));
      fields = fields.map(f => (basicIds.has(f.id) ? { ...f, cell: '' } : f));
      modified = true;
    }
  }

  return modified ? { ...tpl, fields } : tpl;
}

/**
 * Ensures any template (preset, saved in localStorage, or imported from legacy JSON):
 * 1. Has strictly the 5 fixed `group: 'basic'` fields (オーダーNo., 案件名, 客先名, 仕様書番号, 発行日),
 *    preserving any explicitly mapped cell addresses and leaving unmapped ones blank ('').
 * 2. Has the 12 revision history fields (`group: 'revision'`) for Rev.1〜Rev.3 (4 columns each),
 *    leaving unmapped ones blank ('').
 * 3. Has the 4 individual detail cell mappings (機器名, 数量, 納期, 特記事項) as `group: 'detail'` fields,
 *    leaving unmapped ones blank ('') and removing legacy tableMapping/cellMappings.
 */
export function normalizeSpecTemplate(tpl: SpecTemplate): SpecTemplate {
  const sanitized = stripLegacyAutoGeneratedCells(tpl);
  const existingFields: SpecFieldMapping[] = Array.isArray(sanitized.fields) ? [...sanitized.fields] : [];

  const basicFields: SpecFieldMapping[] = BASIC_FIELD_DEFS.map(def => {
    const existing = existingFields.find(f => {
      if (def.matchIds.includes(f.id)) return true;
      if (f.group === 'basic') {
        const lbl = (f.label || '').trim().toLowerCase();
        return def.matchLabels.some(m => lbl === m || lbl.includes(m));
      }
      return false;
    });

    return {
      id: def.id,
      label: def.label,
      cell: existing?.cell !== undefined ? existing.cell : '',
      type: def.type,
      group: 'basic',
      defaultValue: existing?.defaultValue ?? (def.type === 'date' ? new Date().toISOString().slice(0, 10) : ''),
      description: def.description
    };
  });

  const revisionFields: SpecFieldMapping[] = REVISION_FIELD_DEFS.map(def => {
    const existing = existingFields.find(f => f.id === def.id);
    return {
      id: def.id,
      label: def.label,
      cell: existing?.cell !== undefined ? existing.cell : '',
      type: def.type,
      group: 'revision',
      defaultValue: existing?.defaultValue ?? (def.key === 'no' ? `Rev${def.revision}` : ''),
      description: def.description
    };
  });

  const detailFields: SpecFieldMapping[] = DETAIL_FIELD_DEFS.map(def => {
    const existing = existingFields.find(
      f => f.group === 'detail' && (f.id === def.id || f.label === def.label)
    );
    if (existing) {
      return {
        ...existing,
        id: existing.id || def.id,
        label: def.label,
        cell: existing.cell ?? '',
        cellSlot2: existing.cellSlot2 ?? '',
        cellSlot3: existing.cellSlot3 ?? '',
        cellSlot4: existing.cellSlot4 ?? '',
        type: 'text',
        group: 'detail',
        description: existing.description || def.description
      };
    }

    return {
      id: def.id,
      label: def.label,
      cell: '',
      cellSlot2: '',
      cellSlot3: '',
      cellSlot4: '',
      type: 'text',
      group: 'detail',
      defaultValue: '',
      description: def.description
    };
  });

  // Keep all non-basic, non-revision, non-detail fields (check, spec, notes)
  const otherFields = existingFields.filter(f => {
    if (f.group === 'basic' || f.group === 'detail' || f.group === 'revision') return false;
    if (BASIC_FIELD_DEFS.some(b => b.matchIds.includes(f.id))) return false;
    if (REVISION_ID_SET.has(f.id)) return false;
    if (DETAIL_FIELD_DEFS.some(d => d.id === f.id)) return false;
    if (f.group === undefined && DETAIL_LABEL_SET.has(f.label) && f.id.startsWith('f-detail-')) return false;
    return true;
  });

  const { tableMapping: _removedTableMapping, cellMappings: _removedCellMappings, ...rest } = sanitized;

  return {
    ...rest,
    fields: [...basicFields, ...revisionFields, ...detailFields, ...otherFields]
  };
}


