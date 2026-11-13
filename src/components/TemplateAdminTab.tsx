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
  Target,
  FileCheck2,
  Copy,
  CheckSquare,
  List,
  Calendar,
  Layers,
  ArrowRight,
  HardDrive,
  AlertTriangle
} from 'lucide-react';
import { SpecTemplate, SpecFieldMapping, SpecMappingAssetFile, EquipmentItem, ProjectWorkspace } from '../types';
import { exportMappingAssetAsJson, importMappingAssetFromJson, createDefaultMasterWorkbook } from '../utils/exceljsEngine';
import { normalizeSpecTemplate } from '../utils/templateUtils';

interface TemplateAdminTabProps {
  templates: SpecTemplate[];
  onUpdateTemplates: (updated: SpecTemplate[]) => void;
  items?: EquipmentItem[];
  currentProject?: ProjectWorkspace;
  activeTemplateId?: string;
  onSelectTemplate?: (id: string) => void;
  onBackToDashboard?: () => void;
}

export const TemplateAdminTab: React.FC<TemplateAdminTabProps> = ({
  templates,
  onUpdateTemplates,
  items,
  currentProject,
  activeTemplateId,
  onSelectTemplate,
  onBackToDashboard
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    activeTemplateId || templates[0]?.id || ''
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<SpecTemplate | null>(null);
  const [activeTabSub, setActiveTabSub] = useState<'fields' | 'basic' | 'asset'>('fields');
  const [deleteTargetTpl, setDeleteTargetTpl] = useState<SpecTemplate | null>(null);
  const [message, setMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const jsonAssetInputRef = useRef<HTMLInputElement | null>(null);

  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Extract distinct specification item names registered in the equipment database
  const availableSpecNames = React.useMemo(() => {
    const set = new Set<string>();
    const baseline = [
      '口径',
      '材質',
      '流体',
      '設計圧力',
      '設計温度',
      '接続規格',
      '塗装仕様',
      '耐圧試験',
      '電動機出力',
      '電源・電圧',
      '周波数',
      '防爆構造',
      '納期',
      '特記事項'
    ];
    baseline.forEach(b => set.add(b));

    if (items) {
      for (const it of items) {
        if (it.specs && Array.isArray(it.specs)) {
          for (const sp of it.specs) {
            if (sp.name && sp.name.trim()) {
              set.add(sp.name.trim());
            }
          }
        }
      }
    }

    return Array.from(set);
  }, [items]);

  // Start editing a template
  const handleStartEdit = (tpl: SpecTemplate) => {
    const clone: SpecTemplate = normalizeSpecTemplate(JSON.parse(JSON.stringify(tpl)));
    if (!clone.fields) clone.fields = [];
    setEditingTemplate(clone);
    setIsEditing(true);
  };

  // Save template modifications
  const handleSaveEdit = () => {
    if (!editingTemplate) return;
    const cleanName = editingTemplate.name.trim() || '無題のテンプレート';
    const cleanedTpl = normalizeSpecTemplate({
      ...editingTemplate,
      name: cleanName,
      updatedAt: new Date().toISOString().slice(0, 10)
    });
    const updated = templates.map(t => t.id === cleanedTpl.id ? cleanedTpl : t);
    onUpdateTemplates(updated);
    setIsEditing(false);
    setEditingTemplate(null);
    setMessage(`テンプレート「${cleanedTpl.name}」の設定とマッピングを保存しました。`);
    setTimeout(() => setMessage(''), 4000);
  };

  // Create new template
  const handleCreateNewTemplate = () => {
    const newId = `tpl-custom-${Date.now()}`;
    const newTemplate: SpecTemplate = normalizeSpecTemplate({
      id: newId,
      code: '',
      name: '新規仕様書 テンプレート',
      description: 'セル番地マッピングおよびチェック項目を定義した新規仕様書',
      columns: ['機器名', '数量', '納期', '特記事項'],
      inspectionStandard: '受入検査を実施すること。',
      warrantyPeriod: '引渡日より1年間。',
      deliveryTerms: '車上渡し。',
      notesTemplate: '特記事項なし。',
      sourceType: 'custom_excel',
      fields: [
        { id: `f-${Date.now()}-3`, label: '耐圧検査成績書提出', cell: 'C8', type: 'checkbox', group: 'check', defaultValue: true, checkboxConfig: { checkedValue: '☑ 要', uncheckedValue: '☐ 不要', labelTrue: '要', labelFalse: '不要' } },
        { id: `f-${Date.now()}-4`, label: '塗装仕様', cell: 'C9', type: 'select', group: 'spec', options: ['標準防錆塗装', 'エポキシ樹脂塗装', '無塗装'], defaultValue: '標準防錆塗装' },
        { id: `f-${Date.now()}-5`, label: '特記事項', cell: 'B23', type: 'textarea', group: 'notes', defaultValue: '特記事項なし。' }
      ],
      updatedAt: new Date().toISOString().slice(0, 10)
    });

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
      code: '',
      name: `${tpl.name} (複製)`,
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    onUpdateTemplates([duplicated, ...templates]);
    setSelectedTemplateId(newId);
    handleStartEdit(duplicated);
  };

  // 2nd cushion: confirm delete template
  const handleConfirmDeleteTemplate = () => {
    if (!deleteTargetTpl) return;
    const deletedName = deleteTargetTpl.name;
    const deletedId = deleteTargetTpl.id;
    const nextTemplates = templates.filter(t => t.id !== deletedId);
    onUpdateTemplates(nextTemplates);

    if (selectedTemplateId === deletedId) {
      setSelectedTemplateId(nextTemplates[0]?.id || '');
    }
    if (editingTemplate?.id === deletedId) {
      setIsEditing(false);
      setEditingTemplate(null);
    }
    setDeleteTargetTpl(null);
    setMessage(`テンプレート「${deletedName}」を削除しました。`);
    setTimeout(() => setMessage(''), 4000);
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

        const targetId = editingTemplate ? editingTemplate.id : selectedTemplateId;
        const updated = templates.map(t => {
          if (t.id === targetId) {
            return {
              ...(editingTemplate && editingTemplate.id === t.id ? editingTemplate : t),
              masterFileName: file.name,
              masterWorkbookBase64: base64,
              rawWorkbookBase64: base64,
              updatedAt: new Date().toISOString().slice(0, 10)
            };
          }
          return t;
        });

        onUpdateTemplates(updated);

        if (editingTemplate) {
          setEditingTemplate({
            ...editingTemplate,
            masterFileName: file.name,
            masterWorkbookBase64: base64,
            rawWorkbookBase64: base64,
            updatedAt: new Date().toISOString().slice(0, 10)
          });
        }

        setMessage(`マスター雛形Excel「${file.name}」を取り込み、設定を即時保存しました。直接描画ビューに反映されます。`);
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

        const newTemplate: SpecTemplate = normalizeSpecTemplate({
          id: asset.templateId || `tpl-${Date.now()}`,
          code: '',
          name: asset.templateName || file.name.replace('.specmap.json', ''),
          description: asset.description || '外部からインポートされたマッピング定義仕様書',
          targetCategoryName: asset.targetCategoryName || '汎用',
          columns: ['機器名', '数量', '納期', '特記事項'],
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
        });

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
  const handleAddSpecField = () => {
    if (!editingTemplate) return;
    const labelChoice = availableSpecNames[0] || '口径';
    const newField: SpecFieldMapping = {
      id: `f-spec-${Date.now()}`,
      label: labelChoice,
      cell: 'C11',
      cellSlot2: '',
      cellSlot3: '',
      cellSlot4: '',
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

  const handleAddCheckboxField = () => {
    if (!editingTemplate) return;
    const newField: SpecFieldMapping = {
      id: `f-check-${Date.now()}`,
      label: '耐圧・漏れ検査',
      cell: 'B8',
      labelCell: 'C8',
      type: 'checkbox',
      group: 'check',
      defaultValue: true,
      checkboxConfig: {
        checkedValue: '☑ 要',
        uncheckedValue: '☐ 不要',
        labelTrue: '要',
        labelFalse: '不要'
      }
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

  const rawActiveTpl = isEditing && editingTemplate ? editingTemplate : currentTemplate;
  const activeTpl = React.useMemo(() => (rawActiveTpl ? normalizeSpecTemplate(rawActiveTpl) : null), [rawActiveTpl]);

  const detailFields = React.useMemo(() => {
    return (activeTpl?.fields || []).filter(f => f.group === 'detail');
  }, [activeTpl]);

  const specFields = React.useMemo(() => {
    return (activeTpl?.fields || []).filter(
      f => f.type !== 'checkbox' && f.group !== 'basic' && f.group !== 'detail'
    );
  }, [activeTpl]);

  const checkboxFields = React.useMemo(() => {
    return (activeTpl?.fields || []).filter(f => f.type === 'checkbox' || f.group === 'check');
  }, [activeTpl]);

  const basicFields = React.useMemo(() => {
    return (activeTpl?.fields || []).filter(f => f.group === 'basic');
  }, [activeTpl]);

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
            onClick={() => currentTemplate && handleExportAsset(currentTemplate)}
            disabled={!currentTemplate}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
              {templates.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-slate-400">
                  登録テンプレートがありません
                </div>
              ) : (
                templates.map(tpl => {
                  const isSelected = tpl.id === selectedTemplateId;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplateId(tpl.id);
                        setIsEditing(false);
                        setEditingTemplate(null);
                      }}
                      className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-2xs font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{tpl.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetTpl(tpl);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0 cursor-pointer"
                          title={`「${tpl.name}」を削除`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal mt-1 flex items-center gap-1.5">
                        <span>項目: {tpl.fields?.length || 0}個</span>
                        <span>•</span>
                        <span>更新: {tpl.updatedAt}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Template Detail & Mapping Editor (9 cols) */}
        <div className="lg:col-span-9 space-y-4">
          {!activeTpl ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-3">
              <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">テンプレートが登録されていません</div>
              <p className="text-xs text-slate-500">
                「新規テンプレート作成」または「マッピング定義 (JSON) を読込」からテンプレートを追加してください。
              </p>
              <button
                onClick={handleCreateNewTemplate}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新規テンプレート作成</span>
              </button>
            </div>
          ) : (
            <>
          {/* Header Card for Selected Template */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-1.5 max-w-xl">
                    <input
                      type="text"
                      value={editingTemplate?.name ?? ''}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : prev)}
                      placeholder="仕様書のテンプレート名を入力..."
                      className="w-full text-sm font-bold text-slate-900 bg-white border border-indigo-300 rounded-md px-2.5 py-1 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-slate-500 truncate">
                      {activeTpl.description}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{activeTpl.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeTpl.description}
                    </p>
                  </>
                )}
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
                      onClick={() => setDeleteTargetTpl(activeTpl)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="このテンプレートを削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>削除</span>
                    </button>
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
            <div className="flex border-b border-slate-200 pt-1 text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTabSub('fields')}
                className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabSub === 'fields'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>セル番地マッピング（機器明細・仕様項目・チェック設定）</span>
              </button>
              <button
                onClick={() => setActiveTabSub('basic')}
                className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTabSub === 'basic'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>基本情報マッピング ({basicFields.length})</span>
              </button>
              <button
                onClick={() => setActiveTabSub('asset')}
                className={`px-4 py-2 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
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
            <div className="space-y-4">

              {/* Unified Continuous Section: 明細基本情報（固定4項目）＋ 可変仕様項目 セル番地マッピング */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>セル番地マッピング（明細基本情報・可変仕様項目）</span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      上段に明細の基本情報（機器名・数量・納期・特記事項）、下段に可変の仕様項目（口径・材質・塗装等）の転記先セル番地を個別指定します。
                    </p>
                  </div>

                  {isEditing && (
                    <button
                      onClick={handleAddSpecField}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>仕様項目を追加</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-48">項目名</th>
                        <th className="p-2 w-24 bg-indigo-50/60 text-indigo-950 font-bold">1種類目 (メイン)</th>
                        <th className="p-2 w-24">2種類目</th>
                        <th className="p-2 w-24">3種類目</th>
                        <th className="p-2 w-24">4種類目</th>
                        <th className="p-2">初期値 / 説明</th>
                        {isEditing && <th className="p-2 text-right w-12">操作</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* 上段: 明細の基本情報のマッピング（固定4項目: 機器名・数量・納期・特記事項） */}
                      <tr className="bg-slate-100/70">
                        <td colSpan={isEditing ? 7 : 6} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700">
                          明細の基本情報（機器名・数量・納期・特記事項）
                        </td>
                      </tr>
                      {detailFields.map((field) => {
                        if (!isEditing) {
                          return (
                            <tr key={field.id} className="hover:bg-slate-50/70">
                              <td className="p-2 font-bold text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                                  <span>{field.label}</span>
                                </div>
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-700 bg-indigo-50/20">
                                {field.cell || '-'}
                              </td>
                              <td className="p-2 font-mono text-slate-700">
                                {field.cellSlot2 || '-'}
                              </td>
                              <td className="p-2 font-mono text-slate-700">
                                {field.cellSlot3 || '-'}
                              </td>
                              <td className="p-2 font-mono text-slate-700">
                                {field.cellSlot4 || '-'}
                              </td>
                              <td className="p-2 text-[11px] text-slate-500">
                                {field.description || '-'}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={field.id} className="bg-slate-50/40 hover:bg-indigo-50/20">
                            <td className="p-2 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                                <span>{field.label}</span>
                              </div>
                            </td>
                            <td className="p-2 bg-indigo-50/20">
                              <input
                                type="text"
                                value={field.cell || ''}
                                onChange={(e) => handleUpdateField(field.id, { cell: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2 py-1 text-indigo-800 placeholder-slate-300"
                                placeholder="C15"
                                title="1種類目のセル番地"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot2 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot2: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="C16"
                                title="2種類目のセル番地"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot3 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot3: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="C17"
                                title="3種類目のセル番地"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot4 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot4: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="C18"
                                title="4種類目のセル番地"
                              />
                            </td>
                            <td className="p-2 text-[11px] text-slate-500">
                              {field.description || '-'}
                            </td>
                            <td className="p-2 text-right">
                              <span className="text-[10px] text-slate-400 font-mono">固定</span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* 下段: 可変の項目マッピング（仕様項目） */}
                      <tr className="bg-indigo-50/40 border-t border-slate-200">
                        <td colSpan={isEditing ? 7 : 6} className="px-2.5 py-1.5 text-[11px] font-bold text-indigo-900">
                          可変の仕様項目（口径・材質・塗装仕様など）
                        </td>
                      </tr>
                      {specFields.map((field) => {
                        if (!isEditing) {
                          return (
                            <tr key={field.id} className="hover:bg-slate-50/70">
                              <td className="p-2 font-semibold text-slate-900">
                                {field.label}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-700 bg-indigo-50/20">
                                {field.cell || '-'}
                              </td>
                              <td className="p-2 font-mono text-slate-700">
                                {field.cellSlot2 || '-'}
                              </td>
                              <td className="p-2 font-mono text-slate-700">
                                {field.cellSlot3 || '-'}
                              </td>
                              <td className="p-2 font-mono text-slate-700">
                                {field.cellSlot4 || '-'}
                              </td>
                              <td className="p-2 text-[11px] text-slate-500">
                                {String(field.defaultValue || field.placeholder || '-')}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={field.id} className="bg-indigo-50/20 hover:bg-indigo-50/40">
                            <td className="p-2">
                              <select
                                value={field.label}
                                onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">-- 仕様項目を選択 --</option>
                                {availableSpecNames.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                                {!availableSpecNames.includes(field.label) && field.label && (
                                  <option value={field.label}>{field.label} (登録外)</option>
                                )}
                              </select>
                            </td>
                            {/* 1種類目 */}
                            <td className="p-2 bg-indigo-50/20">
                              <input
                                type="text"
                                value={field.cell || ''}
                                onChange={(e) => handleUpdateField(field.id, { cell: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2 py-1 text-indigo-800 placeholder-slate-300"
                                placeholder="D15"
                                title="1種類目のセル番地"
                              />
                            </td>
                            {/* 2種類目 */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot2 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot2: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="D16"
                                title="2種類目のセル番地"
                              />
                            </td>
                            {/* 3種類目 */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot3 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot3: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="D17"
                                title="3種類目のセル番地"
                              />
                            </td>
                            {/* 4種類目 */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot4 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot4: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="D18"
                                title="4種類目のセル番地"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={String(field.defaultValue ?? '')}
                                onChange={(e) => handleUpdateField(field.id, { defaultValue: e.target.value })}
                                placeholder="初期値 / 備考"
                                className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                title="この項目を削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Checkbox Settings (別途チェックボックス設定の欄を設ける) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                      <span>チェックボックス設定 (適用要件・指定基準) ({checkboxFields.length}項目)</span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      チェックボックス（☑ / ☐）を入れたいセル番地と、その項目名が記載されるセル番地をマッピングします。
                    </p>
                  </div>

                  {isEditing && (
                    <button
                      onClick={handleAddCheckboxField}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>チェックボックスを追加</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-36">チェックボックスのセル番地</th>
                        <th className="p-2 w-36">項目のセル番地</th>
                        <th className="p-2 w-48">チェック項目名</th>
                        <th className="p-2">流し込み値 (ON / OFF)</th>
                        {isEditing && <th className="p-2 text-right w-14">操作</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {checkboxFields.map((field) => {
                        if (!isEditing) {
                          return (
                            <tr key={field.id} className="hover:bg-slate-50/70">
                              <td className="p-2 font-mono font-bold text-emerald-700">
                                {field.cell}
                              </td>
                              <td className="p-2 font-mono text-slate-700">
                                {field.labelCell || '-'}
                              </td>
                              <td className="p-2 font-semibold text-slate-900">
                                {field.label}
                              </td>
                              <td className="p-2 text-[11px] font-mono text-slate-600">
                                ON: <span className="text-emerald-700 font-semibold">{field.checkboxConfig?.checkedValue || '☑ 要'}</span> / 
                                OFF: <span className="text-slate-400">{field.checkboxConfig?.uncheckedValue || '☐ 不要'}</span>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={field.id} className="bg-emerald-50/20 hover:bg-emerald-50/40">
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cell}
                                onChange={(e) => handleUpdateField(field.id, { cell: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono font-bold bg-white border border-emerald-300 rounded px-2 py-1 text-emerald-800"
                                placeholder="B8, D8..."
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.labelCell || ''}
                                onChange={(e) => handleUpdateField(field.id, { labelCell: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800"
                                placeholder="C8, E8..."
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                                placeholder="耐圧・漏れ検査"
                              />
                            </td>
                            <td className="p-2">
                              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
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
                                  placeholder="ON時: ☑ 要"
                                  className="w-full text-xs bg-white border border-emerald-300 rounded px-1.5 py-0.5"
                                />
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
                                  placeholder="OFF時: ☐ 不要"
                                  className="w-full text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5"
                                />
                              </div>
                            </td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteField(field.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                title="このチェックボックス設定を削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab: Basic Info Mapping (基本情報マッピング - 固定5項目) */}
          {activeTabSub === 'basic' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>基本情報マッピング（固定5項目）</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    オーダーNo.・案件名・客先名・仕様書番号・発行日の5項目をExcel原本のどのセルへ書き込むか設定します。（項目は固定・セル番地のみ入力可）
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-52">基本情報項目 (固定)</th>
                      <th className="p-2.5 w-44">マッピングセル番地</th>
                      <th className="p-2.5">連動元</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {basicFields.map((field) => (
                      <tr
                        key={field.id}
                        className={isEditing ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-slate-50/70'}
                      >
                        <td className="p-2.5 font-bold text-slate-900">
                          {field.label}
                        </td>
                        <td className="p-2.5">
                          {isEditing ? (
                            <input
                              type="text"
                              value={field.cell}
                              onChange={(e) => handleUpdateField(field.id, { cell: e.target.value.toUpperCase() })}
                              className="w-32 text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2.5 py-1 text-indigo-800 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                              placeholder="例: C3"
                            />
                          ) : (
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                              {field.cell || '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-500">
                          {field.description || '案件サマリー一律反映'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  fields: activeTpl.fields || [],
                  masterFileName: activeTpl.masterFileName || activeTpl.originalFileName
                }, null, 2)}</pre>
              </div>
            </div>
          )}

            </>
          )}
        </div>

      </div>

      {/* 2-Step Confirmation Modal for Deleting Template */}
      {deleteTargetTpl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-red-600 text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h3 className="font-bold text-sm">登録テンプレートの削除確認</h3>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900 text-sm">
                「{deleteTargetTpl.name}」を削除しますか？
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                この操作を実行すると、該当テンプレートのマッピング設定および登録された雛形Excelデータは一覧から削除され、元に戻せません。
              </p>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetTpl(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTemplate}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>削除を実行</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
