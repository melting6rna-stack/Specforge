import { EquipmentItem, EquipmentClassification } from '../types';

export const CLASSIFICATION_OPTIONS: { value: EquipmentClassification; label: string; desc: string }[] = [
  { value: '03', label: '03: 購入品', desc: '購入品・汎用調達品' },
  { value: '04', label: '04: 製作品', desc: '製作品・オーダー品' },
];

/**
 * Parses tagNo like '03-001', '04-002', or legacy 'V-101' into classification and sequence number.
 */
export function parseTagNo(tagNo?: string, defaultClassification: EquipmentClassification = '03'): {
  classification: EquipmentClassification;
  seq: number;
} {
  if (!tagNo) return { classification: defaultClassification, seq: 1 };
  const trimmed = tagNo.trim();
  const match04 = trimmed.match(/^04-(\d+)/);
  if (match04) {
    return { classification: '04', seq: parseInt(match04[1], 10) || 1 };
  }
  const match03 = trimmed.match(/^03-(\d+)/);
  if (match03) {
    return { classification: '03', seq: parseInt(match03[1], 10) || 1 };
  }
  return { classification: defaultClassification, seq: 1 };
}

/**
 * Extracts classification and sequence number from an item.
 */
export function getClassificationAndSeq(item: Partial<EquipmentItem>): {
  classification: EquipmentClassification;
  seq: number;
} {
  const preferredClassification = (item.classification === '04' ? '04' : '03') as EquipmentClassification;
  return parseTagNo(item.tagNo, preferredClassification);
}

/**
 * Formats classification and number into '03-001' or '04-001'.
 */
export function formatTagNo(classification: EquipmentClassification, seq: number): string {
  const safeSeq = Math.max(1, isNaN(seq) ? 1 : Math.round(seq));
  return `${classification}-${String(safeSeq).padStart(3, '0')}`;
}

/**
 * Re-sequences all items for a given project so that all '03' items are numbered 03-001..03-N
 * and all '04' items are numbered 04-001..04-M in their given list order.
 */
export function resequenceProjectItems(projectItems: EquipmentItem[]): EquipmentItem[] {
  const items03: EquipmentItem[] = [];
  const items04: EquipmentItem[] = [];

  for (const it of projectItems) {
    const { classification } = getClassificationAndSeq(it);
    if (classification === '04') {
      items04.push(it);
    } else {
      items03.push(it);
    }
  }

  // Renumber items03 sequentially from 1
  const resequenced03 = items03.map((it, idx) => ({
    ...it,
    classification: '03' as EquipmentClassification,
    tagNo: formatTagNo('03', idx + 1)
  }));

  // Renumber items04 sequentially from 1
  const resequenced04 = items04.map((it, idx) => ({
    ...it,
    classification: '04' as EquipmentClassification,
    tagNo: formatTagNo('04', idx + 1)
  }));

  // Recombine preserving the relative order of 03 and 04 items in original list
  let idx03 = 0;
  let idx04 = 0;
  return projectItems.map(it => {
    const { classification } = getClassificationAndSeq(it);
    if (classification === '04') {
      return resequenced04[idx04++];
    } else {
      return resequenced03[idx03++];
    }
  });
}

/**
 * Places/moves an item into target classification ('03' or '04') at targetSeq (1-indexed).
 * Shifts the existing item at targetSeq and all subsequent items down by 1 in that group.
 * Also closes any gap in the vacated group.
 */
export function placeItemWithResequence(
  allProjectItems: EquipmentItem[],
  targetItem: EquipmentItem,
  targetClassification: EquipmentClassification,
  targetSeq: number
): EquipmentItem[] {
  // Separate other items in project
  const otherItems = allProjectItems.filter(it => it.id !== targetItem.id);

  // Group existing others into 03 and 04
  const others03: EquipmentItem[] = [];
  const others04: EquipmentItem[] = [];

  for (const it of otherItems) {
    const { classification } = getClassificationAndSeq(it);
    if (classification === '04') {
      others04.push(it);
    } else {
      others03.push(it);
    }
  }

  // Sort by their current seq
  others03.sort((a, b) => getClassificationAndSeq(a).seq - getClassificationAndSeq(b).seq);
  others04.sort((a, b) => getClassificationAndSeq(a).seq - getClassificationAndSeq(b).seq);

  const updatedTarget: EquipmentItem = {
    ...targetItem,
    classification: targetClassification
  };

  let new03: EquipmentItem[] = [];
  let new04: EquipmentItem[] = [];

  if (targetClassification === '03') {
    const insertIdx = Math.max(0, Math.min(targetSeq - 1, others03.length));
    new03 = [...others03.slice(0, insertIdx), updatedTarget, ...others03.slice(insertIdx)];
    new04 = others04;
  } else {
    const insertIdx = Math.max(0, Math.min(targetSeq - 1, others04.length));
    new04 = [...others04.slice(0, insertIdx), updatedTarget, ...others04.slice(insertIdx)];
    new03 = others03;
  }

  // Renumber new03: 03-001, 03-002, 03-003...
  const final03 = new03.map((it, idx) => ({
    ...it,
    classification: '03' as EquipmentClassification,
    tagNo: formatTagNo('03', idx + 1)
  }));

  // Renumber new04: 04-001, 04-002, 04-003...
  const final04 = new04.map((it, idx) => ({
    ...it,
    classification: '04' as EquipmentClassification,
    tagNo: formatTagNo('04', idx + 1)
  }));

  return [...final03, ...final04];
}
