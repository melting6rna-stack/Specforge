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
    description: 'オーダーNo.・機器番号から自動生成',
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

/**
 * Ensures any template (preset, saved in localStorage, or imported from legacy JSON):
 * 1. Has strictly the 5 fixed `group: 'basic'` fields (オーダーNo., 案件名, 客先名, 仕様書番号, 発行日),
 *    preserving any previously mapped cell addresses.
 * 2. Has the 4 individual detail cell mappings (機器名, 数量, 納期, 特記事項) as `group: 'detail'` fields,
 *    migrating from legacy `tableMapping` if needed, and removes legacy column-based tableMapping.
 */
export function normalizeSpecTemplate(tpl: SpecTemplate): SpecTemplate {
  const existingFields: SpecFieldMapping[] = Array.isArray(tpl.fields) ? [...tpl.fields] : [];
  const startRow = tpl.tableMapping?.startRow || 15;

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
      cell: existing?.cell !== undefined ? existing.cell : def.defaultCell,
      type: def.type,
      group: 'basic',
      defaultValue: existing?.defaultValue ?? (def.type === 'date' ? new Date().toISOString().slice(0, 10) : ''),
      description: def.description
    };
  });

  const getLegacyColForDetailId = (def: DetailFieldDefinition): string => {
    const tm = tpl.tableMapping;
    if (!tm) return def.defaultCol;
    if (def.id === 'f-detail-name') return tm.nameCol || def.defaultCol;
    if (def.id === 'f-detail-qty') return tm.quantityCol || def.defaultCol;
    if (def.id === 'f-detail-delivery') return tm.deliveryDateCol || def.defaultCol;
    if (def.id === 'f-detail-notes') return tm.notesCol || def.defaultCol;
    return def.defaultCol;
  };

  const detailFields: SpecFieldMapping[] = DETAIL_FIELD_DEFS.map(def => {
    const existing = existingFields.find(
      f => f.group === 'detail' && (f.id === def.id || f.label === def.label)
    );
    if (existing) {
      return {
        ...existing,
        id: existing.id || def.id,
        label: def.label,
        type: 'text',
        group: 'detail',
        description: existing.description || def.description
      };
    }

    const col = getLegacyColForDetailId(def).toUpperCase();
    return {
      id: def.id,
      label: def.label,
      cell: `${col}${startRow}`,
      cellSlot2: `${col}${startRow + 1}`,
      cellSlot3: `${col}${startRow + 2}`,
      cellSlot4: `${col}${startRow + 3}`,
      type: 'text',
      group: 'detail',
      defaultValue: '',
      description: def.description
    };
  });

  // Keep all non-basic, non-detail fields (check, spec, notes)
  const otherFields = existingFields.filter(f => {
    if (f.group === 'basic' || f.group === 'detail') return false;
    if (BASIC_FIELD_DEFS.some(b => b.matchIds.includes(f.id))) return false;
    if (DETAIL_FIELD_DEFS.some(d => d.id === f.id)) return false;
    if (f.group === undefined && DETAIL_LABEL_SET.has(f.label) && f.id.startsWith('f-detail-')) return false;
    return true;
  });

  const { tableMapping: _removedTableMapping, ...rest } = tpl;

  return {
    ...rest,
    fields: [...basicFields, ...detailFields, ...otherFields]
  };
}

