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
import { SpecTemplate, SpecFieldMapping, TableColumnMapping, SpecMappingAssetFile, EquipmentItem, ProjectWorkspace } from '../types';
import { exportMappingAssetAsJson, importMappingAssetFromJson, createDefaultMasterWorkbook } from '../utils/exceljsEngine';

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
    const clone: SpecTemplate = JSON.parse(JSON.stringify(tpl));
    if (!clone.fields) clone.fields = [];
    
    // Ensure baseline basic fields exist if missing
    const hasBasic = (clone.fields || []).some(f => f.group === 'basic');
    if (!hasBasic) {
      const defaultBasics: SpecFieldMapping[] = [
        { id: `f-basic-title`, label: '案件名', cell: 'C5', type: 'text', group: 'basic', defaultValue: '設備工事' },
        { id: `f-basic-code`, label: '案件コード', cell: 'C4', type: 'text', group: 'basic', defaultValue: currentProject?.code || 'PRJ-2026-01' },
        { id: `f-basic-order`, label: 'オーダーNo.', cell: 'C3', type: 'text', group: 'basic', defaultValue: currentProject?.orderNo || '202500444' },
        { id: `f-basic-client`, label: '客先名', cell: 'G6', type: 'text', group: 'basic', defaultValue: currentProject?.clientName || '〇〇市水道局' },
        { id: `f-basic-docno`, label: '仕様書番号', cell: 'C4', type: 'text', group: 'basic', defaultValue: 'SPEC-2026-001' },
        { id: `f-basic-date`, label: '発行日', cell: 'G4', type: 'date', group: 'basic', defaultValue: new Date().toISOString().slice(0, 10) },
        { id: `f-basic-issuer`, label: '発行元', cell: 'G5', type: 'text', group: 'basic', defaultValue: '設計部' },
        { id: `f-basic-notes`, label: '特記事項', cell: 'B23', type: 'textarea', group: 'notes', defaultValue: '特記事項なし。' }
      ];
      clone.fields = [...defaultBasics, ...(clone.fields || [])];
    }

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

  const handleAddBasicField = () => {
    if (!editingTemplate) return;
    const newField: SpecFieldMapping = {
      id: `f-basic-${Date.now()}`,
      label: '案件名',
      cell: 'C5',
      type: 'text',
      group: 'basic',
      defaultValue: ''
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

  const specFields = React.useMemo(() => {
    return (activeTpl.fields || []).filter(f => f.type !== 'checkbox' && f.group !== 'basic');
  }, [activeTpl.fields]);

  const checkboxFields = React.useMemo(() => {
    return (activeTpl.fields || []).filter(f => f.type === 'checkbox' || f.group === 'check');
  }, [activeTpl.fields]);

  const basicFields = React.useMemo(() => {
    return (activeTpl.fields || []).filter(f => f.group === 'basic');
  }, [activeTpl.fields]);

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

              {/* Integrated Section 1: 対象機器 明細テーブル セル番地マッピング */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-indigo-600" />
                      <span>対象機器 明細テーブル セル番地マッピング</span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      案件に含まれる機器リスト（機器番号、機器名、仕様、材質、数量、納期）を流し込むExcel原本の列と各行のセル番地です。
                    </p>
                  </div>

                  {/* Settings toolbar: Target Sheet, Start Row */}
                  <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-medium">対象シート:</span>
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
                        className="w-20 text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono disabled:opacity-75"
                        placeholder="仕様書"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-medium">開始行:</span>
                      <input
                        type="number"
                        disabled={!isEditing}
                        value={activeTpl.tableMapping?.startRow || 15}
                        onChange={(e) => {
                          const newRow = parseInt(e.target.value, 10) || 15;
                          if (editingTemplate) {
                            setEditingTemplate({
                              ...editingTemplate,
                              tableMapping: {
                                ...editingTemplate.tableMapping!,
                                startRow: newRow
                              }
                            });
                          }
                        }}
                        className="w-14 text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 font-mono text-center font-bold disabled:opacity-75"
                      />
                      <span className="text-[11px] text-slate-400">行目〜</span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-36">明細項目名</th>
                        <th className="p-2 w-16 text-center">列</th>
                        <th className="p-2 w-28 bg-indigo-50/60 font-bold text-indigo-900">1行目 (1台目)</th>
                        <th className="p-2 w-24">2行目 (2台目)</th>
                        <th className="p-2 w-24">3行目 (3台目)</th>
                        <th className="p-2 w-24">4行目 (4台目)</th>
                        <th className="p-2">転記元データ / 説明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { key: 'tagNoCol', label: '機器番号', defaultCol: 'B', desc: '機器タグ番号 (例: V-101, P-101)' },
                        { key: 'nameCol', label: '機器名', defaultCol: 'C', desc: '機器名称 (例: ポールユニット, 渦巻ポンプ)' },
                        { key: 'diameterCol', label: '口径・主要仕様', defaultCol: 'D', desc: '口径や主要仕様パラメータ (例: 50A 10K)' },
                        { key: 'materialCol', label: '主要材質', defaultCol: 'E', desc: '材質 (例: SCS13A, SUS304)' },
                        { key: 'quantityCol', label: '数量', defaultCol: 'F', desc: '発注数量・単位 (例: 4台)' },
                        { key: 'deliveryDateCol', label: '納期', defaultCol: 'G', desc: '納入指定時期 (例: 2026/09/15)' },
                        { key: 'notesCol', label: '特記事項・備考', defaultCol: 'H', desc: '機器個別備考・特記事項' },
                      ].map(item => {
                        const colLetter = (activeTpl.tableMapping as any)?.[item.key] || item.defaultCol;
                        const startRow = activeTpl.tableMapping?.startRow || 15;
                        const slot1 = `${colLetter}${startRow}`;
                        const slot2 = `${colLetter}${startRow + 1}`;
                        const slot3 = `${colLetter}${startRow + 2}`;
                        const slot4 = `${colLetter}${startRow + 3}`;

                        return (
                          <tr key={item.key} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-2 font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                              <span>{item.label}</span>
                            </td>
                            <td className="p-2 text-center">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={colLetter}
                                  onChange={(e) => {
                                    if (editingTemplate) {
                                      setEditingTemplate({
                                        ...editingTemplate,
                                        tableMapping: {
                                          ...editingTemplate.tableMapping!,
                                          [item.key]: e.target.value.toUpperCase()
                                        }
                                      });
                                    }
                                  }}
                                  className="w-10 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded p-1 uppercase"
                                  title="列アルファベットを変更"
                                />
                              ) : (
                                <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                                  {colLetter}列
                                </span>
                              )}
                            </td>
                            <td className="p-2 bg-indigo-50/30">
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                                {slot1}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className="font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">
                                {slot2}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className="font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">
                                {slot3}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className="font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs">
                                {slot4}
                              </span>
                            </td>
                            <td className="p-2 text-[11px] text-slate-500">
                              {item.desc}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Specification fields */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>機器仕様項目 セル番地マッピング ({specFields.length}項目)</span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      機器データベースに登録されている仕様項目名（口径、材質、圧力等）をプルダウンで選択し、Excel原本の転記先セル番地を指定します。
                    </p>
                  </div>

                  {isEditing && (
                    <button
                      onClick={handleAddSpecField}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1 transition-all cursor-pointer"
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
                        <th className="p-2 w-48">項目ラベル (仕様項目)</th>
                        <th className="p-2 w-24">1種類目 (メイン)</th>
                        <th className="p-2 w-24">2種類目</th>
                        <th className="p-2 w-24">3種類目</th>
                        <th className="p-2 w-24">4種類目</th>
                        <th className="p-2">初期値 / 説明</th>
                        {isEditing && <th className="p-2 text-right w-12">操作</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {specFields.map((field) => {
                        if (!isEditing) {
                          return (
                            <tr key={field.id} className="hover:bg-slate-50/70">
                              <td className="p-2 font-semibold text-slate-900">
                                {field.label}
                              </td>
                              <td className="p-2 font-mono font-bold text-indigo-700">
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
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cell || ''}
                                onChange={(e) => handleUpdateField(field.id, { cell: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2 py-1 text-indigo-800 placeholder-slate-300"
                                placeholder="C15"
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
                                placeholder="D15"
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
                                placeholder="E15"
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
                                placeholder="F15"
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

          {/* Sub Tab: Basic Info Mapping (基本情報マッピング) */}
          {activeTabSub === 'basic' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>基本情報 ＆ 案件名セルマッピング ({basicFields.length}項目)</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    案件名、工事コード、オーダーNo.、客先名、仕様書番号などの案件基本情報をExcel原本のどのセルへ書き込むかを設定します。
                  </p>
                </div>

                {isEditing && (
                  <button
                    onClick={handleAddBasicField}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>基本情報項目を追加</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2 w-48">基本情報項目</th>
                      <th className="p-2 w-32">セル番地</th>
                      <th className="p-2 w-40">連動元</th>
                      <th className="p-2">プレビュー初期値</th>
                      {isEditing && <th className="p-2 text-right w-14">操作</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {basicFields.map((field) => {
                      if (!isEditing) {
                        return (
                          <tr key={field.id} className="hover:bg-slate-50/70">
                            <td className="p-2 font-semibold text-slate-900">
                              {field.label}
                            </td>
                            <td className="p-2 font-mono font-bold text-indigo-700">
                              {field.cell}
                            </td>
                            <td className="p-2 text-[11px] text-slate-500">
                              案件サマリー一律反映
                            </td>
                            <td className="p-2 text-[11px] text-slate-600">
                              {String(field.defaultValue || '-')}
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
                              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                            >
                              <option value="案件名">案件名 (工事名称)</option>
                              <option value="案件コード">案件コード (工事番号)</option>
                              <option value="オーダーNo.">オーダーNo.</option>
                              <option value="客先名">客先名 (発注者)</option>
                              <option value="客先番号">客先番号</option>
                              <option value="工事場所">工事場所</option>
                              <option value="仕様書番号">仕様書番号</option>
                              <option value="発行日">発行日</option>
                              <option value="発行元">発行元 (部署)</option>
                              <option value="特記事項">特記事項</option>
                              {!['案件名', '案件コード', 'オーダーNo.', '客先名', '客先番号', '工事場所', '仕様書番号', '発行日', '発行元', '特記事項'].includes(field.label) && (
                                <option value={field.label}>{field.label}</option>
                              )}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={field.cell}
                              onChange={(e) => handleUpdateField(field.id, { cell: e.target.value.toUpperCase() })}
                              className="w-full text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2 py-1 text-indigo-800"
                              placeholder="C5, C4..."
                            />
                          </td>
                          <td className="p-2 text-[11px] text-slate-500 font-mono">
                            案件サマリー一律反映
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={String(field.defaultValue ?? '')}
                              onChange={(e) => handleUpdateField(field.id, { defaultValue: e.target.value })}
                              placeholder="初期値"
                              className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => handleDeleteField(field.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              title="この基本情報マッピングを削除"
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
