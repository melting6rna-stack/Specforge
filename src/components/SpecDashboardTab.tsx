import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Download,
  ZoomIn,
  ZoomOut,
  Settings2,
  CheckSquare,
  Square,
  RefreshCw,
  Cpu,
  Lock,
  FileSpreadsheet,
  Calendar,
  Edit3,
  GitBranch,
  History,
  Plus,
  X,
  Check,
  AlertTriangle,
  Search,
  Trash2,
  Sparkles,
  HardDrive,
  FolderOpen,
} from 'lucide-react';
import {
  EquipmentItem,
  SpecTemplate,
  Category,
  SpecFieldMapping,
  ProjectWorkspace,
  TemplateFolderState,
  RevisionNumber,
  RevisionHistoryEntry,
  SpecIssuanceRecord,
  SpecRevisionSnapshot,
} from '../types';
import {
  downloadSpecificationExcel,
  renderSpecificationExcelGrid,
  computeResolvedCellValues,
  diffResolvedCellValues,
  RenderedSheetGrid,
  RenderedCellData,
  ExcelRevisionContext,
} from '../utils/exceljsEngine';
import { normalizeSpecTemplate, REVISION_FIELD_DEFS } from '../utils/templateUtils';
import { formatEquipmentTagRangeTitle } from '../utils/ledgerSyncManager';

interface SpecDashboardTabProps {
  mode: 'initial' | 'revision';
  items: EquipmentItem[];
  categories: Category[];
  templates: SpecTemplate[];
  activeProjectId: string;
  currentProject?: ProjectWorkspace;
  ledgerRecords?: SpecIssuanceRecord[];
  templateFolderState?: TemplateFolderState | null;
  onReconnectTemplateFolder?: () => void;
  onConfirmIssuance?: (record: SpecIssuanceRecord) => Promise<{ savedToDisk: boolean; needsPermission?: boolean }>;
  onDeleteLedgerRecord?: (recordId: string) => void;
  onCreateNewLedgerFile?: (projectId: string) => void;
  onRelinkLedgerFile?: (projectId: string) => void;
  onReconnectLedgerFile?: (projectId: string) => void;
  onOpenAdminMapping?: (templateId: string) => void;
  onUpdateTemplates?: (templates: SpecTemplate[]) => void;
}

const DEFAULT_REV_ENTRIES = (today: string, defaultAuthor: string): Record<1 | 2 | 3, RevisionHistoryEntry> => ({
  1: { revision: 1, revisionLabel: 'Rev1', revDate: today, revAuthor: defaultAuthor, revSummary: '' },
  2: { revision: 2, revisionLabel: 'Rev2', revDate: today, revAuthor: defaultAuthor, revSummary: '' },
  3: { revision: 3, revisionLabel: 'Rev3', revDate: today, revAuthor: defaultAuthor, revSummary: '' },
});

function parseCellAddressTokens(raw: string): string[] {
  return raw
    .split(/[\s,、;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{1,3}[0-9]{1,5}$/.test(s));
}

export const SpecDashboardTab: React.FC<SpecDashboardTabProps> = ({
  mode,
  items,
  templates,
  activeProjectId,
  currentProject,
  ledgerRecords = [],
  templateFolderState,
  onReconnectTemplateFolder,
  onConfirmIssuance,
  onDeleteLedgerRecord,
  onCreateNewLedgerFile,
  onRelinkLedgerFile,
  onReconnectLedgerFile,
  onOpenAdminMapping,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const projectItems = useMemo(
    () => items.filter((it) => it.projectId === activeProjectId),
    [items, activeProjectId]
  );

  // Saved default author convenience
  const [rememberedAuthor, setRememberedAuthor] = useState<string>(() => {
    try {
      return localStorage.getItem('specforge_last_rev_author') || '';
    } catch {
      return '';
    }
  });

  // Selected Template & compact selector filter
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [templateSearch, setTemplateSearch] = useState<string>('');

  useEffect(() => {
    if (templates.length === 0) return;
    if (!selectedTemplateId || !templates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.code || '').toLowerCase().includes(q) ||
        (t.excelFileName || '').toLowerCase().includes(q) ||
        (t.mappingFileName || '').toLowerCase().includes(q)
    );
  }, [templates, templateSearch]);

  const activeTemplate = useMemo(() => {
    const found = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    return found ? normalizeSpecTemplate(found) : found;
  }, [templates, selectedTemplateId]);

  // Selected Equipment Items (slots 1..4)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [primaryItemId, setPrimaryItemId] = useState<string>('');
  const [itemToAddId, setItemToAddId] = useState<string>('');

  // Form Values & Transfer Tracking
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [transferredFieldsMap, setTransferredFieldsMap] = useState<Record<string, string>>({});

  // Revision & History Management State
  const [selectedRevision, setSelectedRevision] = useState<RevisionNumber>(0);
  const [revEntries, setRevEntries] = useState<Record<1 | 2 | 3, RevisionHistoryEntry>>(() =>
    DEFAULT_REV_ENTRIES(new Date().toISOString().slice(0, 10), '')
  );
  const [changedCells, setChangedCells] = useState<string[]>([]);
  const [cellInputText, setCellInputText] = useState<string>('');
  const [autoTrackDiff, setAutoTrackDiff] = useState<boolean>(true);
  const [manualAddedCells, setManualAddedCells] = useState<string[]>([]);
  const [manualRemovedCells, setManualRemovedCells] = useState<string[]>([]);

  // Revision Mode: Loaded Ledger Record & Snapshot State
  const [activeRecordId, setActiveRecordId] = useState<string>('');
  const [loadedSnapshot, setLoadedSnapshot] = useState<SpecRevisionSnapshot | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState<string>('');
  const [deleteConfirmRecordId, setDeleteConfirmRecordId] = useState<string | null>(null);

  // In-memory ExcelJS rendering & editing state
  const [excelGridData, setExcelGridData] = useState<RenderedSheetGrid | null>(null);
  const [isGridRendering, setIsGridRendering] = useState<boolean>(false);
  const [renderCounter, setRenderCounter] = useState<number>(0);
  const [selectedCellAddress, setSelectedCellAddress] = useState<string>('B2');
  const [selectedSheetOverride, setSelectedSheetOverride] = useState<string>('');
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [cellOverrides, setCellOverrides] = useState<Record<string, string>>({});
  const [customColWidths, setCustomColWidths] = useState<Record<string, number>>({});
  const [inlineEditingCell, setInlineEditingCell] = useState<string | null>(null);
  const [inlineEditingValue, setInlineEditingValue] = useState<string>('');
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string>('');

  // Ensure valid selection in Initial mode when projectItems changes
  useEffect(() => {
    if (mode === 'revision') return;
    if (projectItems.length > 0) {
      if (selectedItemIds.length === 0) {
        setSelectedItemIds([projectItems[0].id]);
        setPrimaryItemId(projectItems[0].id);
      } else {
        const validIds = selectedItemIds.filter((id) => projectItems.some((it) => it.id === id));
        if (validIds.length === 0) {
          setSelectedItemIds([projectItems[0].id]);
          setPrimaryItemId(projectItems[0].id);
        } else if (!validIds.includes(primaryItemId)) {
          setPrimaryItemId(validIds[0]);
        }
      }
    } else {
      setSelectedItemIds([]);
      setPrimaryItemId('');
    }
  }, [projectItems, mode]);

  const activeItems = useMemo(() => {
    return projectItems.filter((it) => selectedItemIds.includes(it.id));
  }, [projectItems, selectedItemIds]);

  const unselectedItems = useMemo(() => {
    return projectItems.filter((it) => !selectedItemIds.includes(it.id));
  }, [projectItems, selectedItemIds]);

  const primaryItem = useMemo(() => {
    return projectItems.find((it) => it.id === primaryItemId) || activeItems[0] || projectItems[0];
  }, [projectItems, primaryItemId, activeItems]);

  const orderedActiveItems = useMemo(() => {
    if (!primaryItem) return activeItems;
    if (!activeItems.some((it) => it.id === primaryItem.id)) return activeItems;
    return [primaryItem, ...activeItems.filter((it) => it.id !== primaryItem.id)];
  }, [activeItems, primaryItem]);

  const ledgerTitlePreview = useMemo(() => {
    return formatEquipmentTagRangeTitle(orderedActiveItems);
  }, [orderedActiveItems]);

  const fixedDocNo = useMemo(() => {
    const clientCode = currentProject?.code || currentProject?.orderNo || 'PRJ-2026-01';
    const typeCode = (primaryItem?.equipmentType || 'PA').trim().toUpperCase();
    const tag = primaryItem?.tagNo || 'V-101';
    return `${clientCode}${typeCode}G-${tag}`;
  }, [currentProject?.code, currentProject?.orderNo, primaryItem?.equipmentType, primaryItem?.tagNo]);

  // Helper to resolve value for a single item + field label
  const resolveItemFieldValue = useCallback((it: EquipmentItem | undefined, label: string): string => {
    if (!it) return '';
    const clean = label.toLowerCase();
    if (clean.includes('機器番号') || clean.includes('tag') || clean.includes('タグ番号')) return it.tagNo || '';
    if (clean.includes('機器名') || clean.includes('機器名称') || (clean.includes('品名') && !clean.includes('付属') && !clean.includes('予備'))) return it.name || '';
    if (clean.includes('数量')) return `${it.quantity || 1} ${it.unit || '台'}`;
    if (clean.includes('納期') || clean.includes('納入時期')) return it.deliveryDate || '';
    if (clean.includes('口径') && it.diameter && it.diameter !== '-') return it.diameter;
    if (clean.includes('材質')) {
      let matVal = it.material && it.material !== '-' ? it.material : '';
      if (!matVal && it.materials && it.materials.length > 0) {
        matVal = it.materials.map((m) => `${m.part}: ${m.value || ''}`).join(', ');
      }
      return matVal;
    }
    if ((clean.includes('付属') || clean.includes('予備')) && it.accessories && it.accessories.length > 0) {
      return it.accessories.map((a) => `${a.name}${a.quantity ? ` (${a.quantity}${a.unit || ''})` : ''}`).join(', ');
    }
    if (clean.includes('特記') || clean.includes('備考')) return it.notes || '';
    if (it.specs && it.specs.length > 0) {
      for (const spec of it.specs) {
        const specNameClean = spec.name.toLowerCase();
        if (clean.includes(specNameClean) || specNameClean.includes(clean)) {
          return `${spec.value}${spec.unit ? ' ' + spec.unit : ''}`;
        }
      }
    }
    return '';
  }, []);

  // Helper to transfer equipment specs (Slots 1..4) and project common fields into mapped template fields
  const transferSpecsFromEquipment = useCallback(
    (
      item: EquipmentItem | undefined,
      tpl: SpecTemplate | undefined,
      currentVals: Record<string, any>,
      itemsList?: EquipmentItem[]
    ) => {
      if (!item || !tpl) return { newVals: currentVals, matchedMap: {} };

      const newVals = { ...currentVals };
      const matched: Record<string, string> = {};
      const fields: SpecFieldMapping[] = tpl.fields || [];
      const slots = itemsList && itemsList.length > 0 ? itemsList : [item];

      for (const f of fields) {
        if (f.group === 'revision') continue;
        const labelClean = f.label.toLowerCase();

        // Populate slots 2..4 when mapped
        if (f.cellSlot2) {
          const v2 = resolveItemFieldValue(slots[1], f.label);
          if (slots[1]) newVals[`${f.id}__slot2`] = v2;
          else delete newVals[`${f.id}__slot2`];
        }
        if (f.cellSlot3) {
          const v3 = resolveItemFieldValue(slots[2], f.label);
          if (slots[2]) newVals[`${f.id}__slot3`] = v3;
          else delete newVals[`${f.id}__slot3`];
        }
        if (f.cellSlot4) {
          const v4 = resolveItemFieldValue(slots[3], f.label);
          if (slots[3]) newVals[`${f.id}__slot4`] = v4;
          else delete newVals[`${f.id}__slot4`];
        }

        // Project common fields
        if (f.id === 'f-order-no' || labelClean.includes('オーダー') || labelClean.includes('注文番号') || labelClean.includes('オーダーno')) {
          const orderVal = currentProject?.orderNo || currentProject?.code;
          if (orderVal) {
            newVals[f.id] = orderVal;
            matched[f.id] = `案件共通(オーダーNo.): ${orderVal}`;
            continue;
          }
        }
        if (f.id === 'f-project-name' || labelClean.includes('工事名称') || labelClean.includes('件名') || labelClean.includes('案件名')) {
          newVals[f.id] = currentProject?.name || newVals[f.id] || '設備工事';
          matched[f.id] = `案件共通(案件名): ${currentProject?.name || ''}`;
          continue;
        }
        if (f.id === 'f-client-name' || labelClean.includes('客先名') || labelClean.includes('発注者') || labelClean.includes('顧客名')) {
          if (currentProject?.clientName) {
            newVals[f.id] = currentProject.clientName;
            matched[f.id] = `案件共通(客先名): ${currentProject.clientName}`;
            continue;
          }
        }
        if (f.id === 'f-docno' || labelClean.includes('仕様書番号')) {
          const clientCode = currentProject?.code || currentProject?.orderNo || 'PRJ-2026-01';
          const typeCode = (item.equipmentType || 'PA').trim().toUpperCase();
          newVals[f.id] = `${clientCode}${typeCode}G-${item.tagNo || 'V-101'}`;
          matched[f.id] = `客先コード・機器種別連動: ${newVals[f.id]}`;
          continue;
        }
        if (f.id === 'f-issuer' || labelClean.includes('発行元')) {
          newVals[f.id] = currentProject?.department || currentProject?.clientName || newVals[f.id] || '設計部';
          matched[f.id] = `案件共通: ${newVals[f.id]}`;
          continue;
        }
        if (f.id === 'f-client-no' || labelClean.includes('客先番号') || labelClean.includes('顧客番号') || labelClean.includes('客先コード')) {
          const clientNum =
            currentProject?.clientNumber ||
            (currentProject?.clientNumberPart1 || currentProject?.clientNumberPart2
              ? `【${currentProject.clientNumberPart1 || ''}】-【${currentProject.clientNumberPart2 || ''}】`
              : '');
          if (clientNum) {
            newVals[f.id] = clientNum;
            matched[f.id] = `案件共通(客先番号): ${clientNum}`;
            continue;
          }
        }

        // Direct equipment parameter matching
        if (labelClean.includes('機器番号') || labelClean.includes('tag') || labelClean.includes('タグ番号')) {
          newVals[f.id] = item.tagNo || '';
          matched[f.id] = `機器「機器番号」: ${item.tagNo || ''}`;
          continue;
        }
        if (labelClean.includes('機器名') || labelClean.includes('機器名称') || (labelClean.includes('品名') && !labelClean.includes('付属') && !labelClean.includes('予備'))) {
          newVals[f.id] = item.name || '';
          matched[f.id] = `機器「機器名」: ${item.name || ''}`;
          continue;
        }
        if (labelClean.includes('数量')) {
          const qVal = `${item.quantity || 1} ${item.unit || '台'}`;
          newVals[f.id] = qVal;
          matched[f.id] = `機器「数量」: ${qVal}`;
          continue;
        }
        if (labelClean.includes('納期') || labelClean.includes('納入時期')) {
          newVals[f.id] = item.deliveryDate || '';
          matched[f.id] = `機器「納入時期」: ${item.deliveryDate || ''}`;
          continue;
        }
        if (labelClean.includes('口径') && item.diameter && item.diameter !== '-') {
          newVals[f.id] = item.diameter;
          matched[f.id] = `機器「口径」: ${item.diameter}`;
          continue;
        }
        if (labelClean.includes('材質')) {
          let matVal = item.material && item.material !== '-' ? item.material : '';
          if (!matVal && item.materials && item.materials.length > 0) {
            matVal = item.materials.map((m) => `${m.part}: ${m.value || ''}`).join(', ');
          }
          if (matVal) {
            newVals[f.id] = matVal;
            matched[f.id] = `機器「材質」: ${matVal}`;
            continue;
          }
        }
        if ((labelClean.includes('付属') || labelClean.includes('予備')) && item.accessories && item.accessories.length > 0) {
          const accVal = item.accessories.map((a) => `${a.name}${a.quantity ? ` (${a.quantity}${a.unit || ''})` : ''}`).join(', ');
          newVals[f.id] = accVal;
          matched[f.id] = `機器「付属品」: ${accVal}`;
          continue;
        }
        if (labelClean.includes('特記')) {
          if (f.group === 'detail') {
            newVals[f.id] = item.notes || '';
            if (item.notes) matched[f.id] = `機器「特記事項」から転記`;
            continue;
          } else if (item.notes) {
            newVals[f.id] = item.notes;
            matched[f.id] = `機器「特記事項」から転記`;
            continue;
          }
        }

        // Dynamic specs list matching
        if (item.specs && item.specs.length > 0) {
          for (const spec of item.specs) {
            const specNameClean = spec.name.toLowerCase();
            if (labelClean.includes(specNameClean) || specNameClean.includes(labelClean)) {
              const specValStr = `${spec.value}${spec.unit ? ' ' + spec.unit : ''}`;
              if (f.type === 'select' && f.options && f.options.length > 0) {
                const matchedOpt = f.options.find((opt) => opt.includes(spec.value) || spec.value.includes(opt));
                newVals[f.id] = matchedOpt || spec.value;
              } else if (f.type === 'checkbox') {
                newVals[f.id] = true;
              } else {
                newVals[f.id] = specValStr;
              }
              matched[f.id] = `機器仕様「${spec.name}」: ${specValStr}`;
              break;
            }
          }
        }
      }

      return { newVals, matchedMap: matched };
    },
    [currentProject, resolveItemFieldValue]
  );

  // Initialize form values in INITIAL mode when template or primary item changes
  useEffect(() => {
    if (mode !== 'initial' || !activeTemplate) return;
    const initialVals: Record<string, any> = {};

    const fields: SpecFieldMapping[] = activeTemplate.fields || [];
    for (const f of fields) {
      if (f.group === 'revision') continue;
      if (f.defaultValue !== undefined) {
        initialVals[f.id] = f.defaultValue;
      } else if (f.type === 'checkbox') {
        initialVals[f.id] = false;
      } else if (f.type === 'select') {
        initialVals[f.id] = f.options?.[0] || '';
      } else {
        initialVals[f.id] = '';
      }
    }

    const { newVals, matchedMap } = transferSpecsFromEquipment(
      primaryItem,
      activeTemplate,
      initialVals,
      orderedActiveItems
    );
    setFormValues(newVals);
    setTransferredFieldsMap(matchedMap);
  }, [mode, activeTemplate, primaryItem?.id, transferSpecsFromEquipment]);

  // Reset per-session UI state when project changes
  useEffect(() => {
    setActiveRecordId('');
    setLoadedSnapshot(null);
    setChangedCells([]);
    setManualAddedCells([]);
    setManualRemovedCells([]);
    setCellOverrides({});
    setCustomColWidths({});
    if (mode === 'initial') {
      setSelectedRevision(0);
    } else {
      setSelectedRevision(1);
    }
    setRevEntries(DEFAULT_REV_ENTRIES(todayStr, rememberedAuthor));
  }, [activeProjectId, mode]);

  // Load an issued specification record into REVISION mode
  const handleSelectLedgerRecord = useCallback(
    (record: SpecIssuanceRecord) => {
      const latestSnap =
        record.revisions && record.revisions.length > 0
          ? record.revisions[record.revisions.length - 1]
          : null;

      setActiveRecordId(record.id);
      setLoadedSnapshot(latestSnap);

      // Restore template (match by ID first, then Excel/mapping filename, then templateName)
      const targetTplId = latestSnap?.templateId || record.templateId;
      const targetExcelName = latestSnap?.templateExcelFileName || record.templateExcelFileName;
      const targetMappingName = latestSnap?.templateMappingFileName || record.templateMappingFileName;
      const targetTplName = latestSnap?.templateName || record.templateName;

      const matchedTpl =
        (targetTplId ? templates.find((t) => t.id === targetTplId) : undefined) ||
        (targetExcelName
          ? templates.find(
              (t) =>
                t.excelFileName === targetExcelName ||
                t.masterFileName === targetExcelName ||
                t.originalFileName === targetExcelName
            )
          : undefined) ||
        (targetMappingName ? templates.find((t) => t.mappingFileName === targetMappingName) : undefined) ||
        (targetTplName ? templates.find((t) => t.name === targetTplName) : undefined);

      if (matchedTpl) {
        setSelectedTemplateId(matchedTpl.id);
        setSelectedSheetOverride('');
      }

      // Restore selected multi-equipment bundle automatically
      const rawIds = latestSnap?.orderedItemIds || record.orderedItemIds || [];
      const validIds = rawIds.filter((id) => projectItems.some((it) => it.id === id));
      setSelectedItemIds(validIds);
      const targetPrimary = latestSnap?.primaryItemId || record.primaryItemId || validIds[0] || '';
      setPrimaryItemId(validIds.includes(targetPrimary) ? targetPrimary : validIds[0] || '');

      // Restore formValues, cellOverrides, customColWidths from snapshot
      setFormValues(latestSnap?.formValues ? { ...latestSnap.formValues } : {});
      setCellOverrides(latestSnap?.cellOverrides ? { ...latestSnap.cellOverrides } : {});
      setCustomColWidths(latestSnap?.customColWidths ? { ...latestSnap.customColWidths } : {});
      setTransferredFieldsMap({});

      // Advance target revision to next edition (Rev0 -> Rev1, Rev1 -> Rev2, Rev2 -> Rev3)
      const nextRev = Math.min(record.currentRevision + 1, 3) as RevisionNumber;
      setSelectedRevision(nextRev);

      // Build cumulative revision entries preserving Rev1..N-1 from saved history
      const nextEntries = DEFAULT_REV_ENTRIES(todayStr, rememberedAuthor);
      const existingHistory = latestSnap?.revisionHistoryEntries || [];
      for (const entry of existingHistory) {
        if (entry.revision === 1 || entry.revision === 2 || entry.revision === 3) {
          nextEntries[entry.revision] = { ...entry };
        }
      }
      // Also backfill from individual revision snapshots if needed
      for (const snap of record.revisions || []) {
        if (snap.revision === 1 || snap.revision === 2 || snap.revision === 3) {
          if (!nextEntries[snap.revision].revSummary && (snap.revSummary || snap.revAuthor)) {
            nextEntries[snap.revision] = {
              revision: snap.revision,
              revisionLabel: snap.revisionLabel || `Rev${snap.revision}`,
              revDate: snap.revDate || todayStr,
              revAuthor: snap.revAuthor || '',
              revSummary: snap.revSummary || '',
            };
          }
        }
      }
      if (nextRev === 1 || nextRev === 2 || nextRev === 3) {
        nextEntries[nextRev] = {
          revision: nextRev,
          revisionLabel: `Rev${nextRev}`,
          revDate: todayStr,
          revAuthor: rememberedAuthor || nextEntries[nextRev].revAuthor || '',
          revSummary: nextRev > record.currentRevision ? '' : nextEntries[nextRev].revSummary,
        };
      }
      setRevEntries(nextEntries);

      // Start fresh with changedCells (previous revision red boxes revert to black!)
      setChangedCells([]);
      setManualAddedCells([]);
      setManualRemovedCells([]);
      setExportNotice(`「${record.title}」(現在: Rev.${record.currentRevision}) を台帳から読み込みました。`);
      setTimeout(() => setExportNotice(''), 4000);
    },
    [projectItems, rememberedAuthor, templates, todayStr]
  );

  // Auto-select latest record in revision mode if none selected yet and records exist
  useEffect(() => {
    if (mode !== 'revision') return;
    if (ledgerRecords.length > 0 && (!activeRecordId || !ledgerRecords.some((r) => r.id === activeRecordId))) {
      handleSelectLedgerRecord(ledgerRecords[0]);
    }
  }, [mode, ledgerRecords, activeRecordId, handleSelectLedgerRecord]);

  // Detect live differences between current Equipment DB and the loaded snapshot
  const equipmentDbPendingDiff = useMemo(() => {
    if (mode !== 'revision' || !loadedSnapshot || !activeTemplate || !primaryItem) return [];
    const { newVals } = transferSpecsFromEquipment(
      primaryItem,
      activeTemplate,
      loadedSnapshot.formValues || {},
      orderedActiveItems
    );
    const docInfo: Record<string, string> = {
      title: newVals['f-title'] || activeTemplate.name,
      documentNo: newVals['f-docno'] || fixedDocNo,
      issueDate: newVals['f-date'] || todayStr,
      notes: newVals['f-notes'] || activeTemplate.notesTemplate,
    };
    const dbResolved = computeResolvedCellValues(
      activeTemplate,
      newVals,
      orderedActiveItems,
      docInfo,
      loadedSnapshot.cellOverrides
    );
    return diffResolvedCellValues(loadedSnapshot.resolvedCellValues, dbResolved);
  }, [mode, loadedSnapshot, activeTemplate, primaryItem, orderedActiveItems, transferSpecsFromEquipment, fixedDocNo, todayStr]);

  // Compute current auto-diff between current form/overrides and loadedSnapshot.resolvedCellValues
  const currentAutoDiffCells = useMemo(() => {
    if (mode !== 'revision' || !loadedSnapshot || !activeTemplate) return [];
    const docInfo: Record<string, string> = {
      title: formValues['f-title'] || activeTemplate.name,
      documentNo: formValues['f-docno'] || fixedDocNo,
      issueDate: formValues['f-date'] || todayStr,
      notes: formValues['f-notes'] || activeTemplate.notesTemplate,
    };
    const currentResolved = computeResolvedCellValues(
      activeTemplate,
      formValues,
      orderedActiveItems,
      docInfo,
      cellOverrides
    );
    return diffResolvedCellValues(loadedSnapshot.resolvedCellValues, currentResolved);
  }, [mode, loadedSnapshot, activeTemplate, formValues, orderedActiveItems, fixedDocNo, todayStr, cellOverrides]);

  // Sync changedCells automatically in Revision mode when autoTrackDiff is ON
  useEffect(() => {
    if (mode !== 'revision' || !loadedSnapshot) return;
    if (!autoTrackDiff) return;

    const removedSet = new Set(manualRemovedCells);
    const merged = Array.from(
      new Set([
        ...currentAutoDiffCells.filter((c) => !removedSet.has(c)),
        ...manualAddedCells,
      ])
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    setChangedCells(merged);
  }, [mode, loadedSnapshot, autoTrackDiff, currentAutoDiffCells, manualAddedCells, manualRemovedCells]);

  // Equipment add/remove handlers
  const handleAddEquipment = () => {
    if (!itemToAddId) return;
    setSelectedItemIds((prev) => [...prev, itemToAddId]);
    setItemToAddId('');
  };

  const handleRemoveEquipment = (idToRemove: string) => {
    setSelectedItemIds((prev) => prev.filter((id) => id !== idToRemove));
    if (primaryItemId === idToRemove) {
      const remaining = selectedItemIds.filter((id) => id !== idToRemove);
      if (remaining.length > 0) {
        setPrimaryItemId(remaining[0]);
      }
    }
  };

  // Manual field change
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    setRenderCounter((c) => c + 1);
  };

  // Trigger manual spec re-transfer from equipment (+ auto-diff notice in revision mode)
  const handleTriggerReTransfer = () => {
    const { newVals, matchedMap } = transferSpecsFromEquipment(
      primaryItem,
      activeTemplate,
      formValues,
      orderedActiveItems
    );
    setFormValues(newVals);
    setTransferredFieldsMap(matchedMap);
    setRenderCounter((c) => c + 1);

    if (mode === 'revision' && loadedSnapshot && activeTemplate) {
      const docInfo: Record<string, string> = {
        title: newVals['f-title'] || activeTemplate.name,
        documentNo: newVals['f-docno'] || fixedDocNo,
        issueDate: newVals['f-date'] || todayStr,
        notes: newVals['f-notes'] || activeTemplate.notesTemplate,
      };
      const nextResolved = computeResolvedCellValues(
        activeTemplate,
        newVals,
        orderedActiveItems,
        docInfo,
        cellOverrides
      );
      const diffs = diffResolvedCellValues(loadedSnapshot.resolvedCellValues, nextResolved);
      setManualRemovedCells((prev) => prev.filter((c) => !diffs.includes(c)));
      if (!autoTrackDiff && diffs.length > 0) {
        setChangedCells((prev) =>
          Array.from(new Set([...prev, ...diffs])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        );
      }
      setExportNotice(
        diffs.length > 0
          ? `最新機器DBを反映し、前版からの変更セル (${diffs.join(', ')}) を自動検出して赤枠設定しました。`
          : '最新機器DBを再転記しました（前版からの値変更はありませんでした）。'
      );
      setTimeout(() => setExportNotice(''), 5000);
    }
  };

  // Manual changed-cell management helpers
  const handleAddChangedCellsFromInput = () => {
    const tokens = parseCellAddressTokens(cellInputText);
    if (tokens.length === 0) return;
    setManualRemovedCells((prev) => prev.filter((c) => !tokens.includes(c)));
    setManualAddedCells((prev) => Array.from(new Set([...prev, ...tokens])));
    setChangedCells((prev) =>
      Array.from(new Set([...prev, ...tokens])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    );
    setCellInputText('');
  };

  const handleToggleChangedCell = (addr: string) => {
    const clean = addr.trim().toUpperCase();
    if (!clean) return;
    const exists = changedCells.includes(clean);
    if (exists) {
      setManualAddedCells((prev) => prev.filter((c) => c !== clean));
      setManualRemovedCells((prev) => Array.from(new Set([...prev, clean])));
      setChangedCells((prev) => prev.filter((c) => c !== clean));
    } else {
      setManualRemovedCells((prev) => prev.filter((c) => c !== clean));
      setManualAddedCells((prev) => Array.from(new Set([...prev, clean])));
      setChangedCells((prev) =>
        Array.from(new Set([...prev, clean])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      );
    }
  };

  const handleClearChangedCells = () => {
    setManualAddedCells([]);
    setManualRemovedCells((prev) => Array.from(new Set([...prev, ...currentAutoDiffCells])));
    setChangedCells([]);
  };

  // Update revision entry field
  const handleUpdateRevEntry = (revNum: 1 | 2 | 3, patch: Partial<RevisionHistoryEntry>) => {
    if (patch.revAuthor !== undefined) {
      setRememberedAuthor(patch.revAuthor);
      try {
        localStorage.setItem('specforge_last_rev_author', patch.revAuthor);
      } catch {}
    }
    setRevEntries((prev) => ({
      ...prev,
      [revNum]: {
        ...prev[revNum],
        ...patch,
      },
    }));
  };

  // Active Excel Revision Context passed to renderer & exporter
  const activeRevisionContext: ExcelRevisionContext = useMemo(() => {
    const entries: RevisionHistoryEntry[] = [revEntries[1], revEntries[2], revEntries[3]];
    return {
      revision: selectedRevision,
      entries,
      changedCells,
    };
  }, [selectedRevision, revEntries, changedCells]);

  // Selected cell & formula bar logic
  const selectedCell = useMemo(() => {
    if (!excelGridData || !selectedCellAddress) return null;
    for (const r of excelGridData.rows) {
      for (const c of r.cells) {
        if (c.address === selectedCellAddress) return c;
      }
    }
    return null;
  }, [excelGridData, selectedCellAddress]);

  const selectedCellMappingInfo = useMemo(() => {
    if (!selectedCell || !activeTemplate?.fields) return null;
    const addr = selectedCell.address.trim().toUpperCase();
    for (const f of activeTemplate.fields) {
      if (f.group === 'revision') continue;
      if (f.cell && f.cell.trim().toUpperCase() === addr) {
        return { field: f, formKey: f.id, label: f.label };
      }
      if (f.cellSlot2 && f.cellSlot2.trim().toUpperCase() === addr) {
        return { field: f, formKey: `${f.id}__slot2`, label: `${f.label} (2種類目)` };
      }
      if (f.cellSlot3 && f.cellSlot3.trim().toUpperCase() === addr) {
        return { field: f, formKey: `${f.id}__slot3`, label: `${f.label} (3種類目)` };
      }
      if (f.cellSlot4 && f.cellSlot4.trim().toUpperCase() === addr) {
        return { field: f, formKey: `${f.id}__slot4`, label: `${f.label} (4種類目)` };
      }
    }
    return null;
  }, [selectedCell, activeTemplate]);

  const selectedCellMappedField = selectedCellMappingInfo?.field || null;

  const currentFormulaValue = useMemo(() => {
    if (!selectedCellAddress) return '';
    if (cellOverrides[selectedCellAddress] !== undefined) {
      return cellOverrides[selectedCellAddress];
    }
    if (selectedCellMappingInfo && formValues[selectedCellMappingInfo.formKey] !== undefined) {
      return formValues[selectedCellMappingInfo.formKey];
    }
    return selectedCell?.value ?? '';
  }, [selectedCellAddress, cellOverrides, selectedCellMappingInfo, formValues, selectedCell]);

  const totalColWidth = useMemo(() => {
    if (!excelGridData?.columns || excelGridData.columns.length === 0) return 960;
    return excelGridData.columns.reduce((sum, c) => sum + c.width, 0);
  }, [excelGridData]);

  const handleFormulaChange = (newVal: string) => {
    if (!selectedCellAddress) return;
    if (selectedCellMappingInfo) {
      handleFieldChange(selectedCellMappingInfo.formKey, newVal);
    } else {
      setCellOverrides((prev) => ({
        ...prev,
        [selectedCellAddress]: newVal,
      }));
    }
  };

  const handleStartInlineEdit = (cell: RenderedCellData) => {
    setInlineEditingCell(cell.address);
    const initialVal = cellOverrides[cell.address] ?? cell.value ?? '';
    setInlineEditingValue(initialVal);
  };

  const handleCommitInlineEdit = (address: string, val: string) => {
    setInlineEditingCell(null);
    const cleanAddr = address.trim().toUpperCase();
    let matchedKey: string | null = null;
    for (const f of activeTemplate?.fields || []) {
      if (f.group === 'revision') continue;
      if (f.cell && f.cell.trim().toUpperCase() === cleanAddr) {
        matchedKey = f.id;
        break;
      }
      if (f.cellSlot2 && f.cellSlot2.trim().toUpperCase() === cleanAddr) {
        matchedKey = `${f.id}__slot2`;
        break;
      }
      if (f.cellSlot3 && f.cellSlot3.trim().toUpperCase() === cleanAddr) {
        matchedKey = `${f.id}__slot3`;
        break;
      }
      if (f.cellSlot4 && f.cellSlot4.trim().toUpperCase() === cleanAddr) {
        matchedKey = `${f.id}__slot4`;
        break;
      }
    }
    if (matchedKey) {
      handleFieldChange(matchedKey, val);
    } else {
      setCellOverrides((prev) => ({
        ...prev,
        [cleanAddr]: val,
      }));
    }
  };

  const handleStartColResize = (colLetter: string, startWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(24, Math.min(600, Math.round(startWidth + diff)));
      setCustomColWidths((prev) => ({ ...prev, [colLetter]: newWidth }));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResetSingleColWidth = (colLetter: string) => {
    setCustomColWidths((prev) => {
      const next = { ...prev };
      delete next[colLetter];
      return next;
    });
  };

  // Real-time in-memory ExcelJS renderer effect
  useEffect(() => {
    if (!activeTemplate) return;
    let isCancelled = false;
    setIsGridRendering(true);

    const docInfo: Record<string, string> = {
      title: formValues['f-title'] || activeTemplate.name,
      documentNo: formValues['f-docno'] || fixedDocNo,
      issueDate: formValues['f-date'] || todayStr,
      notes: formValues['f-notes'] || activeTemplate.notesTemplate,
    };

    renderSpecificationExcelGrid(
      activeTemplate,
      formValues,
      orderedActiveItems,
      docInfo,
      selectedSheetOverride || undefined,
      cellOverrides,
      customColWidths,
      activeRevisionContext
    )
      .then((grid) => {
        if (!isCancelled) {
          setExcelGridData(grid);
          setIsGridRendering(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.warn('ExcelJS in-memory render error:', err);
          setIsGridRendering(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    activeTemplate,
    formValues,
    orderedActiveItems,
    fixedDocNo,
    todayStr,
    renderCounter,
    selectedSheetOverride,
    cellOverrides,
    customColWidths,
    activeRevisionContext,
  ]);

  // Confirm Specification & Save Snapshot to Issuance Ledger JSON + Export Excel
  const handleConfirmAndExportExcel = async () => {
    if (!activeTemplate) return;
    if (orderedActiveItems.length === 0) {
      alert('仕様書に含める機器を1点以上選択してください。');
      return;
    }

    setIsExporting(true);
    setExportNotice('仕様内容を確定し、台帳保存およびExcel出力を実行中...');

    try {
      const docNo = String(formValues['f-docno'] || fixedDocNo);
      const docInfo: Record<string, string> = {
        title: formValues['f-title'] || activeTemplate.name,
        documentNo: docNo,
        issueDate: formValues['f-date'] || todayStr,
        notes: formValues['f-notes'] || activeTemplate.notesTemplate,
      };

      const resolvedCells = computeResolvedCellValues(
        activeTemplate,
        formValues,
        orderedActiveItems,
        docInfo,
        cellOverrides
      );

      const activeHistoryEntries: RevisionHistoryEntry[] = [];
      if (selectedRevision >= 1) activeHistoryEntries.push({ ...revEntries[1] });
      if (selectedRevision >= 2) activeHistoryEntries.push({ ...revEntries[2] });
      if (selectedRevision >= 3) activeHistoryEntries.push({ ...revEntries[3] });

      const currentEntry =
        selectedRevision >= 1 ? revEntries[selectedRevision as 1 | 2 | 3] : null;

      const usedTemplateSource: 'folder' | 'preset' | 'custom_excel' =
        activeTemplate.sourceLocation === 'folder' ? 'folder' : activeTemplate.sourceType;
      const usedExcelFileName =
        activeTemplate.excelFileName || activeTemplate.masterFileName || activeTemplate.originalFileName || undefined;
      const usedMappingFileName = activeTemplate.mappingFileName || undefined;
      const usedFolderName =
        activeTemplate.sourceLocation === 'folder'
          ? activeTemplate.folderName || templateFolderState?.folderName || undefined
          : undefined;

      const snapshot: SpecRevisionSnapshot = {
        revision: selectedRevision,
        revisionLabel: currentEntry?.revisionLabel || `Rev${selectedRevision}`,
        revDate: currentEntry?.revDate || docInfo.issueDate,
        revAuthor: currentEntry?.revAuthor || '',
        revSummary: currentEntry?.revSummary || (selectedRevision === 0 ? '初版発行' : ''),
        confirmedAt: new Date().toISOString(),
        docNo,
        templateId: activeTemplate.id,
        templateName: activeTemplate.name,
        templateCode: activeTemplate.code || undefined,
        templateSource: usedTemplateSource,
        templateExcelFileName: usedExcelFileName,
        templateMappingFileName: usedMappingFileName,
        templateFolderName: usedFolderName,
        orderedItemIds: orderedActiveItems.map((it) => it.id),
        primaryItemId: orderedActiveItems[0].id,
        itemTagNos: orderedActiveItems.map((it) => it.tagNo || ''),
        itemNames: orderedActiveItems.map((it) => it.name || ''),
        formValues: JSON.parse(JSON.stringify(formValues)),
        cellOverrides: JSON.parse(JSON.stringify(cellOverrides)),
        customColWidths: JSON.parse(JSON.stringify(customColWidths)),
        changedCells: [...changedCells],
        resolvedCellValues: resolvedCells,
        revisionHistoryEntries: activeHistoryEntries,
      };

      const title = formatEquipmentTagRangeTitle(orderedActiveItems);
      const nowIso = new Date().toISOString();

      let updatedRecord: SpecIssuanceRecord;
      if (mode === 'revision' && activeRecordId) {
        const existingRec = ledgerRecords.find((r) => r.id === activeRecordId);
        const prevRevisions = existingRec?.revisions || [];
        // Replace snapshot if re-confirming the exact same revision number, otherwise append & sort
        const filteredRevs = prevRevisions.filter((r) => r.revision !== selectedRevision);
        const nextRevs = [...filteredRevs, snapshot].sort((a, b) => a.revision - b.revision);

        updatedRecord = {
          id: existingRec?.id || activeRecordId,
          projectId: activeProjectId,
          title,
          docNo,
          templateId: activeTemplate.id,
          templateName: activeTemplate.name,
          templateCode: activeTemplate.code || undefined,
          templateSource: usedTemplateSource,
          templateExcelFileName: usedExcelFileName,
          templateMappingFileName: usedMappingFileName,
          templateFolderName: usedFolderName,
          orderedItemIds: snapshot.orderedItemIds,
          primaryItemId: snapshot.primaryItemId,
          itemTagNos: snapshot.itemTagNos,
          itemNames: snapshot.itemNames,
          currentRevision: selectedRevision,
          revisions: nextRevs,
          createdAt: existingRec?.createdAt || nowIso,
          updatedAt: nowIso,
        };
      } else {
        updatedRecord = {
          id: `spec-${Date.now()}`,
          projectId: activeProjectId,
          title,
          docNo,
          templateId: activeTemplate.id,
          templateName: activeTemplate.name,
          templateCode: activeTemplate.code || undefined,
          templateSource: usedTemplateSource,
          templateExcelFileName: usedExcelFileName,
          templateMappingFileName: usedMappingFileName,
          templateFolderName: usedFolderName,
          orderedItemIds: snapshot.orderedItemIds,
          primaryItemId: snapshot.primaryItemId,
          itemTagNos: snapshot.itemTagNos,
          itemNames: snapshot.itemNames,
          currentRevision: selectedRevision,
          revisions: [snapshot],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      }

      let diskResult: { savedToDisk: boolean; needsPermission?: boolean } = { savedToDisk: false, needsPermission: false };
      if (onConfirmIssuance) {
        diskResult = await onConfirmIssuance(updatedRecord);
      }

      const safeTitle = title.replace(/[\s/\\?%*:|"<>]/g, '_');
      const safeDoc = docNo.replace(/[\s/\\?%*:|"<>]/g, '_');
      const fileName = `${safeTitle}_${safeDoc}_Rev${selectedRevision}.xlsx`;

      await downloadSpecificationExcel(
        activeTemplate,
        formValues,
        orderedActiveItems,
        docInfo,
        fileName,
        cellOverrides,
        customColWidths,
        activeRevisionContext
      );

      if (mode === 'revision') {
        setActiveRecordId(updatedRecord.id);
        setLoadedSnapshot(snapshot);
      }

      setExportNotice(
        diskResult.savedToDisk
          ? `「${title}」(Rev.${selectedRevision}) を確定し、発行台帳JSON保存とExcel出力が完了しました。`
          : `「${title}」(Rev.${selectedRevision}) を確定・Excel出力しました（ブラウザ内台帳に保存済${
              currentProject?.linkedLedgerFileName
                ? '／台帳JSONファイルへの書込は再許可が必要です'
                : '／台帳JSONファイルは案件サマリーから新規作成・紐づけできます'
            }）。`
      );
      setTimeout(() => setExportNotice(''), 6000);
    } catch (err: any) {
      alert(`確定・Excel出力中にエラーが発生しました: ${err.message || '形式をご確認ください'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Reload action
  const handleReloadPreview = useCallback(() => {
    const { newVals, matchedMap } = transferSpecsFromEquipment(
      primaryItem,
      activeTemplate,
      formValues,
      orderedActiveItems
    );
    setFormValues(newVals);
    setTransferredFieldsMap(matchedMap);
    setRenderCounter((c) => c + 1);
    setExportNotice('再読み込み完了: 入力情報とマッピングをプレビューに反映しました');
    setTimeout(() => setExportNotice(''), 3000);
  }, [primaryItem, activeTemplate, formValues, orderedActiveItems, transferSpecsFromEquipment]);

  // Field lookups
  const docNoField = useMemo(() => {
    return (activeTemplate?.fields || []).find(
      (f) => f.id === 'f-docno' || (f.group === 'basic' && f.label.includes('仕様書番号'))
    );
  }, [activeTemplate]);

  const issueDateField = useMemo(() => {
    return (activeTemplate?.fields || []).find(
      (f) => f.id === 'f-date' || (f.group === 'basic' && (f.type === 'date' || f.label.includes('発行日')))
    );
  }, [activeTemplate]);

  const revisionMappingsMissing = useMemo(() => {
    if (selectedRevision === 0 || !activeTemplate) return false;
    const revFields = (activeTemplate.fields || []).filter((f) => f.group === 'revision');
    const targetPrefix = `f-rev${selectedRevision}-`;
    return !revFields.some((f) => f.id.startsWith(targetPrefix) && f.cell && f.cell.trim() !== '');
  }, [activeTemplate, selectedRevision]);

  const checkFields = useMemo(
    () => (activeTemplate?.fields || []).filter((f) => f.type === 'checkbox' || f.group === 'check'),
    [activeTemplate]
  );
  const specFields = useMemo(
    () =>
      (activeTemplate?.fields || []).filter(
        (f) =>
          f.group !== 'detail' &&
          f.group !== 'revision' &&
          f.group !== 'basic' &&
          (f.type === 'select' || (f.group === 'spec' && f.type !== 'checkbox'))
      ),
    [activeTemplate]
  );
  const noteFields = useMemo(
    () =>
      (activeTemplate?.fields || []).filter(
        (f) =>
          f.group !== 'detail' &&
          f.group !== 'revision' &&
          (f.type === 'textarea' || f.group === 'notes')
      ),
    [activeTemplate]
  );

  // Filtered ledger records in revision mode
  const filteredLedgerRecords = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase();
    const sorted = [...ledgerRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.docNo.toLowerCase().includes(q) ||
        r.templateName.toLowerCase().includes(q) ||
        (r.templateExcelFileName || '').toLowerCase().includes(q) ||
        (r.templateMappingFileName || '').toLowerCase().includes(q) ||
        r.itemNames.some((n) => n.toLowerCase().includes(q)) ||
        r.itemTagNos.some((t) => t.toLowerCase().includes(q))
    );
  }, [ledgerRecords, ledgerSearch]);

  const activeLedgerRecord = useMemo(
    () => ledgerRecords.find((r) => r.id === activeRecordId) || null,
    [ledgerRecords, activeRecordId]
  );

  return (
    <div className="space-y-4">
      {/* Top Mode Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {mode === 'initial' ? (
              <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded font-mono">
                初版作成 (Rev.0)
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-rose-700 text-white px-2 py-0.5 rounded font-mono">
                改訂版作成 (Rev.1〜3)
              </span>
            )}
            <h1 className="text-base font-bold text-slate-900">
              {mode === 'initial'
                ? '仕様書作成スタジオ（初版作成 ＆ 台帳登録）'
                : '仕様書改訂スタジオ（発行台帳から読込・差分ハイライト）'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {mode === 'initial'
              ? 'テンプレートと機器を選択して仕様内容を入力し、「確定」ボタンでExcel出力と発行台帳JSONへの初版登録を行います。'
              : '過去の発行台帳から機器番号タイトルを選択するだけで複数機器と前版内容を復元。変更箇所の赤文字・赤枠指定と改訂履歴追記を行えます。'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {currentProject?.needsLedgerPermission && currentProject?.linkedLedgerFileName ? (
            <button
              type="button"
              onClick={() => onReconnectLedgerFile?.(activeProjectId)}
              className="px-3 py-1.5 text-xs font-bold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
              <span>台帳JSONを再接続 ({currentProject.linkedLedgerFileName})</span>
            </button>
          ) : !currentProject?.linkedLedgerFileName ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onCreateNewLedgerFile?.(activeProjectId)}
                className="px-2.5 py-1.5 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                title="新規に発行台帳JSONファイルを作成して紐づけ"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>台帳JSON新規作成</span>
              </button>
              <button
                type="button"
                onClick={() => onRelinkLedgerFile?.(activeProjectId)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                title="既存の仕様書発行台帳JSONファイルを選択"
              >
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                <span>既存台帳読込</span>
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              <span>台帳連動: {currentProject.linkedLedgerFileName}</span>
            </span>
          )}

          {onOpenAdminMapping && (
            <button
              onClick={() => onOpenAdminMapping(selectedTemplateId)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
              title="設定管理（参照元フォルダ・セル番地・変更履歴欄の設定）"
            >
              <Settings2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>設定管理</span>
            </button>
          )}
        </div>
      </div>

      {/* Revision Mode: Saved Specification Ledger Picker */}
      {mode === 'revision' && (
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-100 pb-2.5">
            <div>
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-rose-600" />
                <span>発行済み仕様書台帳から選択（保管タイトル：機器番号）</span>
                <span className="text-[10px] font-mono bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded">
                  {ledgerRecords.length}件登録済
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                選択するとテンプレート・複数機器（1〜4種類目）・前版の転記内容がすべて自動復元されます。
              </p>
            </div>

            {ledgerRecords.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  placeholder="機器番号 (03-001等) や仕様書番号で絞込"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 focus:bg-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {ledgerRecords.length === 0 ? (
            <div className="py-8 px-4 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
              <History className="w-7 h-7 text-slate-300 mx-auto" />
              <div className="text-xs font-bold text-slate-700">
                この案件の発行済み仕様書がまだ台帳に登録されていません
              </div>
              <p className="text-[11px] text-slate-500">
                「仕様書作成 (初版)」タブで仕様書を「確定」するか、上部の「既存台帳読込」から他担当者の発行台帳JSONを読み込んでください。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {filteredLedgerRecords.map((rec) => {
                const isActive = rec.id === activeRecordId;
                const isConfirmDelete = deleteConfirmRecordId === rec.id;
                return (
                  <div
                    key={rec.id}
                    onClick={() => handleSelectLedgerRecord(rec)}
                    className={`p-3 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isActive
                        ? 'bg-rose-50/90 border-rose-400 ring-1 ring-rose-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/20'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-mono font-bold text-sm text-slate-900 truncate">
                          {rec.title}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          rec.currentRevision === 0
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-rose-600 text-white'
                        }`}>
                          現在 Rev.{rec.currentRevision}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-indigo-700 truncate">
                        仕様書番号: {rec.docNo || '-'}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        {rec.itemNames.join(' / ')} ({rec.orderedItemIds.length}点)
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 space-y-1 text-[10px] text-slate-400">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-600" title={rec.templateName}>
                          {rec.templateName}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono">{rec.updatedAt.slice(0, 10)}</span>
                          {onDeleteLedgerRecord && !isConfirmDelete && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmRecordId(rec.id);
                              }}
                              className="p-0.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              title="台帳から削除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                          {isConfirmDelete && onDeleteLedgerRecord && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteLedgerRecord(rec.id);
                                setDeleteConfirmRecordId(null);
                                if (activeRecordId === rec.id) {
                                  setActiveRecordId('');
                                  setLoadedSnapshot(null);
                                }
                              }}
                              className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              削除確定
                            </button>
                          )}
                        </div>
                      </div>
                      {(rec.templateExcelFileName || rec.templateMappingFileName) && (
                        <div className="font-mono text-[10px] text-slate-400 truncate" title={`雛形: ${rec.templateExcelFileName || '-'} / JSON: ${rec.templateMappingFileName || '-'}`}>
                          {rec.templateExcelFileName ? `Excel: ${rec.templateExcelFileName}` : ''}
                          {rec.templateExcelFileName && rec.templateMappingFileName ? ' · ' : ''}
                          {rec.templateMappingFileName ? `JSON: ${rec.templateMappingFileName}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-detected Equipment DB diff alert bar */}
          {activeLedgerRecord && equipmentDbPendingDiff.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-start gap-2 text-amber-950">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    機器データベースの更新を検出しました（前版 Rev.{activeLedgerRecord.currentRevision} との差分セル: {equipmentDbPendingDiff.join(', ')}）
                  </span>
                  <p className="text-[11px] text-amber-800">
                    右のボタンを押すと最新機器データを再転記し、変更されたセルを自動的に赤文字・赤枠にセットします。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTriggerReTransfer}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>最新機器データを反映＆差分自動抽出</span>
              </button>
            </div>
          )}
        </div>
      )}

      {exportNotice && (
        <div className="bg-emerald-600 text-white text-xs py-2 px-4 rounded-lg shadow-xs flex items-center justify-between animate-in fade-in">
          <span>{exportNotice}</span>
          <button onClick={() => setExportNotice('')} className="text-white hover:text-emerald-200 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left = Forms & History, Right = Live Excel Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. Template Selector Card (Compact Scrollable Selector) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                  仕様書テンプレートの選択
                </span>
                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                  ({templates.length}件)
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {templateFolderState?.needsPermission && onReconnectTemplateFolder ? (
                  <button
                    type="button"
                    onClick={onReconnectTemplateFolder}
                    className="text-[10px] font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>フォルダ再接続</span>
                  </button>
                ) : templateFolderState?.folderName ? (
                  <span
                    className="text-[10px] font-mono text-slate-500 flex items-center gap-1 max-w-[140px] truncate"
                    title={`参照元フォルダ: ${templateFolderState.folderName}`}
                  >
                    <FolderOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span className="truncate">{templateFolderState.folderName}</span>
                  </span>
                ) : (
                  onOpenAdminMapping && (
                    <button
                      type="button"
                      onClick={() => onOpenAdminMapping(selectedTemplateId)}
                      className="text-[10px] font-medium text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>設定管理でフォルダ登録</span>
                    </button>
                  )
                )}

                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                  台帳: <strong className="text-slate-900">{ledgerTitlePreview}</strong>
                </span>
              </div>
            </div>

            {templates.length > 5 && (
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="テンプレート名・ファイル名で絞込..."
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-md pl-7 pr-2 py-1 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            )}

            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
              {templates.length === 0 ? (
                <div className="p-3 text-xs text-slate-500 text-center">
                  テンプレート未登録（「設定管理」から参照元フォルダを選択または作成）
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-2.5 text-[11px] text-slate-400 text-center">
                  条件に一致するテンプレートがありません
                </div>
              ) : (
                filteredTemplates.map((t) => {
                  const isActive = t.id === (activeTemplate?.id || selectedTemplateId);
                  const isFolder = t.sourceLocation === 'folder';
                  const statusLabel = isFolder
                    ? t.hasPairedMappingFile
                      ? 'フォルダ・連携済'
                      : 'フォルダ・未設定'
                    : '内蔵';
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(t.id);
                        setSelectedSheetOverride('');
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50/90 text-indigo-950 font-semibold'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isActive ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                        />
                        <span className="truncate">{t.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono shrink-0 whitespace-nowrap ${
                          isFolder
                            ? t.hasPairedMappingFile
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {activeTemplate &&
              (activeTemplate.sourceLocation === 'folder' ||
                activeTemplate.excelFileName ||
                activeTemplate.mappingFileName) && (
                <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between gap-2 px-0.5 truncate">
                  <span className="truncate">
                    雛形: {activeTemplate.excelFileName || activeTemplate.masterFileName || activeTemplate.originalFileName || '-'}
                  </span>
                  <span className="truncate text-right shrink-0 max-w-[50%]">
                    マッピング: {activeTemplate.mappingFileName || '未設定 (既定値)'}
                  </span>
                </div>
              )}
          </div>

          {/* 2. 基本情報 Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>📋 基本情報</span>
              </h2>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-medium">
                案件サマリー一律反映
              </span>
            </div>

            <div className="text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">オーダーNo. (共通):</span>
                <span className="font-mono font-bold text-slate-900">{currentProject?.orderNo || currentProject?.code || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">案件名 (共通):</span>
                <span className="font-bold text-slate-900 truncate max-w-xs">{currentProject?.name}</span>
              </div>
              {currentProject?.clientName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">客先名 / 発注者:</span>
                  <span className="text-slate-800 font-medium">{currentProject.clientName}</span>
                </div>
              )}
              {currentProject?.code && currentProject.code !== (currentProject.orderNo || '') && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">客先コード:</span>
                  <span className="font-mono font-bold text-slate-800">{currentProject.code}</span>
                </div>
              )}
              {currentProject?.location && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">工事場所:</span>
                  <span className="text-slate-800 truncate max-w-xs">{currentProject.location}</span>
                </div>
              )}
            </div>

            {/* 仕様書番号 */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>仕様書番号</span>
                  <span
                    className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded cursor-pointer hover:bg-indigo-100 hover:text-indigo-700"
                    onClick={() => setSelectedCellAddress((docNoField?.cell || 'C4').toUpperCase())}
                    title="Excelセルへジャンプ"
                  >
                    {docNoField?.cell || 'C4'}
                  </span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">客先コード・機器番号連動</span>
              </div>
              <input
                type="text"
                value={formValues['f-docno'] || fixedDocNo}
                onFocus={() => {
                  setFocusedFieldId('f-docno');
                  setSelectedCellAddress((docNoField?.cell || 'C4').toUpperCase());
                }}
                onChange={(e) => handleFieldChange('f-docno', e.target.value)}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded px-2.5 py-1.5 text-indigo-900 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* 仕様書発行日 */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>仕様書発行日</span>
                  {issueDateField?.cell && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCellAddress(issueDateField.cell.toUpperCase());
                        setFocusedFieldId(issueDateField.id);
                      }}
                      className="font-mono text-[9px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer shadow-2xs"
                    >
                      {issueDateField.cell}
                    </button>
                  )}
                </label>
              </div>
              <input
                type="date"
                value={formValues[issueDateField?.id || 'f-date'] || todayStr}
                onFocus={() => {
                  if (issueDateField) {
                    setFocusedFieldId(issueDateField.id);
                    if (issueDateField.cell) setSelectedCellAddress(issueDateField.cell.toUpperCase());
                  }
                }}
                onChange={(e) => handleFieldChange(issueDateField?.id || 'f-date', e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:border-indigo-500 focus:outline-hidden shadow-2xs"
              />
            </div>
          </div>

          {/* 2.5. 履歴管理枠 (改訂版モードのみ表示：基本情報の直下に配置) */}
          {mode === 'revision' && (
          <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-rose-600" />
                <span>履歴管理（リビジョン ＆ 変更セル赤枠指定）</span>
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                selectedRevision === 0
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-rose-600 text-white'
              }`}>
                選択中: Rev.{selectedRevision}
              </span>
            </div>

            {/* Revision Selector: Rev.0 / Rev.1 / Rev.2 / Rev.3 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 block">
                出力リビジョン選択
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {([0, 1, 2, 3] as RevisionNumber[]).map((rev) => {
                  const isActive = selectedRevision === rev;
                  return (
                    <button
                      key={rev}
                      type="button"
                      onClick={() => setSelectedRevision(rev)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                        isActive
                          ? rev === 0
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {rev === 0 ? 'Rev.0 (初版)' : `Rev.${rev}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Revision History Table Entries */}
            {selectedRevision === 0 ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                ※ リビジョン0（初版）のため、Excelの変更履歴欄には入力されません。
              </div>
            ) : (
              <div className="space-y-2.5">
                {revisionMappingsMissing && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-[11px] text-amber-900">
                    <span>Rev.{selectedRevision} の変更履歴セルがテンプレートに未マッピングです。</span>
                    {onOpenAdminMapping && (
                      <button
                        type="button"
                        onClick={() => onOpenAdminMapping(selectedTemplateId)}
                        className="font-bold underline text-amber-950 hover:text-indigo-700 shrink-0 cursor-pointer"
                      >
                        基本情報マッピングで設定 →
                      </button>
                    )}
                  </div>
                )}

                {([1, 2, 3] as const)
                  .filter((revNum) => revNum <= selectedRevision)
                  .map((revNum) => {
                    const entry = revEntries[revNum];
                    const isCurrentRev = revNum === selectedRevision;
                    return (
                      <div
                        key={revNum}
                        className={`p-3 rounded-lg border space-y-2 text-xs ${
                          isCurrentRev
                            ? 'bg-rose-50/60 border-rose-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-mono font-bold ${
                            isCurrentRev ? 'text-rose-800' : 'text-slate-600'
                          }`}>
                            {revNum}段目：Rev.{revNum} {isCurrentRev ? '（今回の改訂）' : '（過去の改訂）'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {REVISION_FIELD_DEFS.filter((d) => d.revision === revNum)
                              .map((d) => activeTemplate?.fields?.find((f) => f.id === d.id)?.cell || '-')
                              .join(' / ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              リビジョン番号
                            </label>
                            <input
                              type="text"
                              value={entry.revisionLabel}
                              onChange={(e) => handleUpdateRevEntry(revNum, { revisionLabel: e.target.value })}
                              placeholder={`Rev${revNum}`}
                              className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded px-2 py-1 focus:border-rose-500 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              改訂日
                            </label>
                            <input
                              type="date"
                              value={entry.revDate}
                              onChange={(e) => handleUpdateRevEntry(revNum, { revDate: e.target.value })}
                              className="w-full text-xs bg-white border border-slate-300 rounded px-1.5 py-1 focus:border-rose-500 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              改訂者
                            </label>
                            <input
                              type="text"
                              value={entry.revAuthor}
                              onChange={(e) => handleUpdateRevEntry(revNum, { revAuthor: e.target.value })}
                              placeholder="例: 山田"
                              className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:border-rose-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                            変更内容
                          </label>
                          <input
                            type="text"
                            value={entry.revSummary}
                            onChange={(e) => handleUpdateRevEntry(revNum, { revSummary: e.target.value })}
                            placeholder="例: 口径・納入時期および検査要否を見直し"
                            className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1 focus:border-rose-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Changed Cells (Red Text + Red Border) Area */}
            <div className="pt-2 border-t border-rose-100 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs border-2 border-red-600 bg-red-50 inline-block" />
                  <span>変更箇所セル指定（赤文字・赤枠）</span>
                </label>

                {loadedSnapshot && (
                  <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoTrackDiff}
                      onChange={(e) => setAutoTrackDiff(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>前版から値が変わったセルを自動追加</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={cellInputText}
                  onChange={(e) => setCellInputText(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChangedCellsFromInput();
                    }
                  }}
                  placeholder="セル番地を入力 (例: C8, D15, E15)"
                  className="flex-1 text-xs font-mono bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-red-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddChangedCellsFromInput}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  追加
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleChangedCell(selectedCellAddress)}
                  disabled={!selectedCellAddress}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${
                    changedCells.includes(selectedCellAddress)
                      ? 'bg-red-50 border-red-400 text-red-700 hover:bg-red-100'
                      : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {changedCells.includes(selectedCellAddress)
                    ? `✓ 選択セル (${selectedCellAddress}) の赤枠を解除`
                    : `＋ 選択セル (${selectedCellAddress}) を赤字・赤枠に追加`}
                </button>

                {changedCells.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearChangedCells}
                    className="text-[11px] text-slate-500 hover:text-red-600 underline cursor-pointer"
                  >
                    すべて解除 ({changedCells.length})
                  </button>
                )}
              </div>

              {changedCells.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {changedCells.map((addr) => (
                    <span
                      key={addr}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-400 text-red-700 font-mono text-[11px] font-bold"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCellAddress(addr)}
                        className="hover:underline cursor-pointer"
                        title="プレビューでセルを選択"
                      >
                        {addr}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleChangedCell(addr)}
                        className="text-red-500 hover:text-red-800 cursor-pointer"
                        title="赤枠指定を解除"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400">
                  ※直近の版で指定されたセルのみが赤文字・赤枠になります（過去の版の赤枠は黒字・通常枠に戻ります）。
                </p>
              )}
            </div>
          </div>
          )}

          {/* 3. Equipment Selection & Automatic Spec Transfer Card */}
          <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
              <div>
                <h2 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span>対象機器の選択 ＆ 仕様項目の自動転記</span>
                </h2>
                <p className="text-[10px] text-slate-500">
                  選択した機器の仕様パラメータが、項目ラベルと一致するセルマッピングへ自動転記されます。
                </p>
              </div>

              <button
                type="button"
                onClick={handleTriggerReTransfer}
                className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                title="機器の仕様項目からフォームへ再転記"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{mode === 'revision' ? '機器から再転記・差分抽出' : '機器から再転記'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>仕様書に含める機器 ({activeItems.length}件):</span>
                <span className="text-[10px] text-slate-400">主仕様（転記元）をラジオで選択</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {orderedActiveItems.map((it, idx) => {
                  const isPrimary = it.id === primaryItem?.id;
                  const slotLabel = idx === 0 ? '1種類目 (主仕様)' : `${idx + 1}種類目`;
                  return (
                    <div
                      key={it.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                        isPrimary ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            idx === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {slotLabel}
                        </span>

                        <button
                          type="button"
                          onClick={() => setPrimaryItemId(it.id)}
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer ${
                            isPrimary ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                          title={isPrimary ? '主仕様（転記元）として選択中' : 'この機器を主仕様（1種類目）に設定'}
                        >
                          {isPrimary && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </button>

                        {it.equipmentType && (
                          <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1 py-0.2 rounded shrink-0">
                            {it.equipmentType.toUpperCase()}
                          </span>
                        )}

                        <span className="font-mono font-bold text-slate-800 shrink-0">[{it.tagNo || '未割当'}]</span>
                        <span className="font-semibold text-slate-900 truncate">{it.name}</span>
                        <span className="text-[11px] text-slate-500 shrink-0 font-mono">
                          ({it.quantity} {it.unit || '台'})
                        </span>
                      </div>

                      {activeItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipment(it.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors ml-1 cursor-pointer shrink-0"
                          title="この機器を仕様書から除外"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {unselectedItems.length > 0 && (
                <div className="pt-2 flex items-center gap-1.5">
                  <select
                    value={itemToAddId}
                    onChange={(e) => setItemToAddId(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">＋ 追加する機器を選択...</option>
                    {unselectedItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        [{it.tagNo || '未割当'}] {it.name} ({it.quantity} {it.unit || '台'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddEquipment}
                    disabled={!itemToAddId}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                  >
                    <span>＋ 機器を追加</span>
                  </button>
                </div>
              )}
            </div>

            {primaryItem && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>主仕様機器「{primaryItem.name}」の登録仕様一覧:</span>
                  <span className="font-mono text-indigo-600 font-bold">{primaryItem.tagNo || '-'}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {primaryItem.specs && primaryItem.specs.length > 0 ? (
                    primaryItem.specs.map((spec) => (
                      <span
                        key={spec.id}
                        className="inline-flex items-center gap-1 bg-white border border-indigo-200 px-2 py-1 rounded text-[11px] font-mono shadow-2xs"
                      >
                        <span className="text-slate-500 font-sans">{spec.name}:</span>
                        <span className="font-bold text-indigo-900">{spec.value}</span>
                        {spec.unit && <span className="text-slate-500 text-[10px]">{spec.unit}</span>}
                      </span>
                    ))
                  ) : (
                    <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                      {primaryItem.diameter && primaryItem.diameter !== '-' && (
                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">口径: {primaryItem.diameter}</span>
                      )}
                      {primaryItem.material && primaryItem.material !== '-' && (
                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">材質: {primaryItem.material}</span>
                      )}
                    </div>
                  )}

                  {primaryItem.deliveryDate && (
                    <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded text-[11px] font-mono">
                      <span className="text-slate-500 font-sans">納期:</span>
                      <span className="font-semibold text-slate-800">{primaryItem.deliveryDate}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. 仕様・受渡条件 */}
          {specFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span>⚙️ 仕様・受渡条件 (プルダウン選択)</span>
              </h2>
              <div className="space-y-3">
                {specFields.map((field) => {
                  const transferTag = transferredFieldsMap[field.id];
                  const isSelected = focusedFieldId === field.id || selectedCellMappedField?.id === field.id;
                  return (
                    <div
                      key={field.id}
                      className={`space-y-1 p-2 rounded-lg transition-colors border ${
                        isSelected ? 'bg-indigo-50/60 border-indigo-300 shadow-2xs' : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                          <span>{field.label}</span>
                          {field.cell && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCellAddress(field.cell.toUpperCase());
                                setFocusedFieldId(field.id);
                              }}
                              className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer"
                            >
                              {field.cell}
                            </button>
                          )}
                        </label>
                        {transferTag && (
                          <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-sans truncate max-w-[170px]" title={transferTag}>
                            ✓ {transferTag}
                          </span>
                        )}
                      </div>
                      {field.options && field.options.length > 0 ? (
                        <select
                          value={formValues[field.id] ?? ''}
                          onFocus={() => {
                            setFocusedFieldId(field.id);
                            if (field.cell) setSelectedCellAddress(field.cell.toUpperCase());
                          }}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden cursor-pointer"
                        >
                          {field.options.map((opt, idx) => (
                            <option key={idx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={formValues[field.id] ?? ''}
                          onFocus={() => {
                            setFocusedFieldId(field.id);
                            if (field.cell) setSelectedCellAddress(field.cell.toUpperCase());
                          }}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                        />
                      )}
                      {field.description && <p className="text-[10px] text-slate-400">{field.description}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. チェック形式の適用要件 */}
          {checkFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>✅ 適用要件・検査基準 (チェック形式)</span>
                </h2>
                <span className="text-[10px] text-slate-400">クリックで要/不要を切替</span>
              </div>
              <div className="space-y-2">
                {checkFields.map((field) => {
                  const isChecked = Boolean(formValues[field.id]);
                  const cfg = field.checkboxConfig;
                  const isSelected = focusedFieldId === field.id || selectedCellMappedField?.id === field.id;
                  return (
                    <div
                      key={field.id}
                      onClick={() => {
                        handleFieldChange(field.id, !isChecked);
                        setFocusedFieldId(field.id);
                        if (field.cell) setSelectedCellAddress(field.cell.toUpperCase());
                      }}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                        isSelected
                          ? 'ring-2 ring-indigo-500 bg-indigo-50/80 border-indigo-400'
                          : isChecked
                          ? 'bg-indigo-50/50 border-indigo-200 text-slate-900 shadow-2xs'
                          : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <button type="button" className="mt-0.5 text-indigo-600 shrink-0">
                        {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <span>{field.label}</span>
                            {field.cell && (
                              <span className="font-mono text-[9px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded">
                                {field.cell}
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isChecked ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isChecked ? cfg?.labelTrue || '要' : cfg?.labelFalse || '不要'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          流し込み値: {isChecked ? cfg?.checkedValue || '☑ 要' : cfg?.uncheckedValue || '☐ 不要'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. 特記事項 */}
          {noteFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <h2 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>📝 特記事項・指示事項</span>
                <span
                  className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-100 hover:text-indigo-700"
                  onClick={() => setSelectedCellAddress('B23')}
                >
                  セル B23
                </span>
              </h2>
              {noteFields.map((f) => (
                <div key={f.id} className="space-y-1">
                  <textarea
                    rows={4}
                    value={formValues[f.id] ?? ''}
                    onFocus={() => {
                      setFocusedFieldId(f.id);
                      if (f.cell) setSelectedCellAddress(f.cell.toUpperCase());
                    }}
                    onChange={(e) => handleFieldChange(f.id, e.target.value)}
                    placeholder="特記事項や納入時の注意事項を入力..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden leading-relaxed font-sans"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Bottom Confirm & Export CTA */}
          <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md flex items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>
                  {mode === 'revision'
                    ? `Rev.${selectedRevision} 確定（${ledgerTitlePreview}）`
                    : `初版確定（${ledgerTitlePreview}）`}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {mode === 'revision'
                  ? '変更履歴と赤枠設定を反映してExcel出力し、台帳へ保存します'
                  : '仕様内容を確定してExcel出力し、発行台帳JSONへ初版登録します'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirmAndExportExcel}
              disabled={isExporting || orderedActiveItems.length === 0}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? '処理中...' : '確定してExcel出力'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Excel Spreadsheet Live View (7 cols, sticky) */}
        <div className="lg:col-span-7 space-y-3 lg:sticky lg:top-[68px] lg:self-start">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-slate-900">仕様書プレビュー</h2>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      selectedRevision === 0 ? 'bg-slate-100 text-slate-700' : 'bg-rose-100 text-rose-800'
                    }`}>
                      Rev.{selectedRevision}
                    </span>
                    {mode === 'revision' && changedCells.length > 0 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-red-50 text-red-700 border border-red-300">
                        赤枠指定: {changedCells.length}セル
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {mode === 'revision'
                      ? 'Excel原本スプレッドシート（セル直接クリック・数式バー編集・赤枠指定・列幅調整対応）'
                      : 'Excel原本スプレッドシート（セル直接クリック・数式バー編集・列幅調整対応）'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={handleReloadPreview}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGridRendering ? 'animate-spin' : ''}`} />
                  <span>再読み込み</span>
                </button>
              </div>
            </div>

            {/* Excel Formula Bar */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-1.5 flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 font-mono font-bold bg-white border border-slate-300 px-2 py-1 rounded text-slate-800 shrink-0 shadow-2xs">
                <span className="text-indigo-600">セル:</span>
                <span className="text-slate-900">{selectedCellAddress}</span>
              </div>
              <span className="font-mono text-slate-400 font-bold px-1 select-none text-xs">fx</span>
              <input
                type="text"
                value={currentFormulaValue}
                onChange={(e) => handleFormulaChange(e.target.value)}
                placeholder={
                  selectedCellMappingInfo
                    ? `【${selectedCellMappingInfo.label}】の値を直接編集...`
                    : '選択したセルの値を直接入力・書き換え...'
                }
                className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 font-medium focus:outline-hidden focus:border-indigo-500 shadow-2xs"
              />
              {mode === 'revision' && (
                <button
                  type="button"
                  onClick={() => handleToggleChangedCell(selectedCellAddress)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border shrink-0 cursor-pointer transition-colors ${
                    changedCells.includes(selectedCellAddress)
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                  }`}
                  title="このセルを赤文字・赤枠ハイライトの対象に追加/解除"
                >
                  {changedCells.includes(selectedCellAddress) ? '赤枠中 ✓' : '赤枠指定'}
                </button>
              )}
            </div>
          </div>

          {/* Excel Original Live Grid */}
          <div className="space-y-2 pb-4">
            <div className="bg-white border border-slate-300 shadow-md rounded-xl overflow-hidden transition-all select-none">
              <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {excelGridData?.availableSheets && excelGridData.availableSheets.length > 0 ? (
                    excelGridData.availableSheets.map((s) => {
                      const isActive = (selectedSheetOverride || excelGridData.sheetName) === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSheetOverride(s)}
                          className={`px-3 py-1.5 font-bold text-xs transition-colors rounded-t-lg border-t-2 border-x cursor-pointer ${
                            isActive
                              ? 'bg-white border-t-emerald-600 border-x-slate-300 text-slate-900 shadow-2xs'
                              : 'bg-slate-200/70 border-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })
                  ) : (
                    <span className="bg-white border-t-2 border-emerald-600 border-x border-slate-300 px-3 py-1.5 font-bold text-slate-900 shadow-2xs rounded-t-lg">
                      {excelGridData?.sheetName || '仕様書'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap justify-end">
                  {Object.keys(cellOverrides).length > 0 && (
                    <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] text-amber-800 shadow-2xs">
                      <Edit3 className="w-3 h-3 text-amber-600" />
                      <span className="font-semibold">セル書き換え: {Object.keys(cellOverrides).length}件</span>
                      <button
                        type="button"
                        onClick={() => setCellOverrides({})}
                        className="ml-1 text-[10px] text-amber-900 underline hover:text-amber-700 cursor-pointer font-bold"
                      >
                        リセット
                      </button>
                    </div>
                  )}

                  {Object.keys(customColWidths).length > 0 && (
                    <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] text-indigo-800 shadow-2xs">
                      <span className="font-semibold">列幅調整: {Object.keys(customColWidths).length}列</span>
                      <button
                        type="button"
                        onClick={() => setCustomColWidths({})}
                        className="ml-1 text-[10px] text-indigo-900 underline hover:text-indigo-700 cursor-pointer font-bold"
                      >
                        リセット
                      </button>
                    </div>
                  )}

                  <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.max(40, z - 10))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 font-mono text-[11px] font-bold text-slate-800 select-none min-w-[44px] text-center">
                      {previewZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.min(200, z + 10))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewZoom(100)}
                    className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                  >
                    リセット
                  </button>
                </div>
              </div>

              <div
                className="overflow-auto max-h-[min(720px,calc(100vh-280px))] min-h-[360px] bg-slate-200/60 p-3 sm:p-5"
                onWheel={(e) => {
                  if (e.ctrlKey) {
                    e.preventDefault();
                    if (e.deltaY < 0) setPreviewZoom((z) => Math.min(200, z + 10));
                    else setPreviewZoom((z) => Math.max(40, z - 10));
                  }
                }}
                title="Ctrl + マウスホイールで拡大縮小"
              >
                <div
                  style={{
                    zoom: previewZoom !== 100 ? previewZoom / 100 : undefined,
                    transform:
                      typeof (document?.body?.style as any)?.zoom === 'undefined' && previewZoom !== 100
                        ? `scale(${previewZoom / 100})`
                        : undefined,
                    transformOrigin: 'top left',
                    width: `${totalColWidth + 42}px`,
                    minWidth: `${totalColWidth + 42}px`,
                    margin: '0 auto',
                  }}
                  className="bg-white shadow-xl rounded-xs border border-slate-300"
                >
                  <table
                    className="border-collapse text-slate-900 bg-white"
                    style={{
                      width: `${totalColWidth + 42}px`,
                      minWidth: `${totalColWidth + 42}px`,
                      tableLayout: 'fixed',
                    }}
                  >
                    <colgroup>
                      <col style={{ width: '42px', minWidth: '42px' }} />
                      {excelGridData?.columns.map((col) => (
                        <col key={col.colLetter} style={{ width: `${col.width}px`, minWidth: `${col.width}px` }} />
                      ))}
                    </colgroup>
                    <thead className="bg-slate-200 text-slate-700 font-mono text-[11px] font-semibold sticky top-0 z-20 shadow-2xs select-none">
                      <tr style={{ height: '26px' }}>
                        <th className="w-[42px] p-0 text-center border-r border-b border-slate-300 bg-slate-300/90 text-[10px] sticky left-0 z-30 select-none">
                          #
                        </th>
                        {excelGridData?.columns.map((col) => (
                          <th
                            key={col.colLetter}
                            style={{ width: `${col.width}px` }}
                            className="p-1 text-center border-r border-b border-slate-300 text-[11px] bg-slate-200 relative group select-none"
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              <span>{col.colLetter}</span>
                              {customColWidths[col.colLetter] && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                              )}
                            </div>
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500 active:bg-indigo-700 z-30 select-none opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-400/40"
                              onMouseDown={(e) => handleStartColResize(col.colLetter, col.width, e)}
                              onDoubleClick={() => handleResetSingleColWidth(col.colLetter)}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelGridData?.rows.map((row) => (
                        <tr key={row.rowNumber} style={{ height: row.height ? `${row.height}px` : '20px' }}>
                          <td className="bg-slate-100/95 text-slate-500 font-mono text-[10px] text-center p-0 border-r border-b border-slate-300 sticky left-0 z-10 select-none font-semibold">
                            {row.rowNumber}
                          </td>
                          {row.cells.map((cell) => {
                            if (cell.isMergedChild) return null;
                            const isSelected = cell.address === selectedCellAddress;
                            const isMapped = Boolean(cell.isMapped || cell.mappedFieldId);
                            const isOverridden = cellOverrides[cell.address] !== undefined;
                            const isInlineEditing = inlineEditingCell === cell.address;
                            const isRedHighlight = Boolean(cell.isChangedHighlight);

                            return (
                              <td
                                key={cell.address}
                                colSpan={cell.colSpan || 1}
                                rowSpan={cell.rowSpan || 1}
                                onClick={() => {
                                  setSelectedCellAddress(cell.address);
                                  if (cell.mappedFieldId) setFocusedFieldId(cell.mappedFieldId);
                                }}
                                onDoubleClick={() => handleStartInlineEdit(cell)}
                                title={`セル ${cell.address}${cell.mappedFieldLabel ? ` (連動: ${cell.mappedFieldLabel})` : ''}${isRedHighlight ? ' [変更箇所・赤枠]' : ''} - ダブルクリックで直接書き換え`}
                                style={{
                                  backgroundColor: isSelected
                                    ? '#EEF2FF'
                                    : isRedHighlight
                                    ? '#FEF2F2'
                                    : cell.bgColor || undefined,
                                  textAlign: cell.align || 'left',
                                  verticalAlign: cell.verticalAlign || 'middle',
                                  color: isRedHighlight ? '#DC2626' : cell.fontColor || '#0f172a',
                                  fontWeight: isRedHighlight || cell.isBold ? 700 : 400,
                                  fontSize: cell.fontSize ? `${Math.max(8.5, Math.min(cell.fontSize, 16))}px` : '10px',
                                  fontFamily: cell.fontFamily ? `"${cell.fontFamily}", "Meiryo", sans-serif` : undefined,
                                  borderTop: isRedHighlight
                                    ? '2px solid #DC2626'
                                    : cell.borderTopStyle || (cell.borderTop ? '1px solid #475569' : '1px solid #e2e8f0'),
                                  borderBottom: isRedHighlight
                                    ? '2px solid #DC2626'
                                    : cell.borderBottomStyle || (cell.borderBottom ? '1px solid #475569' : '1px solid #e2e8f0'),
                                  borderLeft: isRedHighlight
                                    ? '2px solid #DC2626'
                                    : cell.borderLeftStyle || (cell.borderLeft ? '1px solid #475569' : '1px solid #e2e8f0'),
                                  borderRight: isRedHighlight
                                    ? '2px solid #DC2626'
                                    : cell.borderRightStyle || (cell.borderRight ? '1px solid #475569' : '1px solid #e2e8f0'),
                                  outline: isRedHighlight ? '2px solid #DC2626' : undefined,
                                  outlineOffset: isRedHighlight ? '-2px' : undefined,
                                  padding: isInlineEditing ? '0px' : '2px 4px',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.25,
                                  whiteSpace: 'pre-wrap',
                                  overflow: 'hidden',
                                  position: isRedHighlight ? 'relative' : undefined,
                                  zIndex: isRedHighlight ? 5 : undefined,
                                }}
                                className={`transition-colors cursor-cell select-text ${
                                  isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/70 z-10 font-bold shadow-xs' : ''
                                } ${isMapped && !isSelected ? 'hover:bg-indigo-50/40' : 'hover:bg-slate-50'}`}
                              >
                                {isInlineEditing ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={inlineEditingValue}
                                    onChange={(e) => setInlineEditingValue(e.target.value)}
                                    onBlur={() => handleCommitInlineEdit(cell.address, inlineEditingValue)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCommitInlineEdit(cell.address, inlineEditingValue);
                                      else if (e.key === 'Escape') setInlineEditingCell(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full h-full bg-white text-slate-900 border-2 border-indigo-600 rounded-xs px-1 text-xs font-semibold focus:outline-hidden ring-2 ring-indigo-300 shadow-md"
                                    style={{ minHeight: '22px' }}
                                  />
                                ) : (
                                  <div className="flex items-center justify-between gap-1 w-full h-full">
                                    <span className="w-full">{cell.value || ''}</span>
                                    {isOverridden && (
                                      <span
                                        className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 opacity-90 ml-0.5"
                                        title="直接書き換え済みセル"
                                      />
                                    )}
                                    {isMapped && !isOverridden && !isRedHighlight && (
                                      <span
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 opacity-70 ml-0.5"
                                        title={`マッピング連動: ${cell.mappedFieldLabel || ''}`}
                                      />
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>
                    {mode === 'revision'
                      ? '💡 セルWクリック・数式バーで直接編集 / 赤枠指定で改訂箇所を赤文字・赤枠化'
                      : '💡 セルWクリック・数式バーで直接編集できます'}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-indigo-700 font-semibold">選択セル: {selectedCellAddress || '-'}</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-600 font-semibold">倍率: {previewZoom}%</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-emerald-700 font-semibold">Rev.{selectedRevision} Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
