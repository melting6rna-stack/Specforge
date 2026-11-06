import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles
} from 'lucide-react';
import { EquipmentItem, SpecTemplate, Category, SpecFieldMapping } from '../types';
import { downloadSpecificationExcel } from '../utils/exceljsEngine';

interface SpecDashboardTabProps {
  items: EquipmentItem[];
  categories: Category[];
  templates: SpecTemplate[];
  activeProjectId: string;
  onOpenAdminMapping?: (templateId: string) => void;
}

export const SpecDashboardTab: React.FC<SpecDashboardTabProps> = ({
  items,
  categories,
  templates,
  activeProjectId,
  onOpenAdminMapping,
}) => {
  const projectItems = useMemo(() => items.filter(it => it.projectId === activeProjectId), [items, activeProjectId]);

  // Selected Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Selected Equipment Items to include in the specification
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedItemIds(projectItems.map(it => it.id));
  }, [projectItems]);

  const activeItems = useMemo(() => {
    return projectItems.filter(it => selectedItemIds.includes(it.id));
  }, [projectItems, selectedItemIds]);

  // Form Values State (Keyed by field.id) - completely hidden from cell coordinates!
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Initialize or update form values when activeTemplate changes
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

    setFormValues(initialVals);
  }, [activeTemplate]);

  // Handle form field value changes
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  // Zoom level for preview
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
        documentNo: formValues['f-docno'] || 'SPEC-2026-001',
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
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>仕様書出力・リアルタイムプレビュー</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono">
              ExcelJS 雛形流し込みエンジン
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            マスター雛形のフォント・罫線・書式を完全保持したまま、入力値と選択機器をセルに流し込んで出力します。
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

      {/* Main Grid: Left = Clean User Form (No cell coordinates!), Right = Real-time Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Clean User Input Studio (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Template Selector Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>仕様書テンプレートの選択</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {templates.length} 種類登録済み
              </span>
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {activeTemplate?.description}
            </p>
          </div>

          {/* Section A: 基本情報 (Clean Form, No A1/B5) */}
          {basicFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span>📋 基本情報</span>
              </h2>

              <div className="space-y-2.5">
                {basicFields.map(field => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      {field.label}
                    </label>
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={formValues[field.id] ?? ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || `${field.label}を入力...`}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section B: 仕様・選択項目 (プルダウン形式) */}
          {specFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <span>⚙️ 仕様・受渡条件 (プルダウン選択)</span>
              </h2>

              <div className="space-y-3">
                {specFields.map(field => (
                  <div key={field.id} className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">
                      {field.label}
                    </label>
                    {field.options && field.options.length > 0 ? (
                      <select
                        value={formValues[field.id] ?? ''}
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
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      />
                    )}
                    {field.description && (
                      <p className="text-[10px] text-slate-400">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section C: チェック形式の適用要件 (チェックボックス) */}
          {checkFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>✅ 適用要件・検査基準 (チェック形式)</span>
                </h2>
                <span className="text-[10px] text-slate-400">
                  クリックで要/不要を切替
                </span>
              </div>

              <div className="space-y-2">
                {checkFields.map(field => {
                  const isChecked = Boolean(formValues[field.id]);
                  const cfg = field.checkboxConfig;

                  return (
                    <div
                      key={field.id}
                      onClick={() => handleFieldChange(field.id, !isChecked)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                        isChecked 
                          ? 'bg-indigo-50/70 border-indigo-300 text-slate-900 shadow-2xs' 
                          : 'bg-slate-50/80 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 text-indigo-600 shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                          <span>{field.label}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isChecked ? 'bg-indigo-100 text-indigo-800 font-bold' : 'bg-slate-200 text-slate-500'
                          }`}>
                            {isChecked ? (cfg?.labelTrue || '要') : (cfg?.labelFalse || '不要')}
                          </span>
                        </div>
                        {field.description && (
                          <p className="text-[10px] text-slate-500 mt-0.5">{field.description}</p>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          流し込み値: {isChecked ? (cfg?.checkedValue || '☑ 要') : (cfg?.uncheckedValue || '☐ 不要')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section D: 対象機器選択 (チェックボックス) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span>📦 仕様書に含める機器 ({activeItems.length}/{projectItems.length}件)</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedItemIds(projectItems.map(i => i.id))}
                  className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                >
                  全選択
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                >
                  全解除
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
              {projectItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  機器データベースにデータがありません。「機器データベース」タブで登録してください。
                </div>
              ) : (
                projectItems.map(item => {
                  const isChecked = selectedItemIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItemIds(prev => 
                          isChecked ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className="pt-1.5 first:pt-0 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50 p-1 rounded"
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
                })
              )}
            </div>
          </div>

          {/* Section E: 特記事項 (Textarea) */}
          {noteFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <h2 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                <span>📝 特記事項・指示事項</span>
              </h2>
              {noteFields.map(f => (
                <div key={f.id} className="space-y-1">
                  <textarea
                    rows={4}
                    value={formValues[f.id] ?? ''}
                    onChange={(e) => handleFieldChange(f.id, e.target.value)}
                    placeholder="特記事項や納入時の注意事項を入力..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden leading-relaxed font-sans"
                  />
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Right Column: Real-Time Live HTML/CSS Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-2">
          
          {/* Zoom & View Controls */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>リアルタイム印刷連動プレビュー (A4縦準拠)</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewZoom(Math.max(70, previewZoom - 10))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                title="縮小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-slate-600 text-xs w-10 text-center">
                {previewZoom}%
              </span>
              <button
                onClick={() => setPreviewZoom(Math.min(130, previewZoom + 10))}
                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                title="拡大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scalable Printable Specification Sheet Preview Container */}
          <div className="overflow-x-auto pb-4">
            <div 
              style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top left' }}
              className="bg-white border border-slate-300 shadow-lg rounded-sm p-8 min-w-[720px] transition-transform text-slate-900 font-sans print:shadow-none print:border-none print:p-0"
            >
              
              {/* Document Header Banner */}
              <div className="border-b-2 border-slate-900 pb-3 mb-5 text-center">
                <div className="text-xl font-bold tracking-wider text-slate-900">
                  {formValues['f-title'] || `【 ${activeTemplate?.name} 】`}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  SPECIFICATION FOR EQUIPMENT PROCUREMENT & INSTALLATION
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs mb-6 border border-slate-300 rounded p-3 bg-slate-50/50">
                <div className="space-y-1.5">
                  <div className="flex">
                    <span className="w-24 text-slate-500 font-medium">工事・件名:</span>
                    <span className="font-bold text-slate-900 flex-1">
                      {formValues['f-project-name'] || '令和8年度 設備工事'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-slate-500 font-medium">仕様書番号:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formValues['f-docno'] || 'SPEC-2026-001'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex">
                    <span className="w-20 text-slate-500 font-medium">発行年月日:</span>
                    <span className="font-mono text-slate-800">
                      {formValues['f-date'] || new Date().toISOString().slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-20 text-slate-500 font-medium">発行元:</span>
                    <span className="text-slate-800 font-medium">
                      {formValues['f-issuer'] || '設計担当課'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1: Requirements & Checkbox List */}
              <div className="mb-6">
                <div className="text-xs font-bold text-slate-900 bg-slate-100 border-l-4 border-slate-900 px-2 py-1 mb-2">
                  1. 適用要件・指定仕様 (チェック項目・選択条件)
                </div>

                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <tbody>
                    {/* Render Spec Selects */}
                    {specFields.map(field => (
                      <tr key={field.id} className="border-b border-slate-200">
                        <td className="w-36 bg-slate-50 p-2 font-medium text-slate-700 border-r border-slate-300">
                          {field.label}
                        </td>
                        <td className="p-2 font-semibold text-slate-900">
                          {formValues[field.id] || '-'}
                        </td>
                      </tr>
                    ))}

                    {/* Render Checkboxes */}
                    {checkFields.map(field => {
                      const isChecked = Boolean(formValues[field.id]);
                      const cfg = field.checkboxConfig;
                      const outputText = isChecked 
                        ? (cfg?.checkedValue || '☑ 要') 
                        : (cfg?.uncheckedValue || '☐ 不要');

                      return (
                        <tr key={field.id} className="border-b border-slate-200">
                          <td className="w-36 bg-slate-50 p-2 font-medium text-slate-700 border-r border-slate-300">
                            {field.label}
                          </td>
                          <td className="p-2">
                            <span className={`inline-flex items-center gap-1 font-mono font-semibold ${
                              isChecked ? 'text-indigo-900' : 'text-slate-500'
                            }`}>
                              {outputText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Section 2: Equipment Detail Table */}
              <div className="mb-6">
                <div className="text-xs font-bold text-slate-900 bg-slate-100 border-l-4 border-slate-900 px-2 py-1 mb-2 flex items-center justify-between">
                  <span>2. 対象機器・調達品目明細 ({activeItems.length}件)</span>
                  <span className="text-[10px] font-normal text-slate-500 font-mono">
                    MASTER TEMPLATE EMBEDDED
                  </span>
                </div>

                <table className="w-full text-xs border border-slate-900 border-collapse">
                  <thead className="bg-slate-200 text-slate-900 font-bold border-b border-slate-900">
                    <tr>
                      <th className="p-2 border-r border-slate-300 text-center w-16">機器番号</th>
                      <th className="p-2 border-r border-slate-300 text-left">機器名</th>
                      <th className="p-2 border-r border-slate-300 text-left">口径・仕様</th>
                      <th className="p-2 border-r border-slate-300 text-center w-20">材質</th>
                      <th className="p-2 border-r border-slate-300 text-right w-16">数量</th>
                      <th className="p-2 border-r border-slate-300 text-center w-24">納入時期</th>
                      <th className="p-2 text-left">備考・特記事項</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          機器が選択されていません。左のリストで対象機器をチェックしてください。
                        </td>
                      </tr>
                    ) : (
                      activeItems.map((item, idx) => {
                        const specSummary = item.specs && item.specs.length > 0
                          ? item.specs.map(s => `${s.name}: ${s.value}${s.unit ? ' ' + s.unit : ''}`).join(', ')
                          : (item.diameter && item.diameter !== '-' ? `口径: ${item.diameter}` : '-');

                        return (
                          <tr key={item.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : ''}>
                            <td className="p-2 border-r border-slate-300 font-mono text-center font-semibold">
                              {item.tagNo || '-'}
                            </td>
                            <td className="p-2 border-r border-slate-300 font-bold text-slate-900">
                              {item.name}
                            </td>
                            <td className="p-2 border-r border-slate-300 font-mono text-[11px] text-slate-700">
                              {specSummary}
                            </td>
                            <td className="p-2 border-r border-slate-300 text-center font-mono text-[11px]">
                              {item.material || '-'}
                            </td>
                            <td className="p-2 border-r border-slate-300 text-right font-mono font-bold">
                              {item.quantity} {item.unit || '台'}
                            </td>
                            <td className="p-2 border-r border-slate-300 text-center font-mono text-[11px]">
                              {item.deliveryDate || '-'}
                            </td>
                            <td className="p-2 text-[11px] text-slate-600">
                              {item.notes || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Section 3: Special Notes Box (E30 / B23) */}
              <div>
                <div className="text-xs font-bold text-slate-900 bg-slate-100 border-l-4 border-slate-900 px-2 py-1 mb-2">
                  3. 特記事項・指示事項
                </div>
                <div className="border border-slate-300 rounded p-3 text-xs leading-relaxed text-slate-800 bg-slate-50/30 whitespace-pre-line min-h-[80px]">
                  {formValues['f-notes'] || activeTemplate?.notesTemplate || '特記事項なし'}
                </div>
              </div>

              {/* Official Seal / Signatures placeholder */}
              <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-400">
                <span>SpecForge Engineered Specification System · Form Zero-Break Output</span>
                <span>承認印: ＿＿＿＿＿＿　検印: ＿＿＿＿＿＿　担当: ＿＿＿＿＿＿</span>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
