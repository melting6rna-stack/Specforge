import { EquipmentItem, SpecFieldMapping, SpecTemplate } from '../types';
import { normalizeSpecTemplate } from './templateUtils';

export type DragDropMode = 'mapping' | 'override';

export type SlotKey = 'cell' | 'cellSlot2' | 'cellSlot3' | 'cellSlot4';

export interface DraggableSpecChip {
  chipKey: string;
  slotIndex: 0 | 1 | 2 | 3;
  itemId: string;
  itemTagNo: string;
  itemName: string;
  label: string;
  value: string;
  kind: 'detail' | 'spec';
  detailFieldId?: string;
  mappedCell?: string;
  overriddenCells: string[];
}

export const SLOT_KEYS: SlotKey[] = ['cell', 'cellSlot2', 'cellSlot3', 'cellSlot4'];

export function getSlotKeyForIndex(slotIndex: number): SlotKey {
  if (slotIndex === 1) return 'cellSlot2';
  if (slotIndex === 2) return 'cellSlot3';
  if (slotIndex === 3) return 'cellSlot4';
  return 'cell';
}

export function getFormKeyForFieldSlot(fieldId: string, slotIndex: number): string {
  if (slotIndex === 0) return fieldId;
  return `${fieldId}__slot${slotIndex + 1}`;
}

function normalizeLabel(label: string): string {
  return (label || '').trim().toLowerCase();
}

function getFieldCellForSlot(field: SpecFieldMapping, slotIndex: number): string {
  const key = getSlotKeyForIndex(slotIndex);
  return (field[key] || '').trim().toUpperCase();
}

function findMatchingFieldForChip(
  fields: SpecFieldMapping[],
  chip: Pick<DraggableSpecChip, 'kind' | 'detailFieldId' | 'label'>
): SpecFieldMapping | undefined {
  if (chip.kind === 'detail' && chip.detailFieldId) {
    return fields.find(
      (f) => f.group === 'detail' && (f.id === chip.detailFieldId || f.label === chip.label)
    );
  }

  const targetNorm = normalizeLabel(chip.label);
  if (!targetNorm) return undefined;

  // Prefer exact label match among spec fields
  const exact = fields.find(
    (f) => f.group === 'spec' && normalizeLabel(f.label) === targetNorm
  );
  if (exact) return exact;

  // Secondary fuzzy match consistent with auto-transfer rules
  return fields.find((f) => {
    if (f.group !== 'spec') return false;
    const fNorm = normalizeLabel(f.label);
    if (!fNorm) return false;
    if (targetNorm === '機器番号' && (fNorm.includes('機器番号') || fNorm.includes('tag'))) return true;
    if (targetNorm === '口径' && fNorm.includes('口径')) return true;
    if (targetNorm === '材質' && fNorm.includes('材質')) return true;
    return fNorm.includes(targetNorm) || targetNorm.includes(fNorm);
  });
}

/**
 * Builds the list of draggable specification chips for a single selected equipment item (slot 0..3),
 * using the exact same value formatting as the standard auto-transfer engine.
 */
export function buildDraggableSpecChipsForItem(
  item: EquipmentItem,
  slotIndex: 0 | 1 | 2 | 3,
  template: SpecTemplate,
  overrideChipCells: Record<string, string[]> = {}
): DraggableSpecChip[] {
  const normalizedTpl = normalizeSpecTemplate(template);
  const fields = normalizedTpl.fields || [];
  const chips: DraggableSpecChip[] = [];

  const pushChip = (
    idSuffix: string,
    label: string,
    value: string,
    kind: 'detail' | 'spec',
    detailFieldId?: string
  ) => {
    const cleanVal = (value || '').trim();
    if (!cleanVal) return;
    const chipKey = `slot${slotIndex}:${idSuffix}`;
    const matched = findMatchingFieldForChip(fields, { kind, detailFieldId, label });
    const mappedCell = matched ? getFieldCellForSlot(matched, slotIndex) || undefined : undefined;
    chips.push({
      chipKey,
      slotIndex,
      itemId: item.id,
      itemTagNo: item.tagNo || '未割当',
      itemName: item.name || '',
      label,
      value: cleanVal,
      kind,
      detailFieldId,
      mappedCell,
      overriddenCells: overrideChipCells[chipKey] || [],
    });
  };

  // 1. Detail & core equipment attributes
  if (item.tagNo) {
    pushChip('core:tagNo', '機器番号', item.tagNo, 'spec');
  }
  pushChip('detail:name', '機器名', item.name || '', 'detail', 'f-detail-name');
  pushChip('detail:qty', '数量', `${item.quantity} ${item.unit || '台'}`, 'detail', 'f-detail-qty');
  if (item.deliveryDate) {
    pushChip('detail:delivery', '納期', item.deliveryDate, 'detail', 'f-detail-delivery');
  }

  const customSpecNames = new Set((item.specs || []).map((s) => normalizeLabel(s.name)));

  if (item.diameter && item.diameter !== '-' && !customSpecNames.has('口径')) {
    pushChip('core:diameter', '口径', item.diameter, 'spec');
  }
  if (!customSpecNames.has('材質')) {
    let matVal = item.material && item.material !== '-' ? item.material : '';
    if (!matVal && item.materials && item.materials.length > 0) {
      matVal = item.materials.map((m) => `${m.part}: ${m.value || ''}`).join(', ');
    }
    if (matVal) {
      pushChip('core:material', '材質', matVal, 'spec');
    }
  }
  if (item.accessories && item.accessories.length > 0 && !customSpecNames.has('付属品')) {
    const accVal = item.accessories
      .map((a) => `${a.name}${a.quantity ? ` (${a.quantity}${a.unit || ''})` : ''}`)
      .join(', ');
    if (accVal) {
      pushChip('core:accessories', '付属品', accVal, 'spec');
    }
  }

  // 2. All custom specification parameters (same "value unit" format as auto-transfer)
  for (const sp of item.specs || []) {
    const name = (sp.name || '').trim();
    const formattedVal = `${sp.value ?? ''}${sp.unit ? ' ' + sp.unit : ''}`.trim();
    if (!name || !formattedVal) continue;
    pushChip(`spec:${sp.id || name}`, name, formattedVal, 'spec');
  }

  // 3. Equipment notes
  if (item.notes && item.notes.trim()) {
    pushChip('detail:notes', '特記事項', item.notes.trim(), 'detail', 'f-detail-notes');
  }

  return chips;
}

export interface ApplyChipDropResult {
  updatedTemplate: SpecTemplate;
  fieldId: string;
  formKey: string;
  previousCell?: string;
}

/**
 * Registers or updates a cell mapping in the template for the dropped equipment chip (Pattern A).
 * Clears any conflicting field currently pointing to targetCellAddress so cells remain 1-to-1.
 */
export function applyChipDropToTemplate(
  template: SpecTemplate,
  chip: DraggableSpecChip,
  targetCellAddress: string
): ApplyChipDropResult {
  const cleanAddr = targetCellAddress.trim().toUpperCase();
  const slotKey = getSlotKeyForIndex(chip.slotIndex);
  const normalizedTpl = normalizeSpecTemplate(template);

  // Clone fields & remove any existing mapping currently occupying cleanAddr
  const nextFields: SpecFieldMapping[] = (normalizedTpl.fields || []).map((f) => {
    let changed = false;
    const copy = { ...f };
    for (const sk of SLOT_KEYS) {
      if ((copy[sk] || '').trim().toUpperCase() === cleanAddr) {
        copy[sk] = '';
        changed = true;
      }
    }
    return changed ? copy : f;
  });

  const existingIdx = nextFields.findIndex((f) => {
    if (chip.kind === 'detail' && chip.detailFieldId) {
      return f.group === 'detail' && (f.id === chip.detailFieldId || f.label === chip.label);
    }
    return f.group === 'spec' && normalizeLabel(f.label) === normalizeLabel(chip.label);
  });

  let fieldId: string;
  let previousCell: string | undefined;

  if (existingIdx >= 0) {
    const target = { ...nextFields[existingIdx] };
    previousCell = (target[slotKey] || '').trim().toUpperCase() || undefined;
    target[slotKey] = cleanAddr;
    nextFields[existingIdx] = target;
    fieldId = target.id;
  } else {
    fieldId = `f-spec-dnd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newField: SpecFieldMapping = {
      id: fieldId,
      label: chip.label,
      cell: '',
      cellSlot2: '',
      cellSlot3: '',
      cellSlot4: '',
      type: 'text',
      group: 'spec',
      defaultValue: '',
      description: 'プレビューへのドラッグ＆ドロップで追加されたマッピング',
    };
    newField[slotKey] = cleanAddr;
    nextFields.push(newField);
  }

  const updatedTemplate: SpecTemplate = normalizeSpecTemplate({
    ...normalizedTpl,
    fields: nextFields,
    updatedAt: new Date().toISOString().slice(0, 10),
  });

  return {
    updatedTemplate,
    fieldId,
    formKey: getFormKeyForFieldSlot(fieldId, chip.slotIndex),
    previousCell,
  };
}

/**
 * Unmaps a specific cell address from any field slot in the template.
 */
export function unmapCellFromTemplate(
  template: SpecTemplate,
  targetCellAddress: string
): { updatedTemplate: SpecTemplate; removedLabel?: string; removedFormKeys: string[] } {
  const cleanAddr = targetCellAddress.trim().toUpperCase();
  const normalizedTpl = normalizeSpecTemplate(template);
  let removedLabel: string | undefined;
  const removedFormKeys: string[] = [];

  const nextFields: SpecFieldMapping[] = (normalizedTpl.fields || []).map((f) => {
    let changed = false;
    const copy = { ...f };
    SLOT_KEYS.forEach((sk, idx) => {
      if ((copy[sk] || '').trim().toUpperCase() === cleanAddr) {
        copy[sk] = '';
        changed = true;
        removedLabel = removedLabel || f.label;
        removedFormKeys.push(getFormKeyForFieldSlot(f.id, idx));
      }
    });
    return changed ? copy : f;
  });

  return {
    updatedTemplate: normalizeSpecTemplate({
      ...normalizedTpl,
      fields: nextFields,
      updatedAt: new Date().toISOString().slice(0, 10),
    }),
    removedLabel,
    removedFormKeys,
  };
}
