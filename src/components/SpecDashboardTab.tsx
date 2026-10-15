import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Check, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  ShieldCheck,
  Building,
  Calendar,
  Layers,
  Filter
} from 'lucide-react';
import { EquipmentItem, SpecTemplate, Category } from '../types';
import { exportEquipmentSpecToExcel } from '../utils/excelExporter';

interface SpecDashboardTabProps {
  items: EquipmentItem[];
  categories: Category[];
  templates: SpecTemplate[];
  activeProjectId: string;
}

export const SpecDashboardTab: React.FC<SpecDashboardTabProps> = ({
  items,
  categories,
  templates,
  activeProjectId,
}) => {
  const projectItems = useMemo(() => items.filter(it => it.projectId === activeProjectId), [items, activeProjectId]);

  // Selected Items State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [filterCatId, setFilterCatId] = useState<string>('all');

  useEffect(() => {
    // Default to select all items initially
    setSelectedItemIds(projectItems.map(it => it.id));
  }, [projectItems]);

  const activeItems = useMemo(() => {
    return projectItems.filter(it => selectedItemIds.includes(it.id));
  }, [projectItems, selectedItemIds]);

  // Selected Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Document Info
  const [docInfo, setDocInfo] = useState({
    title: '工場配管・設備機器 調達仕様書',
    documentNo: `SPEC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    version: '1.0',
    issueDate: new Date().toISOString().slice(0, 10),
    issuerCompany: '株式会社プラントエンジニアリング',
    issuerAuthor: '設計担当',
    approverName: '技術部長',
    clientCompany: '製造・調達パートナー御中',
    inspectionStandard: '',
    deliveryTerms: '',
    warrantyPeriod: '',
    notes: '',
  });

  useEffect(() => {
    if (activeTemplate) {
      setDocInfo(prev => ({
        ...prev,
        inspectionStandard: activeTemplate.inspectionStandard,
        deliveryTerms: activeTemplate.deliveryTerms,
        warrantyPeriod: activeTemplate.warrantyPeriod,
        notes: activeTemplate.notesTemplate,
      }));
    }
  }, [activeTemplate]);

  // Zoom
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // Toggle select all
  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedItemIds(projectItems.map(i => i.id));
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleExportExcel = () => {
    if (!activeTemplate) return;
    exportEquipmentSpecToExcel(
      {
        documentNo: docInfo.documentNo,
        title: docInfo.title,
        version: docInfo.version,
        issueDate: docInfo.issueDate,
        issuerCompany: docInfo.issuerCompany,
        issuerAuthor: docInfo.issuerAuthor,
        approverName: docInfo.approverName,
        clientCompany: docInfo.clientCompany,
        inspectionStandard: docInfo.inspectionStandard,
        deliveryTerms: docInfo.deliveryTerms,
        warrantyPeriod: docInfo.warrantyPeriod,
        notes: docInfo.notes
      },
      activeItems,
      activeTemplate
    );
  };

  const handlePrint = () => {
    window.print();
  };

  // Compile revision history for official table
  const allHistories = useMemo(() => {
    const list: { date: string; tag: string; name: string; field: string; diff: string; reason: string; author: string }[] = [];
    activeItems.forEach(it => {
      (it.history || []).forEach(h => {
        list.push({
          date: h.timestamp,
          tag: it.tagNo || '-',
          name: it.name,
          field: h.fieldLabel || h.field,
          diff: `${h.oldValue} → ${h.newValue}`,
          reason: h.reason,
          author: h.author
        });
      });
    });
    return list;
  }, [activeItems]);

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">仕様書プレビュー・出力ダッシュボード</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            データベースから機器を選択し、テンプレートに応じた正式仕様書のプレビュー確認とExcel出力を行います。
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Excel出力 (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>印刷 / PDF出力</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left Clean Settings & Right Live A4 Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Simple & Uncluttered Control Panel (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          
          {/* 1. Target Equipment Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-600" />
                <span>1. 仕様書に含める機器の選択</span>
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-indigo-600 hover:underline"
                >
                  全選択
                </button>
                <span className="text-slate-300">/</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-slate-500 hover:underline"
                >
                  解除
                </button>
              </div>
            </div>

            {/* Quick Category Filter */}
            <div className="flex items-center gap-1 text-[11px] text-slate-500 pb-1 border-b border-slate-100">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>絞込:</span>
              <select
                value={filterCatId}
                onChange={(e) => setFilterCatId(e.target.value)}
                className="bg-transparent text-[11px] text-slate-700 focus:outline-hidden"
              >
                <option value="all">全カテゴリ ({projectItems.length})</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Item checklist */}
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {projectItems
                .filter(it => filterCatId === 'all' || it.categoryId === filterCatId)
                .map(item => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 text-xs text-slate-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItemIds(prev => [...prev, item.id]);
                        } else {
                          setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                        }
                      }}
                      className="mt-0.5 rounded text-slate-900 focus:ring-slate-900"
                    />
                    <div className="flex-1 truncate">
                      <div className="flex items-center gap-1.5 font-medium">
                        {item.tagNo && <span className="font-mono text-slate-500">[{item.tagNo}]</span>}
                        <span className="text-slate-900 truncate">{item.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {item.diameter || '-'} · {item.material || '-'} · {item.quantity}{item.unit || '台'}
                      </div>
                    </div>
                  </label>
                ))}
            </div>

            <div className="text-[11px] text-slate-500 pt-1 text-right">
              選択中: <strong className="text-slate-900">{activeItems.length}</strong> / {projectItems.length} 点
            </div>
          </div>

          {/* 2. Template Selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
            <span className="text-xs font-bold text-slate-900 block">
              2. 適用テンプレートの選択
            </span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            >
              {templates.map(tpl => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} {tpl.sourceType === 'custom_excel' ? '(取込Excel)' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              {activeTemplate?.description}
            </p>
          </div>

          {/* 3. Document Details */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5 text-xs">
            <span className="text-xs font-bold text-slate-900 block">
              3. 仕様書標題・文書情報
            </span>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-600 block mb-0.5">仕様書標題</label>
                <input
                  type="text"
                  value={docInfo.title}
                  onChange={(e) => setDocInfo(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-slate-300 rounded p-1.5 font-medium text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">文書管理番号</label>
                  <input
                    type="text"
                    value={docInfo.documentNo}
                    onChange={(e) => setDocInfo(p => ({ ...p, documentNo: e.target.value }))}
                    className="w-full border border-slate-300 rounded p-1.5 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">改訂番号 (Rev)</label>
                  <input
                    type="text"
                    value={docInfo.version}
                    onChange={(e) => setDocInfo(p => ({ ...p, version: e.target.value }))}
                    className="w-full border border-slate-300 rounded p-1.5 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">発行元 / 作成者</label>
                  <input
                    type="text"
                    value={docInfo.issuerAuthor}
                    onChange={(e) => setDocInfo(p => ({ ...p, issuerAuthor: e.target.value }))}
                    className="w-full border border-slate-300 rounded p-1.5 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-600 block mb-0.5">承認者役職・氏名</label>
                  <input
                    type="text"
                    value={docInfo.approverName}
                    onChange={(e) => setDocInfo(p => ({ ...p, approverName: e.target.value }))}
                    className="w-full border border-slate-300 rounded p-1.5 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live A4 Specification Document Preview (8 cols) */}
        <div className="xl:col-span-8 space-y-3">
          
          {/* Preview Toolbar */}
          <div className="bg-slate-900 text-white p-2.5 rounded-t-xl flex items-center justify-between text-xs shadow-2xs no-print">
            <div className="flex items-center gap-2 font-medium">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span>A4 仕様書プレビュー</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom */}
              <div className="flex items-center gap-1 bg-slate-800 rounded px-1.5 py-0.5 text-slate-300">
                <button
                  type="button"
                  onClick={() => setPreviewZoom(z => Math.max(z - 15, 60))}
                  className="hover:text-white p-0.5"
                  title="縮小"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] w-9 text-center tabular-nums">{previewZoom}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(z => Math.min(z + 15, 140))}
                  className="hover:text-white p-0.5"
                  title="拡大"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel出力</span>
              </button>
            </div>
          </div>

          {/* Scalable Container for A4 Paper */}
          <div className="bg-slate-200/80 rounded-b-xl p-4 sm:p-6 overflow-x-auto flex justify-center min-h-[750px] border border-t-0 border-slate-300">
            <div 
              style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}
              className="transition-transform duration-150 ease-out"
            >
              {/* A4 Paper Canvas */}
              <div className="print-page w-[794px] min-h-[1123px] bg-white text-slate-900 shadow-xl border border-slate-300 p-10 font-sans text-xs relative space-y-6">
                
                {/* 1. Document Header */}
                <div className="border-b-2 border-slate-900 pb-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono mb-2">
                    <div>文書管理番号: <strong className="text-slate-900">{docInfo.documentNo}</strong></div>
                    <div>版数: <strong className="text-slate-900">Rev {docInfo.version}</strong> / 発行日: {docInfo.issueDate}</div>
                  </div>

                  <div className="flex items-start justify-between gap-4 mt-2">
                    <div className="flex-1">
                      <div className="text-[11px] text-slate-500 font-semibold tracking-wider">
                        【 {activeTemplate?.name} 】
                      </div>
                      <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 leading-snug">
                        {docInfo.title}
                      </h1>
                    </div>

                    {/* Official Stamp Box (承認印枠) */}
                    <div className="border border-slate-400 grid grid-cols-2 text-center text-[10px] w-36 shrink-0 bg-white shadow-2xs">
                      <div className="border-r border-slate-400">
                        <div className="bg-slate-100 py-0.5 border-b border-slate-400 font-semibold text-slate-700">承認</div>
                        <div className="h-12 flex items-center justify-center font-mono text-red-600 border-b border-slate-200">
                          <span className="border border-red-500 rounded-full w-9 h-9 flex items-center justify-center text-[9px] font-bold">
                            検印
                          </span>
                        </div>
                        <div className="py-0.5 text-[9px] text-slate-600 truncate">{docInfo.approverName}</div>
                      </div>

                      <div>
                        <div className="bg-slate-100 py-0.5 border-b border-slate-400 font-semibold text-slate-700">作成</div>
                        <div className="h-12 flex items-center justify-center font-mono text-red-600 border-b border-slate-200">
                          <span className="border border-red-400 rounded-full w-8 h-8 flex items-center justify-center text-[8px]">
                            作成
                          </span>
                        </div>
                        <div className="py-0.5 text-[9px] text-slate-600 truncate">{docInfo.issuerAuthor}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-700">
                    <div>
                      <span className="text-slate-500">【発行元】:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">{docInfo.issuerCompany} ({docInfo.issuerAuthor})</div>
                    </div>
                    <div>
                      <span className="text-slate-500">【納入先 / 発注先】:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">{docInfo.clientCompany}</div>
                    </div>
                  </div>
                </div>

                {/* 2. Target Items Table (Focused on 機器名, 口径, 材質, 数量, 納期) */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-900 border-l-3 border-slate-900 pl-2">
                    1. 対象機器・調達仕様一覧
                  </div>

                  <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300">
                      <tr>
                        <th className="py-1.5 px-2 border-r border-slate-300">機器番号</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">機器名</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">口径 (サイズ)</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">材質</th>
                        <th className="py-1.5 px-2 text-right border-r border-slate-300">数量</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">納期</th>
                        <th className="py-1.5 px-2">備考</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeItems.map((item) => (
                        <tr key={item.id}>
                          <td className="py-1.5 px-2 font-mono border-r border-slate-200 font-semibold whitespace-nowrap">
                            {item.tagNo || '-'}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-200 font-medium">
                            {item.name}
                          </td>
                          <td className="py-1.5 px-2 font-mono border-r border-slate-200 whitespace-nowrap">
                            {item.diameter || '-'}
                          </td>
                          <td className="py-1.5 px-2 font-mono border-r border-slate-200 whitespace-nowrap">
                            {item.material || '-'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums border-r border-slate-200 font-semibold whitespace-nowrap">
                            {item.quantity} {item.unit || '台'}
                          </td>
                          <td className="py-1.5 px-2 font-mono border-r border-slate-200 whitespace-nowrap">
                            {item.deliveryDate || '-'}
                          </td>
                          <td className="py-1.5 px-2 text-slate-600 truncate max-w-[150px]">
                            {item.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3. Inspection, Delivery & Warranty Terms */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-900 border-l-3 border-slate-900 pl-2">
                    2. 検査基準・納入条件・品質保証
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-[11px] border border-slate-200 p-3 bg-slate-50/40">
                    <div>
                      <span className="font-semibold text-slate-900">【受入検査基準】:</span>
                      <p className="whitespace-pre-line text-slate-700 mt-0.5 leading-relaxed">
                        {docInfo.inspectionStandard || activeTemplate?.inspectionStandard}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-semibold text-slate-900">【納入引渡条件】:</span>
                      <p className="whitespace-pre-line text-slate-700 mt-0.5 leading-relaxed">
                        {docInfo.deliveryTerms || activeTemplate?.deliveryTerms}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-semibold text-slate-900">【品質保証期間】:</span>
                      <p className="whitespace-pre-line text-slate-700 mt-0.5 leading-relaxed">
                        {docInfo.warrantyPeriod || activeTemplate?.warrantyPeriod}
                      </p>
                    </div>

                    {(docInfo.notes || activeTemplate?.notesTemplate) && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="font-semibold text-slate-900">【特記事項・指示事項】:</span>
                        <p className="whitespace-pre-line text-slate-700 mt-0.5 leading-relaxed">
                          {docInfo.notes || activeTemplate?.notesTemplate}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Revision History Table (Audit Trail) */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-900 border-l-3 border-slate-900 pl-2 flex items-center justify-between">
                    <span>3. 改訂履歴及び変更理由記録 (監査トレーサビリティ)</span>
                    <span className="text-[10px] font-normal text-slate-500 font-mono">
                      記録件数: {allHistories.length + 1}件
                    </span>
                  </div>

                  <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300">
                      <tr>
                        <th className="py-1 px-2 border-r border-slate-300">改訂日時</th>
                        <th className="py-1 px-2 border-r border-slate-300">対象機器</th>
                        <th className="py-1 px-2 border-r border-slate-300">変更項目</th>
                        <th className="py-1 px-2 border-r border-slate-300">差分 (変更前 → 変更後)</th>
                        <th className="py-1 px-2 border-r border-slate-300">変更理由 (必須記録)</th>
                        <th className="py-1 px-2">担当者</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr className="bg-slate-50/50">
                        <td className="py-1 px-2 font-mono border-r border-slate-200">{docInfo.issueDate}</td>
                        <td className="py-1 px-2 border-r border-slate-200">仕様書全体</td>
                        <td className="py-1 px-2 border-r border-slate-200">初版発行</td>
                        <td className="py-1 px-2 border-r border-slate-200 font-mono">-</td>
                        <td className="py-1 px-2 border-r border-slate-200">新規仕様書起票・発行</td>
                        <td className="py-1 px-2">{docInfo.issuerAuthor}</td>
                      </tr>
                      {allHistories.map((h, i) => (
                        <tr key={i}>
                          <td className="py-1 px-2 font-mono border-r border-slate-200">{h.date}</td>
                          <td className="py-1 px-2 border-r border-slate-200 font-medium">[{h.tag}] {h.name}</td>
                          <td className="py-1 px-2 border-r border-slate-200">{h.field}</td>
                          <td className="py-1 px-2 border-r border-slate-200 font-mono">{h.diff}</td>
                          <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900">{h.reason}</td>
                          <td className="py-1 px-2 text-slate-600">{h.author}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer note */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>文書管理番号: {docInfo.documentNo}</span>
                  <span>SpecForge Specification Engine</span>
                </div>

              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
