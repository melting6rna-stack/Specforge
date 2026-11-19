import React, { useState, useRef, useEffect } from 'react';
import { 
  Settings2, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  Target,
  Copy,
  CheckSquare,
  Calendar,
  Layers,
  ArrowLeft,
  HardDrive,
  AlertTriangle,
  FolderOpen,
  RefreshCw,
  FolderSync
} from 'lucide-react';
import { SpecTemplate, SpecFieldMapping, SpecMappingAssetFile, EquipmentItem, ProjectWorkspace, TemplateFolderState } from '../types';
import { exportMappingAssetAsJson, importMappingAssetFromJson, readTemplateCellTexts } from '../utils/exceljsEngine';
import { normalizeSpecTemplate, REVISION_FIELD_DEFS } from '../utils/templateUtils';

interface TemplateAdminTabProps {
  templates: SpecTemplate[];
  onUpdateTemplates: (updated: SpecTemplate[]) => void;
  items?: EquipmentItem[];
  currentProject?: ProjectWorkspace;
  activeTemplateId?: string;
  onSelectTemplate?: (id: string) => void;
  onBackToDashboard?: () => void;
  templateFolderState?: TemplateFolderState | null;
  isFolderSyncing?: boolean;
  onSelectTemplateFolder?: () => Promise<{ selected: boolean; fallbackToInput?: boolean; errorMessage?: string }>;
  onImportTemplateFolderFiles?: (files: FileList) => Promise<void> | void;
  onSyncTemplateFolder?: () => Promise<void> | void;
  onClearTemplateFolder?: () => Promise<void> | void;
  onSaveMappingToFolder?: (tpl: SpecTemplate) => Promise<{ writtenToFolder: boolean; fileName: string; message?: string }>;
}

export const TemplateAdminTab: React.FC<TemplateAdminTabProps> = ({
  templates,
  onUpdateTemplates,
  items,
  activeTemplateId,
  onBackToDashboard,
  templateFolderState,
  isFolderSyncing = false,
  onSelectTemplateFolder,
  onImportTemplateFolderFiles,
  onSyncTemplateFolder,
  onClearTemplateFolder,
  onSaveMappingToFolder,
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
  const [templateFilter, setTemplateFilter] = useState<string>('');

  const jsonAssetInputRef = useRef<HTMLInputElement | null>(null);
  const folderFallbackInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeTemplateId && templates.some(t => t.id === activeTemplateId)) {
      setSelectedTemplateId(activeTemplateId);
    }
  }, [activeTemplateId, templates]);

  useEffect(() => {
    if (!templates.some(t => t.id === selectedTemplateId) && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

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

  // Save template modifications (and write paired .specmap.json into registered folder when applicable)
  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    const syncedFields = (editingTemplate.fields || []).map((f) => {
      if (f.type === 'checkbox' || f.group === 'check') {
        const refAddr = (f.labelCell || '').trim().toUpperCase();
        const refText = refAddr ? excelLabelPreviewMap[refAddr] : '';
        return {
          ...f,
          labelCell: refAddr,
          label: refText || f.label || (refAddr ? `セル ${refAddr}` : ''),
        };
      }
      return f;
    });
    const cleanedTpl = normalizeSpecTemplate({
      ...editingTemplate,
      fields: syncedFields,
      updatedAt: new Date().toISOString().slice(0, 10)
    });
    const updated = templates.map(t => t.id === cleanedTpl.id ? cleanedTpl : t);
    onUpdateTemplates(updated);
    setIsEditing(false);
    setEditingTemplate(null);

    if (cleanedTpl.sourceLocation === 'folder' && onSaveMappingToFolder) {
      try {
        const res = await onSaveMappingToFolder(cleanedTpl);
        if (res.writtenToFolder) {
          setMessage(`「${cleanedTpl.name}」の設定を保存し、参照元フォルダへ「${res.fileName}」を保存しました。`);
        } else {
          setMessage(`「${cleanedTpl.name}」の設定を保存しました（${res.message || '次回選択時に反映されます'}）。`);
        }
      } catch (err: any) {
        setMessage(`「${cleanedTpl.name}」の設定を保存しました（フォルダ書込: ${err?.message || '権限が必要'}）。`);
      }
    } else {
      setMessage(`テンプレート「${cleanedTpl.name}」の設定を保存しました。`);
    }
    setTimeout(() => setMessage(''), 5000);
  };

  const handlePickFolderClick = async () => {
    setErrorMessage('');
    if (!onSelectTemplateFolder) {
      folderFallbackInputRef.current?.click();
      return;
    }
    const res = await onSelectTemplateFolder();
    if (res.fallbackToInput) {
      folderFallbackInputRef.current?.click();
    } else if (res.errorMessage) {
      setErrorMessage(res.errorMessage);
    }
  };

  const handleFallbackFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onImportTemplateFolderFiles) {
      try {
        await onImportTemplateFolderFiles(files);
      } catch (err: any) {
        setErrorMessage(`フォルダ読み込みに失敗しました: ${err?.message || 'エラー'}`);
      }
    }
    e.target.value = '';
  };

  const handleSaveCurrentMappingToFolder = async (tpl: SpecTemplate) => {
    if (!onSaveMappingToFolder) return;
    setErrorMessage('');
    try {
      const res = await onSaveMappingToFolder(tpl);
      if (res.writtenToFolder) {
        setMessage(`参照元フォルダへ「${res.fileName}」を保存しました。次回から自動引用されます。`);
        setTimeout(() => setMessage(''), 5000);
      } else {
        exportMappingAssetAsJson(tpl);
        setMessage(`書き込み権限がないため「${tpl.name}」のマッピングJSONをダウンロードしました。参照元フォルダへ配置してください。`);
        setTimeout(() => setMessage(''), 6000);
      }
    } catch (err: any) {
      setErrorMessage(`フォルダへの保存に失敗しました: ${err?.message || 'エラー'}`);
    }
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
      notesTemplate: '',
      sourceType: 'custom_excel',
      fields: [],
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

  // Field manipulation helpers for editingTemplate
  const handleAddSpecField = () => {
    if (!editingTemplate) return;
    const labelChoice = availableSpecNames[0] || '口径';
    const newField: SpecFieldMapping = {
      id: `f-spec-${Date.now()}`,
      label: labelChoice,
      cell: '',
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
      label: '',
      cell: '',
      labelCell: '',
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
      f => f.type !== 'checkbox' && f.group !== 'basic' && f.group !== 'detail' && f.group !== 'revision'
    );
  }, [activeTpl]);

  const checkboxFields = React.useMemo(() => {
    return (activeTpl?.fields || []).filter(f => f.type === 'checkbox' || f.group === 'check');
  }, [activeTpl]);

  const checkboxLabelAddrsKey = React.useMemo(
    () => checkboxFields.map((f) => (f.labelCell || '').trim().toUpperCase()).filter(Boolean).join(','),
    [checkboxFields]
  );

  const [excelLabelPreviewMap, setExcelLabelPreviewMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeTpl || !checkboxLabelAddrsKey) {
      setExcelLabelPreviewMap({});
      return;
    }
    let cancelled = false;
    const addrs = checkboxLabelAddrsKey.split(',').filter(Boolean);
    readTemplateCellTexts(activeTpl, addrs)
      .then((map) => {
        if (!cancelled) setExcelLabelPreviewMap(map);
      })
      .catch(() => {
        if (!cancelled) setExcelLabelPreviewMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [activeTpl?.id, activeTpl?.rawWorkbookBase64, activeTpl?.masterWorkbookBase64, checkboxLabelAddrsKey]);

  const basicFields = React.useMemo(() => {
    return (activeTpl?.fields || []).filter(f => f.group === 'basic');
  }, [activeTpl]);

  const revisionFields = React.useMemo(() => {
    return (activeTpl?.fields || []).filter(f => f.group === 'revision');
  }, [activeTpl]);

  const handleApplyBuiltinRevisionCells = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: (editingTemplate.fields || []).map(f => {
        const def = REVISION_FIELD_DEFS.find(d => d.id === f.id);
        return def ? { ...f, cell: def.builtinCell } : f;
      })
    });
  };

  const handleClearAllCellAddresses = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      fields: (editingTemplate.fields || []).map(f => ({
        ...f,
        cell: '',
        cellSlot2: '',
        cellSlot3: '',
        cellSlot4: '',
        ...(f.type === 'checkbox' || f.group === 'check' ? { labelCell: '' } : {})
      }))
    });
  };

  const filteredTemplates = React.useMemo(() => {
    const q = templateFilter.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.excelFileName || '').toLowerCase().includes(q) ||
      (t.mappingFileName || '').toLowerCase().includes(q)
    );
  }, [templates, templateFilter]);

  return (
    <div className="space-y-4">
      {/* Hidden webkitdirectory fallback input */}
      <input
        type="file"
        ref={folderFallbackInputRef}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        onChange={handleFallbackFolderChange}
        className="hidden"
      />

      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-700 shrink-0" />
            <h1 className="text-base font-bold text-slate-900">
              設定管理
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            仕様書テンプレートの参照元フォルダ登録、セル番地マッピング、チェック項目および基本情報連携を一元管理します。
          </p>
        </div>

        {/* Global Settings Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>仕様書画面へ戻る</span>
            </button>
          )}
          <button
            onClick={handleCreateNewTemplate}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-all flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新規テンプレート作成</span>
          </button>
        </div>
      </div>

      {/* Reference Source Folder Configuration Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <FolderOpen className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-slate-900">参照元フォルダ設定（Excel雛形 ＆ 同名マッピングJSON自動引用）</span>
              </div>
              {templateFolderState ? (
                <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold text-slate-900">{templateFolderState.folderName}</span>
                  <span className="text-slate-300">·</span>
                  <span>Excel雛形 {templateFolderState.excelCount}件</span>
                  <span className="text-slate-300">·</span>
                  <span>マッピングJSON {templateFolderState.mappingCount}件</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-medium text-emerald-700">自動連携 {templateFolderState.pairedCount}件</span>
                  {templateFolderState.lastSyncAt && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400">最終同期 {templateFolderState.lastSyncAt}</span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  参照元フォルダを登録すると、フォルダ内の仕様書Excel（.xlsx）と同名のマッピングJSON（.specmap.json / .json）を自動で結び付けて選択できます。
                </p>
              )}
              {templateFolderState?.needsPermission && (
                <p className="text-[11px] text-sky-800 font-medium pt-0.5">
                  ブラウザ更新後のため、右の「アクセス許可して再読込」をクリックしてフォルダ連動を再開してください。
                </p>
              )}
              {templateFolderState?.isError && templateFolderState.errorMessage && (
                <p className="text-[11px] text-red-700 font-medium pt-0.5">
                  {templateFolderState.errorMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {templateFolderState?.needsPermission && onSyncTemplateFolder && (
              <button
                type="button"
                onClick={onSyncTemplateFolder}
                disabled={isFolderSyncing}
                className="px-3 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFolderSyncing ? 'animate-spin' : ''}`} />
                <span>アクセス許可して再読込</span>
              </button>
            )}

            {templateFolderState && !templateFolderState.needsPermission && templateFolderState.mode === 'handle' && onSyncTemplateFolder && (
              <button
                type="button"
                onClick={onSyncTemplateFolder}
                disabled={isFolderSyncing}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isFolderSyncing ? 'animate-spin' : ''}`} />
                <span>再読込</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePickFolderClick}
              disabled={isFolderSyncing}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>{templateFolderState ? '参照元フォルダを変更' : '参照元フォルダを選択・登録'}</span>
            </button>

            {templateFolderState && onClearTemplateFolder && (
              <button
                type="button"
                onClick={onClearTemplateFolder}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                解除
              </button>
            )}
          </div>
        </div>

        <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
          ルール例: 同じフォルダ内に <span className="font-mono text-slate-700">配管仕様書.xlsx</span> と <span className="font-mono text-slate-700">配管仕様書.specmap.json</span>（または <span className="font-mono text-slate-700">.json</span>）を配置すると、仕様書作成画面で選ぶだけでマッピングが自動適用されます。
        </div>
      </div>

      {message && (
        <div className="bg-emerald-600 text-white text-xs py-2 px-4 rounded-lg shadow-xs flex items-center justify-between animate-in fade-in">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-white hover:text-emerald-200 cursor-pointer">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-600 text-white text-xs py-2 px-4 rounded-lg shadow-xs flex items-center justify-between animate-in fade-in">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="text-white hover:text-red-200 cursor-pointer">✕</button>
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

            {templates.length > 5 && (
              <input
                type="text"
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                placeholder="テンプレート名で絞込..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:bg-white focus:border-indigo-400 focus:outline-hidden"
              />
            )}

            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredTemplates.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-slate-400">
                  該当するテンプレートがありません
                </div>
              ) : (
                filteredTemplates.map(tpl => {
                  const isSelected = tpl.id === selectedTemplateId;
                  const isFolder = tpl.sourceLocation === 'folder';
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
                        {!isFolder && (
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
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal mt-1 flex items-center gap-1.5 truncate">
                        <span>{isFolder ? (tpl.hasPairedMappingFile ? 'フォルダ連携済' : 'フォルダ(未設定)') : 'ローカル'}</span>
                        <span>·</span>
                        <span>項目: {tpl.fields?.length || 0}</span>
                        <span>·</span>
                        <span className="truncate">{tpl.updatedAt}</span>
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
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <label className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer">
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
                <button
                  onClick={handleCreateNewTemplate}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新規テンプレート作成</span>
                </button>
              </div>
            </div>
          ) : (
            <>
          {/* Header Card for Selected Template */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">{activeTpl.name}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">
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
                      className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>設定を保存</span>
                    </button>
                  </>
                ) : (
                  <>
                    {activeTpl.sourceLocation === 'folder' && onSaveMappingToFolder && (
                      <button
                        type="button"
                        onClick={() => handleSaveCurrentMappingToFolder(activeTpl)}
                        className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        title="このテンプレートと同名のマッピングJSONをフォルダに保存"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>フォルダへJSON保存</span>
                      </button>
                    )}
                    {activeTpl.sourceLocation !== 'folder' && (
                      <button
                        onClick={() => setDeleteTargetTpl(activeTpl)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="このテンプレートを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>削除</span>
                      </button>
                    )}
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
                <span>基本情報マッピング</span>
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
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleClearAllCellAddresses}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 border border-slate-300 rounded-md transition-all cursor-pointer"
                        title="このテンプレートの全セル番地を空欄にリセット"
                      >
                        セル番地をすべてクリア
                      </button>
                      <button
                        onClick={handleAddSpecField}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>仕様項目を追加</span>
                      </button>
                    </div>
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
                                placeholder="未指定"
                                title="1種類目のセル番地"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot2 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot2: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="未指定"
                                title="2種類目のセル番地"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot3 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot3: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="未指定"
                                title="3種類目のセル番地"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.cellSlot4 || ''}
                                onChange={(e) => handleUpdateField(field.id, { cellSlot4: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 placeholder-slate-300"
                                placeholder="未指定"
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
                                placeholder="未指定"
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
                                placeholder="未指定"
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
                                placeholder="未指定"
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
                                placeholder="未指定"
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
                      チェックボックス（☑ / ☐）を出力するセル番地と、項目名が記載されているExcelセル番地を指定します。作成画面では参照セルの文言がそのまま項目名として表示されます。
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
                        <th className="p-2 w-40">チェック項目名のセル番地</th>
                        <th className="p-2 w-52">参照項目名 (Excel記載内容)</th>
                        <th className="p-2">流し込み値 (ON / OFF)</th>
                        {isEditing && <th className="p-2 text-right w-14">操作</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {checkboxFields.map((field) => {
                        const refAddr = (field.labelCell || '').trim().toUpperCase();
                        const hasValidRefAddr = /^[A-Z]{1,3}[0-9]{1,5}$/.test(refAddr);
                        const resolvedExcelText = hasValidRefAddr ? (excelLabelPreviewMap[refAddr] || '') : '';

                        if (!isEditing) {
                          return (
                            <tr key={field.id} className="hover:bg-slate-50/70">
                              <td className="p-2 font-mono font-bold text-emerald-700">
                                {field.cell || '-'}
                              </td>
                              <td className="p-2 font-mono font-semibold text-indigo-700">
                                {refAddr || '-'}
                              </td>
                              <td className="p-2 text-slate-900">
                                {resolvedExcelText ? (
                                  <span className="font-semibold">{resolvedExcelText}</span>
                                ) : hasValidRefAddr ? (
                                  <span className="text-[11px] text-slate-400">
                                    (セル {refAddr} は空欄)
                                  </span>
                                ) : field.label ? (
                                  <span className="text-slate-600">
                                    {field.label} <span className="text-[10px] text-amber-600">(セル未指定)</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">未指定</span>
                                )}
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
                                className="w-full text-xs font-mono font-bold bg-white border border-emerald-300 rounded px-2 py-1 text-emerald-800 placeholder-slate-300"
                                placeholder="未指定"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={field.labelCell || ''}
                                onChange={(e) => handleUpdateField(field.id, { labelCell: e.target.value.toUpperCase() })}
                                className="w-full text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2 py-1 text-indigo-800 placeholder-slate-300"
                                placeholder="未指定"
                              />
                            </td>
                            <td className="p-2">
                              <div className="text-xs px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 truncate" title={resolvedExcelText || undefined}>
                                {resolvedExcelText ? (
                                  <span className="font-semibold text-slate-900">{resolvedExcelText}</span>
                                ) : hasValidRefAddr ? (
                                  <span className="text-[11px] text-slate-400">セル {refAddr} に記載なし</span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">セル番地を入力すると自動参照</span>
                                )}
                              </div>
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

          {/* Sub Tab: Basic Info Mapping (基本情報マッピング - 固定5項目 + 変更履歴Rev.1〜3) */}
          {activeTabSub === 'basic' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>基本情報マッピング</span>
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
                                className="w-32 text-xs font-mono font-bold bg-white border border-indigo-300 rounded px-2.5 py-1 text-indigo-800 placeholder-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                                placeholder="未指定"
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

              {/* Revision History Table Mapping (Rev.1〜Rev.3 × 4 columns) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-rose-600" />
                      <span>変更履歴欄マッピング（Rev.1〜Rev.3）</span>
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      リビジョン0では入力せず、Rev.1は1段目、Rev.2はその下の段、Rev.3は3段目に「リビジョン番号・改訂日・改訂者・変更内容」を転記します。
                    </p>
                  </div>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleApplyBuiltinRevisionCells}
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer shrink-0"
                    >
                      内蔵雛形用の標準セル(B31〜E33)を自動入力
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 w-28">版数（段）</th>
                        <th className="p-2.5">リビジョン番号 <span className="text-[10px] font-normal text-slate-400">(例: Rev1)</span></th>
                        <th className="p-2.5">改訂日</th>
                        <th className="p-2.5">改訂者</th>
                        <th className="p-2.5">変更内容</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {([1, 2, 3] as const).map((revNum) => {
                        const defs = REVISION_FIELD_DEFS.filter(d => d.revision === revNum);
                        return (
                          <tr
                            key={revNum}
                            className={isEditing ? 'bg-rose-50/15 hover:bg-rose-50/30' : 'hover:bg-slate-50/70'}
                          >
                            <td className="p-2.5 font-bold text-slate-900">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                                Rev.{revNum} ({revNum}段目)
                              </span>
                            </td>
                            {defs.map((def) => {
                              const field = revisionFields.find(f => f.id === def.id);
                              const cellVal = field?.cell || '';
                              return (
                                <td key={def.id} className="p-2.5">
                                  {isEditing ? (
                                      <input
                                        type="text"
                                        value={cellVal}
                                        onChange={(e) => handleUpdateField(def.id, { cell: e.target.value.toUpperCase() })}
                                        className="w-24 text-xs font-mono font-bold bg-white border border-rose-300 rounded px-2 py-1 text-rose-900 focus:ring-1 focus:ring-rose-500 focus:outline-hidden placeholder-slate-300"
                                        placeholder="未指定"
                                      />
                                  ) : (
                                    <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                                      cellVal
                                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                                        : 'text-slate-400 bg-slate-50 border-slate-200 font-normal'
                                    }`}>
                                      {cellVal || '未設定'}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}



          {/* Sub Tab 3: JSON Asset View */}
          {activeTabSub === 'asset' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h2 className="text-xs font-bold text-slate-900">
                    マッピング定義アセット JSON
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    このJSONファイルを保存・エクスポートすることで、他のエンジニアや他システムと完全に同じ仕様書レイアウトを共有できます。
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
                  <button
                    onClick={() => handleExportAsset(activeTpl)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.specmap.json をダウンロード</span>
                  </button>
                </div>
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
                この操作を実行すると、該当テンプレートの設定および登録された雛形Excelデータは一覧から削除され、元に戻せません。
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
