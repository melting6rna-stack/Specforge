import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Check, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  Settings2,
  CheckSquare,
  Square,
  Layers,
  ChevronDown,
  Info,
  SlidersHorizontal,
  FolderOpen,
  Calendar,
  Sparkles,
  Zap,
  RefreshCw,
  Table,
  Cpu,
  ArrowRight,
  Lock,
  ExternalLink,
  Tag,
  Upload,
  FileSpreadsheet,
  Edit3
} from 'lucide-react';
import { EquipmentItem, SpecTemplate, Category, SpecFieldMapping, ProjectWorkspace } from '../types';
import { downloadSpecificationExcel, renderSpecificationExcelGrid, RenderedSheetGrid } from '../utils/exceljsEngine';

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

  useEffect(() => {
    const ids = projectItems.map(it => it.id);
    setSelectedItemIds(ids);
    if (ids.length > 0 && !primaryItemId) {
      setPrimaryItemId(ids[0]);
    }
  }, [projectItems]);

  const activeItems = useMemo(() => {
    return projectItems.filter(it => selectedItemIds.includes(it.id));
  }, [projectItems, selectedItemIds]);

  const primaryItem = useMemo(() => {
    return projectItems.find(it => it.id === primaryItemId) || activeItems[0] || projectItems[0];
  }, [projectItems, primaryItemId, activeItems]);

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
  const [directUploadNotice, setDirectUploadNotice] = useState<string>('');
  const masterExcelInputRef = React.useRef<HTMLInputElement | null>(null);

  // Auto-calculated document number: semi-fixed based on project code and equipment tag
  const fixedDocNo = useMemo(() => {
    const prjCode = currentProject?.code || 'PRJ';
    const tag = primaryItem?.tagNo || 'EQ001';
    return `${prjCode}-${tag}-SPEC`;
  }, [currentProject?.code, primaryItem?.tagNo]);

  // Helper to transfer equipment specs into mapped template fields
  const transferSpecsFromEquipment = useCallback((item: EquipmentItem | undefined, tpl: SpecTemplate | undefined, currentVals: Record<string, any>) => {
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
        newVals[f.id] = `${currentProject?.code || 'PRJ'}-${item.tagNo || 'EQ01'}-SPEC`;
        matched[f.id] = `案件・機器連動: ${newVals[f.id]}`;
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

  // Handle cell edit via formula bar
  const handleFormulaChange = (newVal: string) => {
    if (selectedCellMappedField) {
      handleFieldChange(selectedCellMappedField.id, newVal);
    }
  };

  // Direct Excel master template upload handler
  const handleDirectUploadMasterExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const updated = templates.map(t => {
          if (t.id === selectedTemplateId) {
            return {
              ...t,
              masterFileName: file.name,
              masterWorkbookBase64: base64,
              rawWorkbookBase64: base64,
              updatedAt: new Date().toISOString().slice(0, 10)
            };
          }
          return t;
        });

        if (onUpdateTemplates) {
          onUpdateTemplates(updated);
        }

        setDirectUploadNotice(`雛形Excel「${file.name}」を取り込みました。直接描画ビューに即時反映されました。`);
        setTimeout(() => setDirectUploadNotice(''), 5000);
        setSelectedSheetOverride('');
        setRenderCounter(c => c + 1);
      } catch (err: any) {
        setDirectUploadNotice(`読込エラー: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
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

  const handlePrint = () => {
    window.print();
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
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600" />
              <span>Excel原本直接描画（本採用）</span>
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

          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="ExcelJSでマスター雛形に値を流し込んで出力します"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-spin' : ''}`} />
            <span>{isExporting ? '生成中...' : 'Excel出力 (.xlsx)'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>印刷 / PDF</span>
          </button>
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
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => masterExcelInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="手元のExcelファイルをこのテンプレートの原本として取り込む"
                >
                  <Upload className="w-3 h-3 text-emerald-700" />
                  <span>雛形Excel差替・読込</span>
                </button>
                <input
                  type="file"
                  ref={masterExcelInputRef}
                  accept=".xlsx"
                  onChange={handleDirectUploadMasterExcel}
                  className="hidden"
                />
              </div>
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

            <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono">
              <span className="text-slate-500 flex items-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>適用原本:</span>
              </span>
              <span className="font-bold text-emerald-700 truncate max-w-[210px]" title={activeTemplate?.masterFileName || activeTemplate?.originalFileName}>
                {activeTemplate?.masterFileName || activeTemplate?.originalFileName || 'システム内蔵高品位マスター (ExcelJS)'}
              </span>
            </div>

            {directUploadNotice && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] p-2 rounded animate-in fade-in flex items-center justify-between">
                <span>{directUploadNotice}</span>
                <button type="button" onClick={() => setDirectUploadNotice('')} className="text-emerald-700 hover:text-emerald-900 font-bold ml-1">✕</button>
              </div>
            )}
          </div>

          {/* 2. Equipment Selection & Automatic Spec Transfer Card */}
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

            {/* Primary Equipment Chooser */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between mb-1">
                <span>主仕様の転記元機器（フォーカス機器）:</span>
                <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-bold">
                  （編集中）
                </span>
              </label>
              <select
                value={primaryItemId}
                onChange={(e) => setPrimaryItemId(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg p-2 cursor-pointer focus:bg-white focus:border-indigo-500"
              >
                {projectItems.map(it => (
                  <option key={it.id} value={it.id}>
                    [{it.tagNo || '未割当'}] {it.name} ({it.quantity} {it.unit || '台'}){it.id === primaryItemId ? '（編集中）' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Display Detected Specifications for this equipment */}
            {primaryItem && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>機器「{primaryItem.name}」の登録仕様一覧:</span>
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
                </div>

                <div className="text-[10px] text-slate-400">
                  ※口径、材質、塗装、耐圧、出力などの項目名がテンプレートの項目定義と自動照合され、該当セルに直接転記されます。
                </div>
              </div>
            )}

            {/* Checkbox list of all included equipments */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1.5">
                <span>明細テーブルに含める機器 ({activeItems.length}/{projectItems.length}件):</span>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds(projectItems.map(i => i.id))}
                    className="text-indigo-600 hover:underline cursor-pointer"
                  >
                    全選択
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds([])}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    全解除
                  </button>
                </div>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100">
                {projectItems.map(item => {
                  const isChecked = selectedItemIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItemIds(prev => 
                          isChecked ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className="pt-1 first:pt-0 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 p-1 rounded"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <button type="button" className="text-indigo-600 shrink-0">
                          {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                        </button>
                        <span className="font-mono font-semibold text-slate-700 shrink-0">{item.tagNo || '-'}</span>
                        <span className="text-slate-900 truncate font-medium">{item.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {item.quantity} {item.unit || '台'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* 3. Section: 基本情報 & 案件共通連動 (No A1/B5) */}
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

        {/* Right Column: Real-Time Excel Spreadsheet View (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Header Strip: Title, Zoom, and Download Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Excel原本 直接描画ビュー</span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">
                      （編集中）
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                      原本セル直接連動
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-sm">
                    使用中テンプレート: <strong className="text-slate-700">{activeTemplate?.masterFileName || activeTemplate?.originalFileName || activeTemplate?.name}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Zoom */}
              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs">
                  <button
                    onClick={() => setPreviewZoom(Math.max(60, previewZoom - 10))}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                    title="縮小"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-slate-700 text-xs w-9 text-center font-bold">
                    {previewZoom}%
                  </span>
                  <button
                    onClick={() => setPreviewZoom(Math.min(140, previewZoom + 10))}
                    className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                    title="拡大"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1-Click Excel Download */}
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? '出力中...' : 'Excel出力'}</span>
                </button>
              </div>
            </div>

            {/* Excel Formula Bar: [ C5 ] fx [ input ] */}
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

            {/* Performance Benchmark Indicator Bar */}
            <div className="bg-slate-900 text-slate-200 rounded-lg px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-white font-bold">
                  ⚡ メモリ内ExcelJS即時再描画:
                </span>
                <span className="text-emerald-400 font-bold text-sm">
                  {excelGridData?.benchmarkMs ?? '--'} ms
                </span>
                <span className="text-slate-400 text-[11px] font-sans hidden sm:inline">
                  （セルをクリックして選択、または左側フォーム入力で即時反映）
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-300">
                <span>セル数: {excelGridData?.totalCells ?? 0}</span>
                <button
                  type="button"
                  onClick={() => setRenderCounter(c => c + 1)}
                  className="text-indigo-300 hover:text-white underline cursor-pointer"
                >
                  再読込
                </button>
              </div>
            </div>
          </div>

          {/* Authentic Real-Time Excel Spreadsheet Grid (ExcelJS) */}
          <div className="overflow-x-auto pb-4">
            <div 
              style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top left' }}
              className="bg-white border border-slate-300 shadow-md rounded-lg overflow-hidden min-w-[760px] transition-transform select-none"
            >
              {/* Sheet Tabs Bar */}
              <div className="bg-slate-100 border-b border-slate-300 px-2 py-1 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 overflow-x-auto">
                  {excelGridData?.availableSheets && excelGridData.availableSheets.length > 0 ? (
                    excelGridData.availableSheets.map(s => {
                      const isActive = (selectedSheetOverride || excelGridData.sheetName) === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSheetOverride(s)}
                          className={`px-3 py-1 font-bold text-xs transition-colors rounded-t border-t-2 border-x cursor-pointer ${
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
                    <span className="bg-white border-t-2 border-emerald-600 border-x border-slate-300 px-3 py-1 font-bold text-slate-900 shadow-2xs">
                      {excelGridData?.sheetName || '仕様書'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-mono pr-2">
                  ExcelJS In-Memory Grid Canvas
                </div>
              </div>

              {/* Spreadsheet Table with Column Letters (A, B, C...) & Row Numbers (1, 2, 3...) */}
              <div className="overflow-x-auto max-h-[720px] overflow-y-auto">
                <table className="border-collapse text-xs font-sans w-full bg-white">
                  {/* Column Headers (A, B, C...) */}
                  <thead className="bg-slate-200/90 text-slate-700 font-mono font-semibold border-b border-slate-300 sticky top-0 z-20">
                    <tr>
                      <th className="w-10 p-1 text-center border-r border-slate-300 bg-slate-300/80 text-[10px] sticky left-0 z-30">#</th>
                      {excelGridData?.columns.map(col => (
                        <th 
                          key={col.colLetter}
                          style={{ width: `${col.width}px` }}
                          className="p-1 text-center border-r border-slate-300 text-[11px] bg-slate-200"
                        >
                          {col.colLetter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelGridData?.rows.map(row => (
                      <tr key={row.rowNumber} className="border-b border-slate-200">
                        {/* Row Number (1, 2, 3...) */}
                        <td className="bg-slate-100 text-slate-500 font-mono text-[10px] text-center p-1 border-r border-slate-300 sticky left-0 z-10 select-none">
                          {row.rowNumber}
                        </td>
                        {/* Row Cells */}
                        {row.cells.map(cell => {
                          // Skip merged child cells to avoid rendering distorted extra cells
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
                                color: cell.fontColor || undefined,
                              }}
                              className={`p-1.5 border-r border-slate-200 text-xs transition-colors cursor-cell select-text ${
                                cell.isBold ? 'font-bold' : ''
                              } ${
                                isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/70 z-10 font-bold shadow-xs' : ''
                              } ${
                                isMapped && !isSelected ? 'hover:bg-indigo-50/40' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 overflow-hidden">
                                <span className="truncate">{cell.value || ''}</span>
                                {isMapped && (
                                  <span 
                                    className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 opacity-70" 
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

              {/* Status footer for the Excel Sheet */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>セルをクリックすると上の数式バーおよび左の項目と連動して編集できます。</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-indigo-700 font-semibold">
                    選択セル: {selectedCellAddress}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="font-mono text-emerald-700 font-semibold">1-Click .xlsx Export Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
