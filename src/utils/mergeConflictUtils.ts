import {
  EquipmentItem,
  Category,
  ChangeLog,
  SpecIssuanceRecord,
  SpecRevisionSnapshot,
  RevisionNumber,
} from '../types';

export type ConflictChoice = 'disk' | 'local';

export interface EquipmentConflict {
  conflictId: string;
  kind: 'field' | 'delete_vs_edit';
  itemId: string;
  itemTagNo: string;
  itemName: string;
  fieldKey: string;
  fieldLabel: string;
  baseDisplay: string;
  diskDisplay: string;
  localDisplay: string;
  diskRawValue: any;
  localRawValue: any;
}

export interface EquipmentMergeResult {
  mergedItems: EquipmentItem[];
  mergedCategories: Category[];
  conflicts: EquipmentConflict[];
  autoMergedSummary: {
    addedFromDisk: number;
    updatedFromDisk: number;
    deletedFromDisk: number;
    addedFromLocal: number;
    updatedFromLocal: number;
  };
}

export interface LedgerConflict {
  conflictId: string;
  recordId: string;
  recordTitle: string;
  docNo: string;
  revision: RevisionNumber;
  diskSnapshot: SpecRevisionSnapshot;
  localSnapshot: SpecRevisionSnapshot;
  diskSummaryText: string;
  localSummaryText: string;
}

export interface LedgerMergeResult {
  mergedRecords: SpecIssuanceRecord[];
  conflicts: LedgerConflict[];
  autoMergedCount: number;
}

interface TrackedFieldDef {
  key: keyof EquipmentItem;
  label: string;
}

const TRACKED_ITEM_FIELDS: TrackedFieldDef[] = [
  { key: 'tagNo', label: '機器番号 (タグNo.)' },
  { key: 'classification', label: '機器区分' },
  { key: 'equipmentType', label: '機器種別' },
  { key: 'name', label: '機器名' },
  { key: 'quantity', label: '数量' },
  { key: 'unit', label: '単位' },
  { key: 'deliveryDate', label: '納入時期' },
  { key: 'isIssued', label: '仕様書発行状態' },
  { key: 'categoryId', label: '所属カテゴリ' },
  { key: 'deliveryLocation', label: '納入場所' },
  { key: 'diameter', label: '口径' },
  { key: 'material', label: '材質' },
  { key: 'notes', label: '特記事項' },
  { key: 'specs', label: '機器仕様項目' },
  { key: 'coating', label: '塗装仕様' },
  { key: 'materials', label: '主要材質構成' },
  { key: 'accessories', label: '付属品・予備品' },
  { key: 'action', label: '区分・アクション' },
  { key: 'purpose', label: '用途' },
];

function canonicalizeFieldValue(key: keyof EquipmentItem, val: any): any {
  if (val === undefined || val === null) {
    if (key === 'isIssued') return false;
    if (key === 'specs' || key === 'materials' || key === 'accessories') return [];
    return '';
  }
  if (key === 'isIssued') return Boolean(val);
  if (key === 'quantity') return Number(val) || 0;
  if (key === 'specs' && Array.isArray(val)) {
    return val.map((s: any) => ({
      name: String(s?.name || '').trim(),
      value: String(s?.value ?? '').trim(),
      unit: String(s?.unit || '').trim(),
    }));
  }
  if (key === 'coating' && typeof val === 'object') {
    const spec = val.specification || null;
    const color = val.color || null;
    const target_part = val.target_part || null;
    const note = val.note || null;
    if (!spec && !color && !note) return null;
    return { specification: spec, color, target_part, note };
  }
  if (key === 'materials' && Array.isArray(val)) {
    return val.map((m: any) => ({
      part: String(m?.part || ''),
      value: m?.value ?? null,
      condition: m?.condition ?? null,
      note: m?.note ?? null,
    }));
  }
  if (key === 'accessories' && Array.isArray(val)) {
    return val.map((a: any) => ({
      name: String(a?.name || ''),
      quantity: a?.quantity ?? null,
      unit: a?.unit ?? null,
      note: a?.note ?? null,
    }));
  }
  if (typeof val === 'string') return val.trim();
  return val;
}

function areFieldValuesEqual(key: keyof EquipmentItem, a: any, b: any): boolean {
  const ca = canonicalizeFieldValue(key, a);
  const cb = canonicalizeFieldValue(key, b);
  return JSON.stringify(ca) === JSON.stringify(cb);
}

function areItemsContentEqual(a: EquipmentItem, b: EquipmentItem): boolean {
  return TRACKED_ITEM_FIELDS.every((f) => areFieldValuesEqual(f.key, a[f.key], b[f.key]));
}

export function formatFieldValueForDisplay(
  key: string,
  val: any,
  categoriesMap?: Record<string, string>
): string {
  if (val === undefined || val === null || val === '') return '（空欄）';
  if (key === 'isIssued') return val ? '済' : '未';
  if (key === 'categoryId') {
    return (categoriesMap && categoriesMap[String(val)]) || String(val);
  }
  if (key === 'specs' && Array.isArray(val)) {
    if (val.length === 0) return '（仕様項目なし）';
    return val
      .map((s: any) => `${s.name}: ${s.value || '-'}${s.unit ? ' ' + s.unit : ''}`)
      .join(' / ');
  }
  if (key === 'coating' && typeof val === 'object') {
    const parts = [val.specification, val.color, val.target_part, val.note].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : '（空欄）';
  }
  if (key === 'materials' && Array.isArray(val)) {
    if (val.length === 0) return '（なし）';
    return val.map((m: any) => `${m.part}: ${m.value || '-'}`).join(' / ');
  }
  if (key === 'accessories' && Array.isArray(val)) {
    if (val.length === 0) return '（なし）';
    return val.map((a: any) => `${a.name}${a.quantity ? `(${a.quantity}${a.unit || ''})` : ''}`).join(' / ');
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function mergeChangeLogs(a?: ChangeLog[], b?: ChangeLog[]): ChangeLog[] | undefined {
  const combined = [...(a || []), ...(b || [])];
  if (combined.length === 0) return undefined;
  const seen = new Set<string>();
  const deduped: ChangeLog[] = [];
  for (const log of combined) {
    const key = log.id || `${log.timestamp}|${log.field}|${log.oldValue}|${log.newValue}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(log);
    }
  }
  return deduped;
}

export function mergeCategoriesList(
  baseCats: Category[],
  diskCats: Category[],
  localCats: Category[]
): Category[] {
  const byId = new Map<string, Category>();
  const seenNames = new Set<string>();

  for (const c of diskCats) {
    byId.set(c.id, c);
    seenNames.add(c.name.trim());
  }
  for (const c of localCats) {
    if (byId.has(c.id)) {
      // Keep local name update if base had old name and disk didn't rename
      const baseMatch = baseCats.find((b) => b.id === c.id);
      const diskMatch = diskCats.find((d) => d.id === c.id);
      if (baseMatch && diskMatch && diskMatch.name === baseMatch.name && c.name !== baseMatch.name) {
        byId.set(c.id, c);
      }
    } else if (!seenNames.has(c.name.trim())) {
      byId.set(c.id, c);
      seenNames.add(c.name.trim());
    }
  }
  return Array.from(byId.values());
}

/**
 * Performs 3-way field-level merge between:
 * - baseItems (snapshot at last load/save)
 * - diskItems (latest items currently saved on disk by other users)
 * - localItems (current user's edited items in memory)
 */
export function mergeEquipmentDatabase(
  baseItems: EquipmentItem[],
  diskItems: EquipmentItem[],
  localItems: EquipmentItem[],
  baseCategories: Category[] = [],
  diskCategories: Category[] = [],
  localCategories: Category[] = []
): EquipmentMergeResult {
  const mergedCategories = mergeCategoriesList(baseCategories, diskCategories, localCategories);
  const categoriesMap: Record<string, string> = {};
  for (const c of [...baseCategories, ...diskCategories, ...localCategories]) {
    if (c.id && c.name) categoriesMap[c.id] = c.name;
  }

  const baseMap = new Map<string, EquipmentItem>(baseItems.map((it) => [it.id, it]));
  const diskMap = new Map<string, EquipmentItem>(diskItems.map((it) => [it.id, it]));
  const localMap = new Map<string, EquipmentItem>(localItems.map((it) => [it.id, it]));

  // Ordered union of all item IDs (preserving local order first, appending disk-added items)
  const orderedIds: string[] = [];
  const pushed = new Set<string>();
  for (const it of localItems) {
    if (!pushed.has(it.id)) {
      orderedIds.push(it.id);
      pushed.add(it.id);
    }
  }
  for (const it of diskItems) {
    if (!pushed.has(it.id)) {
      orderedIds.push(it.id);
      pushed.add(it.id);
    }
  }

  const mergedItems: EquipmentItem[] = [];
  const conflicts: EquipmentConflict[] = [];
  const autoMergedSummary = {
    addedFromDisk: 0,
    updatedFromDisk: 0,
    deletedFromDisk: 0,
    addedFromLocal: 0,
    updatedFromLocal: 0,
  };

  for (const id of orderedIds) {
    const baseItem = baseMap.get(id);
    const diskItem = diskMap.get(id);
    const localItem = localMap.get(id);

    // Case 1: Added on disk only
    if (!baseItem && diskItem && !localItem) {
      mergedItems.push(diskItem);
      autoMergedSummary.addedFromDisk++;
      continue;
    }

    // Case 2: Added locally only
    if (!baseItem && localItem && !diskItem) {
      mergedItems.push(localItem);
      autoMergedSummary.addedFromLocal++;
      continue;
    }

    // Case 3: Deleted on disk (existed in base, missing on disk)
    if (baseItem && !diskItem && localItem) {
      if (areItemsContentEqual(baseItem, localItem)) {
        // Local did not touch it -> accept disk deletion
        autoMergedSummary.deletedFromDisk++;
        continue;
      } else {
        // Local modified it while disk deleted it -> conflict
        mergedItems.push(localItem);
        conflicts.push({
          conflictId: `${id}::__delete__`,
          kind: 'delete_vs_edit',
          itemId: id,
          itemTagNo: localItem.tagNo || '-',
          itemName: localItem.name || '-',
          fieldKey: '__delete__',
          fieldLabel: '機器の削除 vs 編集',
          baseDisplay: `${baseItem.tagNo} ${baseItem.name}`,
          diskDisplay: '（他ユーザーが削除）',
          localDisplay: `保持して編集 (${localItem.tagNo} ${localItem.name})`,
          diskRawValue: null,
          localRawValue: localItem,
        });
        continue;
      }
    }

    // Case 4: Deleted locally (existed in base, missing locally)
    if (baseItem && diskItem && !localItem) {
      if (areItemsContentEqual(baseItem, diskItem)) {
        // Disk did not touch it -> accept local deletion
        continue;
      } else {
        // Disk modified it while local deleted it -> conflict
        mergedItems.push(diskItem);
        conflicts.push({
          conflictId: `${id}::__delete__`,
          kind: 'delete_vs_edit',
          itemId: id,
          itemTagNo: diskItem.tagNo || '-',
          itemName: diskItem.name || '-',
          fieldKey: '__delete__',
          fieldLabel: '機器の削除 vs 他ユーザーの編集',
          baseDisplay: `${baseItem.tagNo} ${baseItem.name}`,
          diskDisplay: `保持して更新 (${diskItem.tagNo} ${diskItem.name})`,
          localDisplay: '（あなたが削除）',
          diskRawValue: diskItem,
          localRawValue: null,
        });
        continue;
      }
    }

    // Case 5: Present on both disk and local
    if (diskItem && localItem) {
      // If both added same ID without base, or both exist with base -> field-by-field merge
      const refBase = baseItem || diskItem;
      const merged: EquipmentItem = {
        ...diskItem,
        ...localItem,
        history: mergeChangeLogs(localItem.history, diskItem.history),
      };

      let tookFromDisk = false;
      let tookFromLocal = false;

      for (const f of TRACKED_ITEM_FIELDS) {
        const bVal = baseItem ? baseItem[f.key] : undefined;
        const dVal = diskItem[f.key];
        const lVal = localItem[f.key];

        if (areFieldValuesEqual(f.key, dVal, lVal)) {
          (merged as any)[f.key] = lVal;
          continue;
        }

        if (baseItem) {
          const diskChanged = !areFieldValuesEqual(f.key, bVal, dVal);
          const localChanged = !areFieldValuesEqual(f.key, bVal, lVal);

          if (!diskChanged && localChanged) {
            (merged as any)[f.key] = lVal;
            tookFromLocal = true;
            continue;
          }
          if (diskChanged && !localChanged) {
            (merged as any)[f.key] = dVal;
            tookFromDisk = true;
            continue;
          }
        }

        // True conflict: both changed the exact same field to different values
        // Default tentative value to disk until user picks
        (merged as any)[f.key] = dVal;
        conflicts.push({
          conflictId: `${id}::${String(f.key)}`,
          kind: 'field',
          itemId: id,
          itemTagNo: localItem.tagNo || diskItem.tagNo || '-',
          itemName: localItem.name || diskItem.name || '-',
          fieldKey: String(f.key),
          fieldLabel: f.label,
          baseDisplay: baseItem
            ? formatFieldValueForDisplay(String(f.key), refBase[f.key], categoriesMap)
            : '（新規）',
          diskDisplay: formatFieldValueForDisplay(String(f.key), dVal, categoriesMap),
          localDisplay: formatFieldValueForDisplay(String(f.key), lVal, categoriesMap),
          diskRawValue: dVal,
          localRawValue: lVal,
        });
      }

      if (merged.rawTokki) {
        merged.rawTokki = {
          ...merged.rawTokki,
          equipment_type: merged.equipmentType || 'PA',
        };
      }

      if (tookFromDisk) autoMergedSummary.updatedFromDisk++;
      if (tookFromLocal) autoMergedSummary.updatedFromLocal++;
      mergedItems.push(merged);
    }
  }

  return {
    mergedItems,
    mergedCategories,
    conflicts,
    autoMergedSummary,
  };
}

export function applyEquipmentConflictResolutions(
  autoMergedItems: EquipmentItem[],
  conflicts: EquipmentConflict[],
  resolutions: Record<string, ConflictChoice>
): EquipmentItem[] {
  const result = autoMergedItems.map((it) => ({ ...it }));
  const deletedIds = new Set<string>();

  for (const conflict of conflicts) {
    const choice: ConflictChoice = resolutions[conflict.conflictId] || 'disk';
    if (conflict.kind === 'delete_vs_edit') {
      const chosenItem = choice === 'disk' ? conflict.diskRawValue : conflict.localRawValue;
      if (!chosenItem) {
        deletedIds.add(conflict.itemId);
      } else {
        const idx = result.findIndex((it) => it.id === conflict.itemId);
        if (idx >= 0) result[idx] = chosenItem;
        else result.push(chosenItem);
      }
    } else {
      const idx = result.findIndex((it) => it.id === conflict.itemId);
      if (idx >= 0) {
        const chosenVal = choice === 'disk' ? conflict.diskRawValue : conflict.localRawValue;
        (result[idx] as any)[conflict.fieldKey] = chosenVal;
        if (conflict.fieldKey === 'equipmentType' && result[idx].rawTokki) {
          result[idx].rawTokki = {
            ...result[idx].rawTokki,
            equipment_type: chosenVal || 'PA',
          };
        }
      }
    }
  }

  return result.filter((it) => !deletedIds.has(it.id));
}

function areSnapshotsEqual(a?: SpecRevisionSnapshot, b?: SpecRevisionSnapshot): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.revision === b.revision &&
    a.revDate === b.revDate &&
    a.revAuthor === b.revAuthor &&
    a.revSummary === b.revSummary &&
    a.docNo === b.docNo &&
    a.templateId === b.templateId &&
    (a.templateExcelFileName || '') === (b.templateExcelFileName || '') &&
    (a.templateMappingFileName || '') === (b.templateMappingFileName || '') &&
    JSON.stringify(a.orderedItemIds) === JSON.stringify(b.orderedItemIds) &&
    JSON.stringify(a.formValues) === JSON.stringify(b.formValues) &&
    JSON.stringify(a.cellOverrides) === JSON.stringify(b.cellOverrides) &&
    JSON.stringify(a.changedCells) === JSON.stringify(b.changedCells)
  );
}

/**
 * Performs 3-way merge for Specification Issuance Ledger JSON records.
 * Different spec records (and even different revision numbers of the same spec) auto-merge cleanly.
 * Only concurrent edits to the exact same spec record + exact same revision number raise a conflict.
 */
export function mergeLedgerRecords(
  baseRecords: SpecIssuanceRecord[],
  diskRecords: SpecIssuanceRecord[],
  localRecords: SpecIssuanceRecord[]
): LedgerMergeResult {
  const baseMap = new Map(baseRecords.map((r) => [r.id, r]));
  const diskMap = new Map(diskRecords.map((r) => [r.id, r]));
  const localMap = new Map(localRecords.map((r) => [r.id, r]));

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const r of localRecords) {
    if (!seen.has(r.id)) {
      orderedIds.push(r.id);
      seen.add(r.id);
    }
  }
  for (const r of diskRecords) {
    if (!seen.has(r.id)) {
      orderedIds.push(r.id);
      seen.add(r.id);
    }
  }

  const mergedRecords: SpecIssuanceRecord[] = [];
  const conflicts: LedgerConflict[] = [];
  let autoMergedCount = 0;

  for (const id of orderedIds) {
    const baseRec = baseMap.get(id);
    const diskRec = diskMap.get(id);
    const localRec = localMap.get(id);

    if (!baseRec && diskRec && !localRec) {
      mergedRecords.push(diskRec);
      autoMergedCount++;
      continue;
    }
    if (!baseRec && localRec && !diskRec) {
      mergedRecords.push(localRec);
      continue;
    }
    if (baseRec && !diskRec && localRec) {
      // Deleted on disk while untouched locally -> drop; if modified locally -> keep
      if (localRec.updatedAt === baseRec.updatedAt) {
        autoMergedCount++;
        continue;
      }
      mergedRecords.push(localRec);
      continue;
    }
    if (baseRec && diskRec && !localRec) {
      if (diskRec.updatedAt === baseRec.updatedAt) {
        continue;
      }
      mergedRecords.push(diskRec);
      autoMergedCount++;
      continue;
    }

    if (diskRec && localRec) {
      const baseSnaps = new Map((baseRec?.revisions || []).map((s) => [s.revision, s]));
      const diskSnaps = new Map((diskRec.revisions || []).map((s) => [s.revision, s]));
      const localSnaps = new Map((localRec.revisions || []).map((s) => [s.revision, s]));

      const allRevNums: RevisionNumber[] = ([0, 1, 2, 3] as RevisionNumber[]).filter(
        (rev) => diskSnaps.has(rev) || localSnaps.has(rev)
      );

      const finalSnaps: SpecRevisionSnapshot[] = [];
      let usedDiskMeta = false;

      for (const rev of allRevNums) {
        const bS = baseSnaps.get(rev);
        const dS = diskSnaps.get(rev);
        const lS = localSnaps.get(rev);

        if (dS && !lS) {
          finalSnaps.push(dS);
          autoMergedCount++;
          usedDiskMeta = true;
          continue;
        }
        if (lS && !dS) {
          finalSnaps.push(lS);
          continue;
        }
        if (dS && lS) {
          if (areSnapshotsEqual(dS, lS)) {
            finalSnaps.push(lS);
            continue;
          }
          if (bS && areSnapshotsEqual(bS, dS)) {
            finalSnaps.push(lS);
            continue;
          }
          if (bS && areSnapshotsEqual(bS, lS)) {
            finalSnaps.push(dS);
            autoMergedCount++;
            usedDiskMeta = true;
            continue;
          }

          // Both modified/created same revision number of same spec differently -> conflict
          finalSnaps.push(dS);
          conflicts.push({
            conflictId: `${id}::rev${rev}`,
            recordId: id,
            recordTitle: localRec.title || diskRec.title,
            docNo: localRec.docNo || diskRec.docNo,
            revision: rev,
            diskSnapshot: dS,
            localSnapshot: lS,
            diskSummaryText: `Rev.${rev} (${dS.revDate || '-'} / 改訂者: ${dS.revAuthor || '未記入'}) ${dS.revSummary || ''}`.trim(),
            localSummaryText: `Rev.${rev} (${lS.revDate || '-'} / 改訂者: ${lS.revAuthor || '未記入'}) ${lS.revSummary || ''}`.trim(),
          });
        }
      }

      const maxRev = (finalSnaps.length > 0
        ? Math.max(...finalSnaps.map((s) => s.revision))
        : localRec.currentRevision) as RevisionNumber;
      const latestSnap = finalSnaps.find((s) => s.revision === maxRev);

      const baseMeta = usedDiskMeta && diskRec.updatedAt > localRec.updatedAt ? diskRec : localRec;
      mergedRecords.push({
        ...baseMeta,
        title: latestSnap ? baseMeta.title : localRec.title,
        docNo: latestSnap?.docNo || baseMeta.docNo,
        templateId: latestSnap?.templateId || baseMeta.templateId,
        templateName: latestSnap?.templateName || baseMeta.templateName,
        templateCode: latestSnap?.templateCode ?? baseMeta.templateCode,
        templateSource: latestSnap?.templateSource ?? baseMeta.templateSource,
        templateExcelFileName: latestSnap?.templateExcelFileName ?? baseMeta.templateExcelFileName,
        templateMappingFileName: latestSnap?.templateMappingFileName ?? baseMeta.templateMappingFileName,
        templateFolderName: latestSnap?.templateFolderName ?? baseMeta.templateFolderName,
        orderedItemIds: latestSnap?.orderedItemIds || baseMeta.orderedItemIds,
        primaryItemId: latestSnap?.primaryItemId || baseMeta.primaryItemId,
        itemTagNos: latestSnap?.itemTagNos || baseMeta.itemTagNos,
        itemNames: latestSnap?.itemNames || baseMeta.itemNames,
        currentRevision: maxRev,
        revisions: finalSnaps.sort((a, b) => a.revision - b.revision),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return {
    mergedRecords,
    conflicts,
    autoMergedCount,
  };
}

export function applyLedgerConflictResolutions(
  autoMergedRecords: SpecIssuanceRecord[],
  conflicts: LedgerConflict[],
  resolutions: Record<string, ConflictChoice>
): SpecIssuanceRecord[] {
  const result = autoMergedRecords.map((r) => ({ ...r, revisions: [...r.revisions] }));

  for (const conflict of conflicts) {
    const choice: ConflictChoice = resolutions[conflict.conflictId] || 'disk';
    const chosenSnap = choice === 'disk' ? conflict.diskSnapshot : conflict.localSnapshot;
    const recIdx = result.findIndex((r) => r.id === conflict.recordId);
    if (recIdx >= 0) {
      const rec = result[recIdx];
      const nextRevs = rec.revisions.filter((s) => s.revision !== conflict.revision);
      nextRevs.push(chosenSnap);
      nextRevs.sort((a, b) => a.revision - b.revision);
      const maxRev = Math.max(...nextRevs.map((s) => s.revision)) as RevisionNumber;
      const latestSnap = nextRevs[nextRevs.length - 1];
      result[recIdx] = {
        ...rec,
        docNo: latestSnap?.docNo || rec.docNo,
        templateId: latestSnap?.templateId || rec.templateId,
        templateName: latestSnap?.templateName || rec.templateName,
        templateCode: latestSnap?.templateCode ?? rec.templateCode,
        templateSource: latestSnap?.templateSource ?? rec.templateSource,
        templateExcelFileName: latestSnap?.templateExcelFileName ?? rec.templateExcelFileName,
        templateMappingFileName: latestSnap?.templateMappingFileName ?? rec.templateMappingFileName,
        templateFolderName: latestSnap?.templateFolderName ?? rec.templateFolderName,
        orderedItemIds: latestSnap?.orderedItemIds || rec.orderedItemIds,
        primaryItemId: latestSnap?.primaryItemId || rec.primaryItemId,
        itemTagNos: latestSnap?.itemTagNos || rec.itemTagNos,
        itemNames: latestSnap?.itemNames || rec.itemNames,
        currentRevision: maxRev,
        revisions: nextRevs,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return result;
}
