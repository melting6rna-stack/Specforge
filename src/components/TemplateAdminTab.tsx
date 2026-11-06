import React, { useState, useRef } from 'react';
import { 
  Settings2, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Save, 
  FileText, 
  ShieldCheck,
  AlertCircle,
  Table,
  Target,
  FileCheck2,
  Copy,
  CheckSquare,
  List,
  Calendar,
  Layers,
  ArrowRight,
  HardDrive
} from 'lucide-react';
import { SpecTemplate, SpecFieldMapping, TableColumnMapping, SpecMappingAssetFile } from '../types';
import { exportMappingAssetAsJson, importMappingAssetFromJson, createDefaultMasterWorkbook } from '../utils/exceljsEngine';

interface TemplateAdminTabProps {
  templates: SpecTemplate[];
  onUpdateTemplates: (updated: SpecTemplate[]) => void;
  activeTemplateId?: string;
  onSelectTemplate?: (id: string) => void;
}

export const TemplateAdminTab: React.FC<TemplateAdminTabProps> = ({
  templates,
  onUpdateTemplates,
  activeTemplateId,
  onSelectTemplate
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    activeTemplateId || templates[0]?.id || ''
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<SpecTemplate | null>(null);
  const [activeTabSub, setActiveTabSub] = useState<'fields' | 'table' | 'asset'>('fields');
  const [message, setMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const jsonAssetInputRef = useRef<HTMLInputElement | null>(null);

  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Start editing a template
  const handleStartEdit = (tpl: SpecTemplate) => {
    const clone: SpecTemplate = JSON.parse(JSON.stringify(tpl));
    if (!clone.fields) clone.fields = [];
    if (!clone.tableMapping) {
      clone.tableMapping = {
        startRow: 15,
        targetSheetName: '仕様書',
        tagNoCol: 'B',
        nameCol: 'C',
        diameterCol: 'D',
        materialCol: 'E',
        quantityCol: 'F',
        deliveryDateCol: 'G',
        notesCol: 'H'
      };
    }
    setEditingTemplate(clone);
    setIsEditing(true);
  };

  // Save template modifications
  const handleSaveEdit = () => {
    if (!editingTemplate) return;
    const updated = templates.map(t => t.id === editingTemplate.id ? { ...editingTemplate, updatedAt: new Date().toISOString().slice(0, 10) } : t);
    onUpdateTemplates(updated);
    setIsEditing(false);
    setMessage(`テンプレート「${editingTemplate.name}」の設定とマッピングを保存しました。`);
    setTimeout(() => setMessage(''), 4000);
  };

  // Create new template
  const handleCreateNewTemplate = () => {
    const newId = `tpl-custom-${Date.now()}`;
    const newTemplate: SpecTemplate = {
      id: newId,
      code: `SPEC-CUSTOM-${Math.floor(100 + Math.random() * 900)}`,
      name: '新規仕様書 テンプレート',
      description: 'セル番地マッピングおよびチェック項目を定義した新規仕様書',
      columns: ['機器番号', '機器名', '仕様', '数量', '納期'],
      inspectionStandard: '受入検査を実施すること。',
      warrantyPeriod: '引渡日より1年間。',
      deliveryTerms: '車上渡し。',
      notesTemplate: '特記事項なし。',
      sourceType: 'custom_excel',
      fields: [
        { id: `f-${Date.now()}-1`, label: '仕様書標題', cell: 'B2', type: 'text', group: 'basic', defaultValue: '【 新規仕様書 】' },
        { id: `f-${Date.now()}-2`, label: '工事・件名', cell: 'C5', type: 'text', group: 'basic', defaultValue: '設備工事' },
        { id: `f-${Date.now()}-3`, label: '耐圧検査成績書提出', cell: 'C8', type: 'checkbox', group: 'check', defaultValue: true, checkboxConfig: { checkedValue: '☑ 要', uncheckedValue: '☐ 不要', labelTrue: '要', labelFalse: '不要' } },
        { id: `f-${Date.now()}-4`, label: '塗装仕様', cell: 'C9', type: 'select', group: 'spec', options: ['標準防錆塗装', 'エポキシ樹脂塗装', '無塗装'], defaultValue: '標準防錆塗装' },
        { id: `f-${Date.now()}-5`, label: '特記事項', cell: 'B23', type: 'textarea', group: 'notes', defaultValue: '特記事項なし。' }
      ],
      tableMapping: {
        startRow: 15,
        targetSheetName: '仕様書',
        tagNoCol: 'B',
        nameCol: 'C',
        diameterCol: 'D',
        materialCol: 'E',
        quantityCol: 'F',
        deliveryDateCol: 'G',
        notesCol: 'H'
      },
      updatedAt: new Date().toISOString().slice(0, 10)
    };

    onUpdateTemplates([newTemplate, ...templates]);
    setSelectedTemplateId(newId);
    handleStartEdit(newTemplate);
  };

  // Duplicate current template
  const handleDuplicateTemplate = (tpl: SpecTemplate) => {
    const newId = `tpl-copy-${Date.now()}`;
    const duplicated: SpecTemplate = {
      ...JSON.parse(JSON.stringify(tpl)),
      id: newId,
      code: `${tpl.code}-COPY`,
      name: `${tpl.name} (複製)`,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    onUpdateTemplates([duplicated, ...templates]);
    setSelectedTemplateId(newId);
    handleStartEdit(duplicated);
  };

  // Upload Master Excel Template (.xlsx)
  const handleUploadMasterExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        if (editingTemplate) {
          setEditingTemplate({
            ...editingTemplate,
            masterFileName: file.name,
            masterWorkbookBase64: base64,
            rawWorkbookBase64: base64
          });
        } else {
          const updated = templates.map(t => {
            if (t.id === selectedTemplateId) {
              return {
                ...t,
                masterFileName: file.name,
                masterWorkbookBase64: base64,
                rawWorkbookBase64: base64
              };
            }
            return t;
          });
          onUpdateTemplates(updated);
        }

        setMessage(`マスター雛形Excel「${file.name}」を取り込みました。ExcelJSによる書式保持流し込みが有効です。`);
        setTimeout(() => setMessage(''), 5000);
      } catch (err: any) {
        setErrorMessage(`マスター雛形の読み込みに失敗しました: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Export Mapping Definition Asset (JSON)
  const handleExportAsset = (tpl: SpecTemplate) => {
    exportMappingAssetAsJson(tpl);
    setMessage(`マッピング定義アセット（.specmap.json）を出力しました。他ユーザーへ配布可能です。`);
    setTimeout(() => setMessage(''), 4000);
  };

  // Import Mapping Definition Asset (JSON)
  const handleImportAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const jsonStr = evt.target?.result as string;
        const asset: SpecMappingAssetFile = importMappingAssetFromJson(jsonStr);

        const newTemplate: SpecTemplate = {
          id: asset.templateId || `tpl-${Date.now()}`,
          code: asset.templateCode || 'SPEC-IMPORTED',
          name: asset.templateName || file.name.replace('.specmap.json', ''),
          description: asset.description || '外部からインポートされたマッピング定義仕様書',
          targetCategoryName: asset.targetCategoryName || '汎用',
          columns: ['機器番号', '機器名', '仕様', '材質', '数量', '納期', '特記事項'],
          inspectionStandard: '基準に準拠。',
          warrantyPeriod: '1年間。',
          deliveryTerms: '車上渡し。',
          notesTemplate: '特記事項なし。',
          sourceType: 'custom_excel',
          fields: asset.fields || [],
          tableMapping: asset.tableMapping,
          masterFileName: asset.masterFileName,
          masterWorkbookBase64: asset.masterWorkbookBase64,
          rawWorkbookBase64: asset.masterWorkbookBase64,
          updatedAt: new Date().toISOString().slice(0, 10)
        };

        const existingIndex = templates.findIndex(t => t.id === newTemplate.id);
        let nextTemplates: SpecTemplate[];
        if (existingIndex >= 0) {
          nextTemplates = templates.map((t, i) => i === existingIndex ? newTemplate : t);
        } else {
          nextTemplates = [newTemplate, ...templates];
        }

        onUpdateTemplates(nextTemplates);
        setSelectedTemplateId(newTemplate.id);
        setMessage(`マッピング定義アセット「${file.name}」を正常に取り込みました。`);
        setTimeout(() => setMessage(''), 5000);
      } catch (err: any) {
        setErrorMessage(`マッピング定義のインポートに失敗しました: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Download Sample Master Excel
  const handleDownloadSampleMaster = async (tpl: SpecTemplate) => {
    const buffer = await createDefaultMasterWorkbook(tpl);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `マスター雛形_${tpl.name}_E30セル対応.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Field manipulation helpers for editingTemplate
  const handleAddField = () => {
    if (!editingTemplate) return;
    const newField: SpecFieldMapping = {
      id: `f-${Date.now()}`,
      label: '新規項目',
      cell: 'C11',
      type: 'text',
      group: 'spec',
      defaultValue: '',
      description: ''
    };
    setEditingTemplate({
      ...editingTemplate,
      fields: [...(editingTemplate.fields || []), newField]
    });
  };

  const handleUpdateField = (fieldId: string, patch: Partial<SpecFieldMapping>) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: (editingTemplate.fields || []).map(f => f.id === fieldId ? { ...f, ...patch } : f)
    });
  };

  const handleDeleteField = (fieldId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: (editingTemplate.fields || []).filter(f => f.id !== fieldId)
    });
  };

  const activeTpl = isEditing ? editingTemplate! : currentTemplate;

  return (
    <div className="space-y-4">
      
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900">
              仕様書テンプレート ＆ セルマッピング管理 (管理者用)
            </h1>
            <span className="text-[10px] bg-slate-900 text-white font-mono px-2 py-0.5 rounded font-bold">
              ADMIN MODE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            マスター雛形Excelのアップロード、セル番地（B2, C8, E30等）の流し込み定義、チェック項目および選択肢の設定を一元管理します。
          </p>
        </div>

        {/* Global Admin Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Import Mapping Asset JSON */}
          <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>マッピング定義 (JSON) を読込</span>
            <input
              type="file"
              ref={jsonAssetInputRef}
              accept=".json,.specmap.json"
              onChange={handleImportAsset}
              className="hidden"
            />
          </label>

          {/* Export Current Asset */}
          <button
            onClick={() => handleExportAsset(currentTemplate)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="現在のマッピング定義をJSONアセットとして書き出し"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>マッピング定義をJSON出力</span>
          </button>

          <button
            onClick={handleCreateNewTemplate}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新規テンプレート作成</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-600 text-white text-xs py-2 px-4 rounded-lg shadow-xs flex items-center justify-between animate-in fade-in">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-white hover:text-emerald-200">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-600 text-white text-xs py-2 px-4 rounded-lg shadow-xs flex items-center justify-between animate-in fade-in">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-white hover:text-red-200">✕</button>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Template List (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
            <div className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>登録テンプレート一覧</span>
              <span className="text-[10px] font-mono text-slate-400">{templates.length}件</span>
            </div>

            <div className="space-y-1.5">
              {templates.map(tpl => {
                const isSelected = tpl.id === selectedTemplateId;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setIsEditing(false);
                      setEditingTemplate(null);
                    }}
                    className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-2xs font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{tpl.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{tpl.code}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal mt-1 flex items-center gap-1.5">
                      <span>項目: {tpl.fields?.length || 0}個</span>
                      <span>•</span>
                      <span>明細行: {tpl.tableMapping?.startRow || 15}行目〜</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Template Detail & Mapping Editor (9 cols) */}
        <div className="lg:col-span-9 space-y-4">
          
          {/* Header Card for Selected Template */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{activeTpl.name}</span>
                  <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {activeTpl.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {activeTpl.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>マッピング設定を保存</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleDuplicateTemplate(activeTpl)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>複製</span>
                    </button>
                    <button
                      onClick={() => handleStartEdit(activeTpl)}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>マッピングを編集</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Master Template Excel File Status */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>マスター雛形Excel:</span>
                    <span className="font-mono text-emerald-700">
                      {activeTpl.masterFileName || activeTpl.originalFileName || 'システム内蔵高品位マスター雛形 (ExcelJS)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    共有フォルダの原本は保護され、メモリ内で安全にコピー作成した上で値を流し込みます。
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors flex items-center gap-1 cursor-pointer shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>雛形Excel差替</span>
                  <input
                    type="file"
                    ref={excelInputRef}
                    accept=".xlsx"
                    onChange={handleUploadMasterExcel}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => handleDownloadSampleMaster(activeTpl)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  title="マスター雛形Excelをダウンロードして手元で書式を確認"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>雛形DL</span>
                </button>
              </div>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-slate-200 pt-1 text-xs">
              <button
                onClick={() => setActiveTabSub('fields')}
                className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTabSub === 'fields'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>セル番地マッピング・チェック項目定義 ({activeTpl.fields?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTabSub('table')}
                className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTabSub === 'table'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>明細テーブル列マッピング</span>
              </button>
              <button
                onClick={() => setActiveTabSub('asset')}
                className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTabSub === 'asset'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>マッピング定義アセット JSON</span>
              </button>
            </div>
          </div>

          {/* Sub Tab 1: Fields & Cell Address Mapping */}
          {activeTabSub === 'fields' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    入力項目 ＆ セル番地マッピング一覧
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    一般ユーザー画面にはセル番地は隠蔽され、ラベルとフォームコントロール（テキスト、プルダウン、チェック）のみが表示されます。
                  </p>
                </div>

                {isEditing && (
                  <button
                    onClick={handleAddField}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>項目を追加</span>
                  </button>
                )}
              </div>

              {/* Fields Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-36">項目ラベル (画面表示)</th>
                      <th className="p-2 w-24">セル番地</th>
                      <th className="p-2 w-28">入力形式</th>
                      <th className="p-2">設定（プルダウン選択肢 / チェック流し込み値）</th>
                      <th className="p-2 w-20">グループ</th>
                      {isEditing && <th className="p-2 text-right w-14">操作</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeTpl.fields || []).map((field, idx) => {
                      if (!isEditing) {
                        return (
                          <tr key={field.id} className="hover:bg-slate-50/70">
                            <td className="p-2 font-semibold text-slate-900">
                              {field.label}
                            </td>
                            <td className="p-2 font-mono font-bold text-indigo-700">
                              {field.cell}
                            </td>
                            <td className="p-2">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                                {field.type === 'checkbox' ? '☑ チェック' : field.type === 'select' ? '▼ プルダウン' : field.type === 'textarea' ? '¶ 複数行' : 'テキスト'}
                              </span>
                            </td>
                            <td className="p-2 text-[11px] text-slate-600">
                              {field.type === 'checkbox' ? (
                                <div className="font-mono text-slate-700">
                                  ON: <span className="text-emerald-700 font-semibold">{field.checkboxConfig?.checkedValue || '☑ 要'}</span> / 
                                  OFF: <span className="text-slate-400">{field.checkboxConfig?.uncheckedValue || '☐ 不要'}</span>
                                </div>
                              ) : field.type === 'select' ? (
                                <div className="text-slate-600 truncate max-w-xs">
                                  選択肢 ({field.options?.length || 0}個): {field.options?.join(', ')}
                                </div>
                              ) : (
                                <div className="text-slate-400 italic">
                                  初期値: {String(field.defaultValue || '-')}
                                </div>
                              )}
                            </td>
                            <td className="p-2 text-[11px] font-mono text-slate-500">
                              {field.group || 'basic'}
                            </td>
                          </tr>
                        );
                      }

                      // Edit mode row
                      return (
                        <tr key={field.id} className="bg-indigo-50/20 hover:bg-indigo-50/40">
                          <td className="p-2">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={field.cell}
                              onChange={(e) => handleUpdateField(field.id, { cell: e.target.value.toUpperCase() })}
                              className="w-full text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2 py-1 text-indigo-800"
                              placeholder="C8, E30..."
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={field.type}
                              onChange={(e) => {
                                const newType = e.target.value as any;
                                const patch: Partial<SpecFieldMapping> = { type: newType };
                                if (newType === 'checkbox' && !field.checkboxConfig) {
                                  patch.checkboxConfig = {
                                    checkedValue: '☑ 要',
                                    uncheckedValue: '☐ 不要',
                                    labelTrue: '要',
                                    labelFalse: '不要'
                                  };
                                } else if (newType === 'select' && (!field.options || field.options.length === 0)) {
                                  patch.options = ['選択肢1', '選択肢2'];
                                }
                                handleUpdateField(field.id, patch);
                              }}
                              className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 cursor-pointer"
                            >
                              <option value="text">テキスト</option>
                              <option value="textarea">複数行テキスト</option>
                              <option value="select">プルダウン選択</option>
                              <option value="checkbox">チェック形式</option>
                              <option value="date">日付</option>
                            </select>
                          </td>
                          <td className="p-2">
                            {field.type === 'checkbox' ? (
                              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                <div>
                                  <span className="text-[10px] text-slate-500 block">ON時の書き込み値:</span>
                                  <input
                                    type="text"
                                    value={field.checkboxConfig?.checkedValue ?? '☑ 要'}
                                    onChange={(e) => handleUpdateField(field.id, {
                                      checkboxConfig: {
                                        checkedValue: e.target.value,
                                        uncheckedValue: field.checkboxConfig?.uncheckedValue || '☐ 不要',
                                        labelTrue: field.checkboxConfig?.labelTrue || '要',
                                        labelFalse: field.checkboxConfig?.labelFalse || '不要'
                                      }
                                    })}
                                    className="w-full text-xs bg-white border border-emerald-300 rounded px-1.5 py-0.5"
                                  />
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500 block">OFF時の書き込み値:</span>
                                  <input
                                    type="text"
                                    value={field.checkboxConfig?.uncheckedValue ?? '☐ 不要'}
                                    onChange={(e) => handleUpdateField(field.id, {
                                      checkboxConfig: {
                                        checkedValue: field.checkboxConfig?.checkedValue || '☑ 要',
                                        uncheckedValue: e.target.value,
                                        labelTrue: field.checkboxConfig?.labelTrue || '要',
                                        labelFalse: field.checkboxConfig?.labelFalse || '不要'
                                      }
                                    })}
                                    className="w-full text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5"
                                  />
                                </div>
                              </div>
                            ) : field.type === 'select' ? (
                              <div>
                                <span className="text-[10px] text-slate-500 block">選択肢 (カンマ区切り):</span>
                                <input
                                  type="text"
                                  value={field.options?.join(', ') || ''}
                                  onChange={(e) => handleUpdateField(field.id, {
                                    options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                  })}
                                  className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1"
                                  placeholder="選択肢A, 選択肢B, 選択肢C..."
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="text-[10px] text-slate-500 block">初期値:</span>
                                <input
                                  type="text"
                                  value={String(field.defaultValue ?? '')}
                                  onChange={(e) => handleUpdateField(field.id, { defaultValue: e.target.value })}
                                  className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1"
                                />
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            <select
                              value={field.group || 'basic'}
                              onChange={(e) => handleUpdateField(field.id, { group: e.target.value as any })}
                              className="w-full text-xs bg-white border border-slate-300 rounded px-1.5 py-1"
                            >
                              <option value="basic">基本情報</option>
                              <option value="spec">仕様条件</option>
                              <option value="check">チェック要件</option>
                              <option value="notes">特記事項</option>
                            </select>
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => handleDeleteField(field.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                              title="項目を削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab 2: Table Column Mapping */}
          {activeTabSub === 'table' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-900">
                  機器一覧 明細テーブル書き込み設定 (ExcelJS対応)
                </h2>
                <p className="text-[11px] text-slate-500">
                  マスター雛形Excel内で機器リストが流し込まれる開始行と、各項目の列アルファベットを指定します。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    対象ワークシート名 (省略時は第1シート)
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={activeTpl.tableMapping?.targetSheetName || '仕様書'}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({
                          ...editingTemplate,
                          tableMapping: {
                            ...editingTemplate.tableMapping!,
                            targetSheetName: e.target.value
                          }
                        });
                      }
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    明細書き込み開始行 (1行目にヘッダーがある場合のデータ行)
                  </label>
                  <input
                    type="number"
                    disabled={!isEditing}
                    value={activeTpl.tableMapping?.startRow || 15}
                    onChange={(e) => {
                      if (editingTemplate) {
                        setEditingTemplate({
                          ...editingTemplate,
                          tableMapping: {
                            ...editingTemplate.tableMapping!,
                            startRow: parseInt(e.target.value, 10) || 15
                          }
                        });
                      }
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono disabled:opacity-75"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-[11px] font-bold text-slate-800 mb-2">
                  各列のアルファベット指定:
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { key: 'tagNoCol', label: '機器番号 列', defaultCol: 'B' },
                    { key: 'nameCol', label: '機器名 列', defaultCol: 'C' },
                    { key: 'diameterCol', label: '口径・仕様 列', defaultCol: 'D' },
                    { key: 'materialCol', label: '材質 列', defaultCol: 'E' },
                    { key: 'quantityCol', label: '数量 列', defaultCol: 'F' },
                    { key: 'deliveryDateCol', label: '納期 列', defaultCol: 'G' },
                    { key: 'notesCol', label: '特記事項 列', defaultCol: 'H' },
                  ].map(colItem => (
                    <div key={colItem.key}>
                      <span className="text-[10px] text-slate-500 block mb-0.5">{colItem.label}</span>
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={(activeTpl.tableMapping as any)?.[colItem.key] || colItem.defaultCol}
                        onChange={(e) => {
                          if (editingTemplate) {
                            setEditingTemplate({
                              ...editingTemplate,
                              tableMapping: {
                                ...editingTemplate.tableMapping!,
                                [colItem.key]: e.target.value.toUpperCase()
                              }
                            });
                          }
                        }}
                        className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded px-2 py-1 text-center disabled:opacity-75 uppercase"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab 3: JSON Asset View */}
          {activeTabSub === 'asset' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    マッピング定義アセット JSON
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    このJSONファイルを保存・エクスポートすることで、他のエンジニアや他システムと完全に同じ仕様書レイアウトを共有できます。
                  </p>
                </div>
                <button
                  onClick={() => handleExportAsset(activeTpl)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.specmap.json をダウンロード</span>
                </button>
              </div>

              <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto max-h-96">
                <pre>{JSON.stringify({
                  version: '1.0',
                  schemaType: 'specforge-mapping-asset',
                  templateId: activeTpl.id,
                  templateName: activeTpl.name,
                  templateCode: activeTpl.code,
                  fields: activeTpl.fields || [],
                  tableMapping: activeTpl.tableMapping,
                  masterFileName: activeTpl.masterFileName || activeTpl.originalFileName
                }, null, 2)}</pre>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
