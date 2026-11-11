import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Tag,
  FileSpreadsheet,
  FileCheck2,
  Eye,
  Layers,
  ChevronDown
} from 'lucide-react';
import { EquipmentItem, SpecTemplate, Category, SpecFieldMapping, ProjectWorkspace } from '../types';
import { downloadSpecificationExcel, renderSpecificationExcelGrid, RenderedSheetGrid } from '../utils/exceljsEngine';
import { convertElementToPdfBlob } from '../utils/pdfGenerator';

interface SpecDashboardTabProps {
  items: EquipmentItem[];
  categories: Category[];
  templates: SpecTemplate[];
  activeProjectId: string;
  currentProject?: ProjectWorkspace;
  onOpenAdminMapping?: (templateId: string) => void;
  onUpdateTemplates?: (templates: SpecTemplate[]) => void;
}

export const SpecDashboardTab: React.FC<SpecDashboardTabProps> = ({
  items,
  categories,
  templates,
  activeProjectId,
  currentProject,
  onOpenAdminMapping,
  onUpdateTemplates,
}) => {
  const projectItems = useMemo(() => items.filter(it => it.projectId === activeProjectId), [items, activeProjectId]);

  // Selected Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Selected Equipment Items to include in the specification
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  // Primary focused equipment for specification transfers
  const [primaryItemId, setPrimaryItemId] = useState<string>('');
  // Item selection for adding multiple equipment
  const [itemToAddId, setItemToAddId] = useState<string>('');

  useEffect(() => {
    if (projectItems.length > 0) {
      if (selectedItemIds.length === 0) {
        setSelectedItemIds([projectItems[0].id]);
        setPrimaryItemId(projectItems[0].id);
      } else {
        const validIds = selectedItemIds.filter(id => projectItems.some(it => it.id === id));
        if (validIds.length === 0) {
          setSelectedItemIds([projectItems[0].id]);
          setPrimaryItemId(projectItems[0].id);
        } else if (!validIds.includes(primaryItemId)) {
          setPrimaryItemId(validIds[0]);
        }
      }
    }
  }, [projectItems]);

  const activeItems = useMemo(() => {
    return projectItems.filter(it => selectedItemIds.includes(it.id));
  }, [projectItems, selectedItemIds]);

  const unselectedItems = useMemo(() => {
    return projectItems.filter(it => !selectedItemIds.includes(it.id));
  }, [projectItems, selectedItemIds]);

  const primaryItem = useMemo(() => {
    return projectItems.find(it => it.id === primaryItemId) || activeItems[0] || projectItems[0];
  }, [projectItems, primaryItemId, activeItems]);

  const handleAddEquipment = () => {
    if (!itemToAddId) return;
    setSelectedItemIds(prev => [...prev, itemToAddId]);
    setItemToAddId('');
  };

  const handleRemoveEquipment = (idToRemove: string) => {
    setSelectedItemIds(prev => prev.filter(id => id !== idToRemove));
    if (primaryItemId === idToRemove) {
      const remaining = selectedItemIds.filter(id => id !== idToRemove);
      if (remaining.length > 0) {
        setPrimaryItemId(remaining[0]);
      }
    }
  };

  // Form Values State (Keyed by field.id)
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [transferredFieldsMap, setTransferredFieldsMap] = useState<Record<string, string>>({});

  // Direct In-memory ExcelJS live rendering state
  const [excelGridData, setExcelGridData] = useState<RenderedSheetGrid | null>(null);
  const [isGridRendering, setIsGridRendering] = useState<boolean>(false);
  const [renderCounter, setRenderCounter] = useState<number>(0);

  // Selected cell & interactive formula bar state
  const [selectedCellAddress, setSelectedCellAddress] = useState<string>('B2');
  const [selectedSheetOverride, setSelectedSheetOverride] = useState<string>('');
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  // PDF Preview State & Offscreen A4 Reference
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<'pdf' | 'excel'>('pdf');
  const [pdfNotice, setPdfNotice] = useState<string>('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const specSheetRef = useRef<HTMLDivElement | null>(null);

  // Auto-calculated document number: 案件コードの後にハイフン入れず機器種別の2文字+G、ハイフン+機器番号
  const fixedDocNo = useMemo(() => {
    const prjCode = currentProject?.code || 'PRJ-2026-01';
    const typeCode = (primaryItem?.equipmentType || 'VA').trim().toUpperCase();
    const tag = primaryItem?.tagNo || 'V-101';
    return `${prjCode}${typeCode}G-${tag}`;
  }, [currentProject?.code, primaryItem?.equipmentType, primaryItem?.tagNo]);

  // Helper to transfer equipment specs into mapped template fields
  const transferSpecsFromEquipment = useCallback((item: EquipmentItem | undefined, tpl: SpecTemplate | undefined, currentVals: Record<string, any>, itemsList?: EquipmentItem[]) => {
    if (!item || !tpl) return { newVals: currentVals, matchedMap: {} };

    const newVals = { ...currentVals };
    const matched: Record<string, string> = {};

    const fields: SpecFieldMapping[] = tpl.fields || [];

    // Transfer primary equipment metadata
    for (const f of fields) {
      const labelClean = f.label.toLowerCase();

      // Project common fields take precedence from currentProject
      if (f.id === 'f-order-no' || labelClean.includes('オーダー') || labelClean.includes('注文番号') || labelClean.includes('オーダーno')) {
        if (currentProject?.orderNo) {
          newVals[f.id] = currentProject.orderNo;
          matched[f.id] = `案件共通(オーダーNo): ${currentProject.orderNo}`;
          continue;
        }
      }
      if (f.id === 'f-project-code' || labelClean.includes('工事コード') || labelClean.includes('案件コード') || labelClean.includes('工事番号')) {
        if (currentProject?.code) {
          newVals[f.id] = currentProject.code;
          matched[f.id] = `案件共通(工事コード): ${currentProject.code}`;
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
        const prjCode = currentProject?.code || 'PRJ-2026-01';
        const typeCode = (item.equipmentType || 'VA').trim().toUpperCase();
        newVals[f.id] = `${prjCode}${typeCode}G-${item.tagNo || 'V-101'}`;
        matched[f.id] = `案件・機器種別連動: ${newVals[f.id]}`;
        continue;
      }
      if (f.id === 'f-issuer' || labelClean.includes('発行元')) {
        newVals[f.id] = currentProject?.department || currentProject?.clientName || newVals[f.id] || '設計部';
        matched[f.id] = `案件共通: ${newVals[f.id]}`;
        continue;
      }
      if (f.id === 'f-client-no' || labelClean.includes('客先番号') || labelClean.includes('顧客番号') || labelClean.includes('客先コード')) {
        const clientNum = currentProject?.clientNumber || (currentProject?.clientNumberPart1 || currentProject?.clientNumberPart2 ? `【${currentProject.clientNumberPart1 || ''}】-【${currentProject.clientNumberPart2 || ''}】` : '');
        if (clientNum) {
          newVals[f.id] = clientNum;
          matched[f.id] = `案件共通(客先番号): ${clientNum}`;
          continue;
        }
      }

      // 1. Direct equipment parameter matching
      if (labelClean.includes('口径') && item.diameter && item.diameter !== '-') {
        newVals[f.id] = item.diameter;
        matched[f.id] = `機器「口径」: ${item.diameter}`;
        continue;
      }
      if (labelClean.includes('材質') && item.material && item.material !== '-') {
        newVals[f.id] = item.material;
        matched[f.id] = `機器「材質」: ${item.material}`;
        continue;
      }
      if (labelClean.includes('特記') && item.notes) {
        newVals[f.id] = item.notes;
        matched[f.id] = `機器「特記事項」から転記`;
        continue;
      }

      // 2. Dynamic specs list matching (口径, 出力, 塗装, 流量, 揚程, 耐圧, 材質...)
      if (item.specs && item.specs.length > 0) {
        for (const spec of item.specs) {
          const specNameClean = spec.name.toLowerCase();
          if (labelClean.includes(specNameClean) || specNameClean.includes(labelClean)) {
            const specValStr = `${spec.value}${spec.unit ? ' ' + spec.unit : ''}`;
            if (f.type === 'select' && f.options && f.options.length > 0) {
              const matchedOpt = f.options.find(opt => opt.includes(spec.value) || spec.value.includes(opt));
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
  }, [currentProject]);

  // Initialize or re-synchronize form values when activeTemplate or primaryItem changes
  useEffect(() => {
    if (!activeTemplate) return;
    const initialVals: Record<string, any> = {};

    const fields: SpecFieldMapping[] = activeTemplate.fields || [];
    for (const f of fields) {
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

    // Apply auto-transfer from primary equipment & common project
    const { newVals, matchedMap } = transferSpecsFromEquipment(primaryItem, activeTemplate, initialVals);
    setFormValues(newVals);
    setTransferredFieldsMap(matchedMap);
  }, [activeTemplate, primaryItem?.id, transferSpecsFromEquipment]);

  // Handle manual form field value change
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
    setRenderCounter(c => c + 1);
  };

  // Trigger manual spec re-transfer from equipment
  const handleTriggerReTransfer = () => {
    const { newVals, matchedMap } = transferSpecsFromEquipment(primaryItem, activeTemplate, formValues);
    setFormValues(newVals);
    setTransferredFieldsMap(matchedMap);
    setRenderCounter(c => c + 1);
  };

  // Find current selected cell object
  const selectedCell = useMemo(() => {
    if (!excelGridData || !selectedCellAddress) return null;
    for (const r of excelGridData.rows) {
      for (const c of r.cells) {
        if (c.address === selectedCellAddress) return c;
      }
    }
    return null;
  }, [excelGridData, selectedCellAddress]);

  // Find if selected cell is mapped to a form field
  const selectedCellMappedField = useMemo(() => {
    if (!selectedCell || !activeTemplate?.fields) return null;
    return activeTemplate.fields.find(f => f.cell && f.cell.trim().toUpperCase() === selectedCell.address);
  }, [selectedCell, activeTemplate]);

  // Current formula value to show in formula bar
  const currentFormulaValue = useMemo(() => {
    if (selectedCellMappedField) {
      return formValues[selectedCellMappedField.id] ?? selectedCell?.value ?? '';
    }
    return selectedCell?.value ?? '';
  }, [selectedCellMappedField, formValues, selectedCell]);

  // Total column width for proportional PDF table layout
  const totalColWidth = useMemo(() => {
    if (!excelGridData?.columns || excelGridData.columns.length === 0) return 1;
    return excelGridData.columns.reduce((sum, c) => sum + c.width, 0);
  }, [excelGridData]);

  // Handle cell edit via formula bar
  const handleFormulaChange = (newVal: string) => {
    if (selectedCellMappedField) {
      handleFieldChange(selectedCellMappedField.id, newVal);
    }
  };

  // REAL-TIME IN-MEMORY EXCELJS RENDERER EFFECT (Direct redraw)
  useEffect(() => {
    if (!activeTemplate) return;
    let isCancelled = false;
    setIsGridRendering(true);

    const docInfo: Record<string, string> = {
      title: formValues['f-title'] || activeTemplate.name,
      documentNo: formValues['f-docno'] || fixedDocNo,
      issueDate: formValues['f-date'] || new Date().toISOString().slice(0, 10),
      notes: formValues['f-notes'] || activeTemplate.notesTemplate
    };

    renderSpecificationExcelGrid(activeTemplate, formValues, activeItems, docInfo, selectedSheetOverride || undefined)
      .then(grid => {
        if (!isCancelled) {
          setExcelGridData(grid);
          setIsGridRendering(false);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          console.warn('ExcelJS in-memory render error:', err);
          setIsGridRendering(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTemplate, formValues, activeItems, fixedDocNo, renderCounter, selectedSheetOverride]);

  // Zoom
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Status for Excel export
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string>('');

  // Export filled Excel via ExcelJS (Zero Layout Break)
  const handleExportExcel = async () => {
    if (!activeTemplate) return;
    setIsExporting(true);
    setExportNotice('ExcelJSによりマスター雛形へデータを書き込み中...');

    try {
      const docInfo: Record<string, string> = {
        title: formValues['f-title'] || activeTemplate.name,
        documentNo: formValues['f-docno'] || fixedDocNo,
        issueDate: formValues['f-date'] || new Date().toISOString().slice(0, 10),
        notes: formValues['f-notes'] || activeTemplate.notesTemplate
      };

      await downloadSpecificationExcel(activeTemplate, formValues, activeItems, docInfo);
      setExportNotice('Excel出力が完了しました（書式・レイアウト完全保持）');
      setTimeout(() => setExportNotice(''), 4000);
    } catch (err: any) {
      alert(`Excel出力中にエラーが発生しました: ${err.message || '形式をご確認ください'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Reload action: Re-transfers specs, updates ExcelJS grid, and notifies user
  const handleReloadPreview = useCallback(() => {
    const { newVals, matchedMap } = transferSpecsFromEquipment(primaryItem, activeTemplate, formValues);
    setFormValues(newVals);
    setTransferredFieldsMap(matchedMap);
    setRenderCounter(c => c + 1);
    setPdfNotice('再読み込み完了: 入力情報とマッピングをプレビューに反映しました');
    setTimeout(() => setPdfNotice(''), 3000);
  }, [primaryItem, activeTemplate, formValues, transferSpecsFromEquipment]);

  // Download PDF file directly by capturing visible A4 spec sheet
  const handleDownloadPdf = async () => {
    if (!specSheetRef.current) return;
    setIsGeneratingPdf(true);
    setPdfNotice('PDF出力ファイルを生成中...');
    setIsExportMenuOpen(false);
    try {
      const res = await convertElementToPdfBlob(specSheetRef.current);
      const a = document.createElement('a');
      a.href = res.url;
      a.download = `${activeTemplate?.name || '仕様書'}_${fixedDocNo || 'SPEC'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setPdfNotice('PDF出力が完了しました');
      setTimeout(() => setPdfNotice(''), 3500);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert(`PDF生成中にエラーが発生しました: ${err.message || 'ブラウザの描画設定をご確認ください'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Group fields for clean user form presentation
  const basicFields = useMemo(() => (activeTemplate?.fields || []).filter(f => f.group === 'basic'), [activeTemplate]);
  const checkFields = useMemo(() => (activeTemplate?.fields || []).filter(f => f.type === 'checkbox' || f.group === 'check'), [activeTemplate]);
  const specFields = useMemo(() => (activeTemplate?.fields || []).filter(f => f.type === 'select' || (f.group === 'spec' && f.type !== 'checkbox')), [activeTemplate]);
  const noteFields = useMemo(() => (activeTemplate?.fields || []).filter(f => f.type === 'textarea' || f.group === 'notes'), [activeTemplate]);

  return (
    <div className="space-y-4">
      
      {/* Top Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span>仕様書リアルタイム生成 ＆ セル転記スタジオ</span>
            </h1>
            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded">
              （編集中）
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            機器仕様のセル自動転記・案件共通情報の一律反映・Excel原本へのメモリ内直接再描画をリアルタイムでプレビューできます。
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenAdminMapping && (
            <button
              onClick={() => onOpenAdminMapping(selectedTemplateId)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="管理者専用: セル番地や選択肢のマッピング定義を変更"
            >
              <Settings2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>マッピング設定管理</span>
            </button>
          )}
        </div>
      </div>

      {exportNotice && (
        <div className="bg-emerald-600 text-white text-xs py-2 px-4 rounded-lg shadow-xs flex items-center justify-between animate-in fade-in">
          <span>{exportNotice}</span>
          <button onClick={() => setExportNotice('')} className="text-white hover:text-emerald-200">✕</button>
        </div>
      )}

      {/* Main Grid: Left = Clean Form + Equipment Specs, Right = Real-time Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Clean User Input Studio (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* 1. Template Selector Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>仕様書テンプレートの選択</span>
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded">
                  （編集中）
                </span>
              </label>
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                setSelectedSheetOverride('');
              }}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}){t.id === selectedTemplateId ? '（編集中）' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Section: 基本情報 & 案件共通連動 (Moved here as requested) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>📋 基本情報 ＆ 案件共通連動</span>
              </h2>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-medium">
                案件サマリー一律反映
              </span>
            </div>

            {/* Readonly / Uniform Project Info from Project Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1.5">
              {currentProject?.orderNo && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">オーダーNo.:</span>
                  <span className="font-mono font-bold text-indigo-700">{currentProject.orderNo}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">案件コード (共通):</span>
                <span className="font-mono font-bold text-slate-900">{currentProject?.code}</span>
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
              {(currentProject?.clientNumber || currentProject?.clientNumberPart1 || currentProject?.clientNumberPart2) && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">客先番号:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {currentProject.clientNumber || `【${currentProject.clientNumberPart1 || ''}】-【${currentProject.clientNumberPart2 || ''}】`}
                  </span>
                </div>
              )}
              {currentProject?.location && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">工事場所:</span>
                  <span className="text-slate-800 truncate max-w-xs">{currentProject.location}</span>
                </div>
              )}
            </div>

            {/* Document Number with semi-fixed lock notice */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>仕様書番号</span>
                  <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded cursor-pointer hover:bg-indigo-100 hover:text-indigo-700" onClick={() => setSelectedCellAddress('C3')} title="Excelセルへジャンプ">
                    C3
                  </span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  案件コード・機器番号連動
                </span>
              </div>
              <input
                type="text"
                value={formValues['f-docno'] || fixedDocNo}
                onFocus={() => {
                  setFocusedFieldId('f-docno');
                  setSelectedCellAddress('C3');
                }}
                onChange={(e) => handleFieldChange('f-docno', e.target.value)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-indigo-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-400">
                ※仕様書番号は工事コードと機器番号からほぼ固定で自動生成（詳細な採番規則は別途指示で調整可能）
              </p>
            </div>

            {/* Other basic fields */}
            <div className="space-y-2.5 pt-1">
              {basicFields.filter(f => f.id !== 'f-docno').map(field => {
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
                            title="Excel原本の対応セルを選択"
                          >
                            {field.cell}
                          </button>
                        )}
                      </label>
                      {transferTag && (
                        <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-sans truncate max-w-[170px]" title={transferTag}>
                          ✓ {transferTag}
                        </span>
                      )}
                    </div>
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={formValues[field.id] ?? ''}
                      onFocus={() => {
                        setFocusedFieldId(field.id);
                        if (field.cell) setSelectedCellAddress(field.cell.toUpperCase());
                      }}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || `${field.label}を入力...`}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-colors"
                    />
                  </div>
                );
              })}
            </div>
          </div>

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
                <span>機器から再転記</span>
              </button>
            </div>

            {/* Included Equipments in this Specification */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>仕様書に含める機器 ({activeItems.length}件):</span>
                <span className="text-[10px] text-slate-400">
                  主仕様（転記元）をラジオで選択
                </span>
              </div>

              {/* List of included equipment items (1種類目〜4種類目) */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activeItems.map((it, idx) => {
                  const isPrimary = it.id === primaryItemId;
                  const slotLabel = idx === 0 ? '1種類目 (主仕様)' : `${idx + 1}種類目`;
                  return (
                    <div
                      key={it.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                        isPrimary ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          idx === 0 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-slate-200 text-slate-700'
                        }`}>
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

                        <span className="font-mono font-bold text-slate-800 shrink-0">
                          [{it.tagNo || '未割当'}]
                        </span>
                        <span className="font-semibold text-slate-900 truncate">
                          {it.name}
                        </span>
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

              {/* Add Equipment Row (複数機器を含める場合があるため追加ボタンを追加) */}
              {unselectedItems.length > 0 && (
                <div className="pt-2 flex items-center gap-1.5">
                  <select
                    value={itemToAddId}
                    onChange={(e) => setItemToAddId(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">＋ 追加する機器を選択...</option>
                    {unselectedItems.map(it => (
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

            {/* Display Detected Specifications for active primary equipment */}
            {primaryItem && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>主仕様機器「{primaryItem.name}」の登録仕様一覧:</span>
                  <span className="font-mono text-indigo-600 font-bold">{primaryItem.tagNo || '-'}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {primaryItem.specs && primaryItem.specs.length > 0 ? (
                    primaryItem.specs.map(spec => (
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
                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">
                          口径: {primaryItem.diameter}
                        </span>
                      )}
                      {primaryItem.material && primaryItem.material !== '-' && (
                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">
                          材質: {primaryItem.material}
                        </span>
                      )}
                    </div>
                  )}

                  {primaryItem.deliveryDate && (
                    <span className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded text-[11px] font-mono">
                      <span className="text-slate-500 font-sans">納期:</span>
                      <span className="font-semibold text-slate-800">{primaryItem.deliveryDate}</span>
                    </span>
                  )}

                  <span className={`inline-flex items-center gap-1 border px-2 py-1 rounded text-[11px] font-mono ${
                    primaryItem.isIssued
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}>
                    <span className="font-sans text-slate-500">発行:</span>
                    <span className={primaryItem.isIssued ? 'text-emerald-700' : 'text-slate-500'}>
                      {primaryItem.isIssued ? '済' : '未'}
                    </span>
                  </span>
                </div>

                <div className="text-[10px] text-slate-400">
                  ※口径、材質、塗装、耐圧、出力などの項目名がテンプレートの項目定義と自動照合され、該当セルに直接転記されます。
                </div>
              </div>
            )}
          </div>

          {/* 4. Section: 仕様・条件選択 (プルダウン形式) */}
          {specFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span>⚙️ 仕様・受渡条件 (プルダウン選択)</span>
              </h2>
              <div className="space-y-3">
                {specFields.map(field => {
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
                              title="Excel原本の対応セルを選択"
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
                            <option key={idx} value={opt}>{opt}</option>
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
                      {field.description && (
                        <p className="text-[10px] text-slate-400">{field.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Section: チェック形式の適用要件 */}
          {checkFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>✅ 適用要件・検査基準 (チェック形式)</span>
                </h2>
                <span className="text-[10px] text-slate-400">クリックで要/不要を切替</span>
              </div>
              <div className="space-y-2">
                {checkFields.map(field => {
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
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isChecked ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {isChecked ? (cfg?.labelTrue || '要') : (cfg?.labelFalse || '不要')}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          流し込み値: {isChecked ? (cfg?.checkedValue || '☑ 要') : (cfg?.uncheckedValue || '☐ 不要')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Section: 特記事項 */}
          {noteFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <h2 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>📝 特記事項・指示事項</span>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-100 hover:text-indigo-700" onClick={() => setSelectedCellAddress('B23')} title="セルB23へ移動">
                  セル B23
                </span>
              </h2>
              {noteFields.map(f => (
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
        </div>

        {/* Right Column: PDF Specification Sheet & Excel Spreadsheet Live Views (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Header Strip: Title, Reload, Unified Export Dropdown, and Zoom Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${
                  previewMode === 'pdf' 
                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {previewMode === 'pdf' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs font-bold text-slate-900">
                      仕様書プレビュー
                    </h2>
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded">
                      （編集中）
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {previewMode === 'pdf' 
                      ? '入力内容とマッピングをリアルタイムに帳票へ反映しています' 
                      : 'ExcelJSメモリ内原本スプレッドシート（セル直接クリック・数式バー編集対応）'}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Reload, Unified Export Dropdown, and Zoom */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Prominent Reload Preview Button */}
                <button
                  type="button"
                  onClick={handleReloadPreview}
                  disabled={isGeneratingPdf}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="入力やマッピングの変更を再読み込みして最新プレビューを反映"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPdf ? 'animate-spin' : ''}`} />
                  <span>再読み込み</span>
                </button>

                {/* Unified Output Button with Dropdown (PDF / Excel) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsExportMenuOpen(prev => !prev)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="仕様書ファイルを出力 (PDFまたはExcel)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>出力</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isExportMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsExportMenuOpen(false)} 
                      />
                      <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                          出力形式を選択
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={isGeneratingPdf}
                          className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-1">
                              <span>PDF出力</span>
                              <span className="text-[10px] text-rose-600 font-mono">(.pdf)</span>
                            </div>
                            <div className="text-[10px] text-slate-400">提出・印刷用フォーマット</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={handleExportExcel}
                          disabled={isExporting}
                          className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-1">
                              <span>Excel出力</span>
                              <span className="text-[10px] text-emerald-600 font-mono">(.xlsx)</span>
                            </div>
                            <div className="text-[10px] text-slate-400">原本マスター雛形に直接反映</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                    className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                    title="縮小"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 font-mono text-[11px] font-semibold text-slate-700 select-none">
                    {previewZoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                    className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                    title="拡大"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Notification Bar */}
            {(pdfNotice || exportNotice) && (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between animate-in fade-in">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  {pdfNotice || exportNotice}
                </span>
                <button onClick={() => { setPdfNotice(''); setExportNotice(''); }} className="text-indigo-400 hover:text-indigo-700 cursor-pointer">✕</button>
              </div>
            )}

            {/* PREVIEW MODE TABS (Clean tabs spanning across canvas) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewMode('pdf')}
                className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  previewMode === 'pdf'
                    ? 'bg-white text-rose-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>PDF (仕様書帳票)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('excel')}
                className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  previewMode === 'excel'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>EXCEL (原本直接描画)</span>
              </button>
            </div>

            {/* Excel Formula Bar: Shown when in Excel mode */}
            {previewMode === 'excel' && (
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
                  placeholder={selectedCellMappedField ? `【${selectedCellMappedField.label}】の値を直接編集...` : '選択したセルの値を直接入力・確認...'}
                  className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-900 font-medium focus:outline-hidden focus:border-indigo-500 shadow-2xs"
                />
                {selectedCellMappedField ? (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-medium whitespace-nowrap shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    連動: {selectedCellMappedField.label}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 border border-slate-200 bg-white px-2 py-0.5 rounded font-mono whitespace-nowrap shrink-0">
                    未マッピングセル
                  </span>
                )}
              </div>
            )}
          </div>

          {/* VIEW MODE 1: PDF SPECIFICATION SHEET PREVIEW */}
          {previewMode === 'pdf' && (
            <div className="space-y-2">
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-4 sm:p-6 overflow-x-auto flex justify-center shadow-inner">
                {/* Authentic A4 Specification Document Container: Converted from Loaded Excel Template */}
                <div
                  ref={specSheetRef}
                  style={{
                    width: '794px',
                    minHeight: '1123px',
                    transform: previewZoom !== 100 ? `scale(${previewZoom / 100})` : undefined,
                    transformOrigin: 'top center',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    padding: '36px 36px',
                    fontFamily: '"Hiragino Sans", "Meiryo", "BIZ UDPGothic", "Yu Gothic", sans-serif',
                  }}
                  className="shadow-xl rounded-sm border border-slate-300 transition-transform text-slate-900 bg-white"
                >
                  {/* Document Header Badge */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-1 border-b border-slate-200 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">【原本テンプレート直接描画帳票】</span>
                      <span>{activeTemplate?.name || '調達仕様書'}</span>
                      <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200 font-bold">{activeTemplate?.code || 'TPL'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>シート: <strong className="text-slate-600">{selectedSheetOverride || excelGridData?.sheetName || '仕様書'}</strong></span>
                      <span>|</span>
                      <span>仕様書番号: <strong className="text-indigo-900">{formValues['f-docno'] || fixedDocNo}</strong></span>
                    </div>
                  </div>

                  {/* Template Table Rendered Directly from ExcelJS In-Memory Grid */}
                  {excelGridData && excelGridData.rows.length > 0 ? (
                    <div className="w-full">
                      <table className="w-full border-collapse table-fixed text-slate-900" style={{ fontSize: '10px' }}>
                        <colgroup>
                          {excelGridData.columns.map(col => (
                            <col 
                              key={col.colLetter} 
                              style={{ width: `${(col.width / totalColWidth) * 100}%` }} 
                            />
                          ))}
                        </colgroup>
                        <tbody>
                          {excelGridData.rows.map(row => (
                            <tr 
                              key={row.rowNumber} 
                              style={{ height: row.height ? `${Math.round(row.height * 0.96)}px` : undefined }}
                            >
                              {row.cells.map(cell => {
                                if (cell.isMergedChild) return null;

                                return (
                                  <td
                                    key={cell.address}
                                    colSpan={cell.colSpan || 1}
                                    rowSpan={cell.rowSpan || 1}
                                    style={{
                                      backgroundColor: cell.bgColor || undefined,
                                      color: cell.fontColor || '#0f172a',
                                      textAlign: cell.align || 'left',
                                      verticalAlign: cell.verticalAlign || 'middle',
                                      fontWeight: cell.isBold ? 700 : 400,
                                      fontSize: cell.fontSize ? `${Math.max(8.5, Math.min(cell.fontSize, 15))}px` : '9.5px',
                                      borderTop: cell.borderTopStyle || (cell.borderTop ? '1px solid #475569' : undefined),
                                      borderBottom: cell.borderBottomStyle || (cell.borderBottom ? '1px solid #475569' : undefined),
                                      borderLeft: cell.borderLeftStyle || (cell.borderLeft ? '1px solid #475569' : undefined),
                                      borderRight: cell.borderRightStyle || (cell.borderRight ? '1px solid #475569' : undefined),
                                      border: (!cell.borderTopStyle && !cell.borderBottomStyle && !cell.borderLeftStyle && !cell.borderRightStyle && cell.hasBorder) ? '1px solid #475569' : undefined,
                                      padding: '3px 5px',
                                      wordBreak: 'break-word',
                                      lineHeight: 1.25,
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    {cell.value || ''}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-96 flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                      <p className="text-xs font-semibold text-slate-600">テンプレート原本を解析・変換中...</p>
                      <p className="text-[11px] text-slate-400">マッピング定義に基づきExcelシートをPDF帳票へレンダリングしています</p>
                    </div>
                  )}

                  {/* Document Print Footer */}
                  <div className="mt-4 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                    <span>※ 本書は登録テンプレート原本（.xlsx）より変換・自動生成された正式調達仕様書です。</span>
                    <span>DocID: {formValues['f-docno'] || fixedDocNo} | 発行日: {formValues['f-date'] || new Date().toISOString().slice(0, 10)}</span>
                  </div>
                </div>
              </div>

              {/* Status bar below PDF */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>マッピングや入力値を更新した後、右上の「再読み込み」を押すと最新のプレビューが反映されます。</span>
                </div>
                <div className="font-mono text-indigo-700 font-semibold">
                  Doc No: {fixedDocNo}
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: EXCEL ORIGINAL LIVE GRID */}
          {previewMode === 'excel' && (
            <div className="space-y-2 pb-4">
              <div className="bg-white border border-slate-300 shadow-md rounded-xl overflow-hidden transition-all select-none">
                
                {/* Sheet Tabs Bar & In-Frame Zoom Toolbar */}
                <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  {/* Sheet Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {excelGridData?.availableSheets && excelGridData.availableSheets.length > 0 ? (
                      excelGridData.availableSheets.map(s => {
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

                  {/* Excel Frame In-Canvas Zoom Controls */}
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {/* Quick Preset Buttons */}
                    <div className="hidden sm:flex items-center gap-1 text-[10px]">
                      {[75, 100, 125].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPreviewZoom(preset)}
                          className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
                            previewZoom === preset 
                              ? 'bg-slate-800 text-white shadow-2xs' 
                              : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-300'
                          }`}
                        >
                          {preset}%
                        </button>
                      ))}
                    </div>

                    {/* Stepper with Zoom In / Out */}
                    <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.max(40, z - 10))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                        title="Excelシートを縮小 (-10%)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 font-mono text-[11px] font-bold text-slate-800 select-none min-w-[44px] text-center">
                        {previewZoom}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.min(200, z + 10))}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                        title="Excelシートを拡大 (+10%)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewZoom(100)}
                      className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                      title="倍率を100%にリセット"
                    >
                      リセット
                    </button>
                  </div>
                </div>

                {/* Spreadsheet Scroll Canvas with Wheel Zoom and Fixed Pixel Dimensions */}
                <div 
                  className="overflow-auto max-h-[720px] bg-slate-200/60 p-3 sm:p-5"
                  onWheel={(e) => {
                    if (e.ctrlKey) {
                      e.preventDefault();
                      if (e.deltaY < 0) {
                        setPreviewZoom(z => Math.min(200, z + 10));
                      } else {
                        setPreviewZoom(z => Math.max(40, z - 10));
                      }
                    }
                  }}
                  title="Ctrl + マウスホイールで拡大縮小"
                >
                  <div 
                    style={{
                      zoom: previewZoom !== 100 ? previewZoom / 100 : undefined,
                      transform: (typeof (document?.body?.style as any)?.zoom === 'undefined' && previewZoom !== 100)
                        ? `scale(${previewZoom / 100})` 
                        : undefined,
                      transformOrigin: 'top left',
                      width: `${totalColWidth + 42}px`,
                      minWidth: `${totalColWidth + 42}px`,
                      margin: '0 auto'
                    }}
                    className="bg-white shadow-xl rounded-xs border border-slate-300"
                  >
                    <table 
                      className="border-collapse text-slate-900 bg-white"
                      style={{
                        width: `${totalColWidth + 42}px`,
                        minWidth: `${totalColWidth + 42}px`,
                        tableLayout: 'fixed'
                      }}
                    >
                      <colgroup>
                        <col style={{ width: '42px', minWidth: '42px' }} />
                        {excelGridData?.columns.map(col => (
                          <col 
                            key={col.colLetter} 
                            style={{ width: `${col.width}px`, minWidth: `${col.width}px` }} 
                          />
                        ))}
                      </colgroup>
                      <thead className="bg-slate-200 text-slate-700 font-mono text-[11px] font-semibold sticky top-0 z-20 shadow-2xs">
                        <tr style={{ height: '24px' }}>
                          <th className="w-[42px] p-0 text-center border-r border-b border-slate-300 bg-slate-300/90 text-[10px] sticky left-0 z-30 select-none">#</th>
                          {excelGridData?.columns.map(col => (
                            <th 
                              key={col.colLetter}
                              style={{ width: `${col.width}px` }}
                              className="p-1 text-center border-r border-b border-slate-300 text-[11px] bg-slate-200"
                            >
                              {col.colLetter}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelGridData?.rows.map(row => (
                          <tr 
                            key={row.rowNumber} 
                            style={{ height: row.height ? `${row.height}px` : '20px' }}
                          >
                            <td className="bg-slate-100/95 text-slate-500 font-mono text-[10px] text-center p-0 border-r border-b border-slate-300 sticky left-0 z-10 select-none font-semibold">
                              {row.rowNumber}
                            </td>
                            {row.cells.map(cell => {
                              if (cell.isMergedChild) {
                                return null;
                              }
                              const isSelected = cell.address === selectedCellAddress;
                              const isMapped = Boolean(cell.isMapped || cell.mappedFieldId);

                              return (
                                <td
                                  key={cell.address}
                                  colSpan={cell.colSpan || 1}
                                  rowSpan={cell.rowSpan || 1}
                                  onClick={() => {
                                    setSelectedCellAddress(cell.address);
                                    if (cell.mappedFieldId) {
                                      setFocusedFieldId(cell.mappedFieldId);
                                    }
                                  }}
                                  title={`セル ${cell.address}${cell.mappedFieldLabel ? ` (連動: ${cell.mappedFieldLabel})` : ''}: ${cell.value}`}
                                  style={{
                                    backgroundColor: isSelected ? '#EEF2FF' : (cell.bgColor || undefined),
                                    textAlign: cell.align || 'left',
                                    verticalAlign: cell.verticalAlign || 'middle',
                                    color: cell.fontColor || '#0f172a',
                                    fontWeight: cell.isBold ? 700 : 400,
                                    fontSize: cell.fontSize ? `${Math.max(8.5, Math.min(cell.fontSize, 16))}px` : '10px',
                                    fontFamily: cell.fontFamily ? `"${cell.fontFamily}", "Meiryo", sans-serif` : undefined,
                                    borderTop: cell.borderTopStyle || (cell.borderTop ? '1px solid #475569' : '1px solid #e2e8f0'),
                                    borderBottom: cell.borderBottomStyle || (cell.borderBottom ? '1px solid #475569' : '1px solid #e2e8f0'),
                                    borderLeft: cell.borderLeftStyle || (cell.borderLeft ? '1px solid #475569' : '1px solid #e2e8f0'),
                                    borderRight: cell.borderRightStyle || (cell.borderRight ? '1px solid #475569' : '1px solid #e2e8f0'),
                                    padding: '2px 4px',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.25,
                                    whiteSpace: 'pre-wrap',
                                    overflow: 'hidden'
                                  }}
                                  className={`transition-colors cursor-cell select-text ${
                                    isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/70 z-10 font-bold shadow-xs' : ''
                                  } ${
                                    isMapped && !isSelected ? 'hover:bg-indigo-50/40' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 w-full h-full">
                                    <span className="w-full">{cell.value || ''}</span>
                                    {isMapped && (
                                      <span 
                                        className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 opacity-70 ml-0.5" 
                                        title={`マッピング連動: ${cell.mappedFieldLabel || ''}`} 
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Status footer for the Excel Sheet */}
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>セルをクリックすると上の数式バーおよび左の項目と連動して編集できます。（Ctrl + マウスホイールで拡大縮小可能）</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-indigo-700 font-semibold">
                      選択セル: {selectedCellAddress || '-'}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-600 font-semibold">
                      倍率: {previewZoom}%
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-700 font-semibold">1-Click .xlsx Export Ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
