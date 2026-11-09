import React, { useState, useRef } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Download, 
  Upload, 
  Calendar, 
  CheckCircle2, 
  ShieldCheck, 
  Tag, 
  ArrowRight, 
  HardDriveDownload, 
  HardDrive, 
  AlertTriangle, 
  RefreshCw, 
  FileCode, 
  Check, 
  FileSpreadsheet,
  Layers,
  FileCheck,
  Save
} from 'lucide-react';
import { ProjectWorkspace, EquipmentItem, Category } from '../types';
import { readFromProjectHandle, normalizeJsonToDatabase } from '../utils/sharedSyncManager';

interface ProjectSummaryTabProps {
  projects: ProjectWorkspace[];
  activeProjectId: string;
  items: EquipmentItem[];
  categories: Category[];
  onSelectProject: (id: string) => void;
  onAddProjectWithFile: (
    project: ProjectWorkspace, 
    initialItems?: EquipmentItem[], 
    handle?: FileSystemFileHandle
  ) => void;
  onUpdateProject?: (updated: ProjectWorkspace) => void;
  onRelinkProjectFile: (projectId: string) => void;
  onSyncProjectFile: (projectId: string) => void;
  onExportProjectBackup: () => void;
  onImportProjectBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSwitchToDatabase: () => void;
  isSyncing: boolean;
}

const parseClientNumberParts = (val?: string, part1?: string, part2?: string) => {
  if (part1 !== undefined && part1 !== null && part2 !== undefined && part2 !== null) {
    return { p1: part1, p2: part2 };
  }
  if (!val) return { p1: '', p2: '' };
  const m = val.match(/^【?(.*?)】?-【?(.*?)】?$/);
  if (m) {
    return { p1: m[1] || '', p2: m[2] || '' };
  }
  const parts = val.split('-');
  return { p1: parts[0] || '', p2: parts[1] || '' };
};

export const ProjectSummaryTab: React.FC<ProjectSummaryTabProps> = ({
  projects,
  activeProjectId,
  items,
  categories,
  onSelectProject,
  onAddProjectWithFile,
  onUpdateProject,
  onRelinkProjectFile,
  onSyncProjectFile,
  onExportProjectBackup,
  onImportProjectBackup,
  onSwitchToDatabase,
  isSyncing,
}) => {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientNumberPart1, setNewClientNumberPart1] = useState('');
  const [newClientNumberPart2, setNewClientNumberPart2] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Selected file handle during new project creation
  const [selectedFileHandle, setSelectedFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedSchemaType, setSelectedSchemaType] = useState<'tokki-equipment' | 'specforge-v2' | 'generic'>('generic');
  const [selectedRawDocument, setSelectedRawDocument] = useState<any>(null);
  const [parsedPreviewItems, setParsedPreviewItems] = useState<EquipmentItem[]>([]);
  const [fileMode, setFileMode] = useState<'existing' | 'new_empty' | 'none'>('none');
  const [creationError, setCreationError] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Active project quick-edit state
  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const [editingName, setEditingName] = useState(currentProject?.name || '');
  const [editingCode, setEditingCode] = useState(currentProject?.code || '');
  const [editingClient, setEditingClient] = useState(currentProject?.clientName || '');
  
  const initialClientParts = parseClientNumberParts(currentProject?.clientNumber, currentProject?.clientNumberPart1, currentProject?.clientNumberPart2);
  const [editingClientNumberPart1, setEditingClientNumberPart1] = useState(initialClientParts.p1);
  const [editingClientNumberPart2, setEditingClientNumberPart2] = useState(initialClientParts.p2);

  const [editingLocation, setEditingLocation] = useState(currentProject?.location || '');
  const [editingDepartment, setEditingDepartment] = useState(currentProject?.department || '');
  const [editingDesc, setEditingDesc] = useState(currentProject?.description || '');
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  React.useEffect(() => {
    if (currentProject) {
      setEditingName(currentProject.name);
      setEditingCode(currentProject.code);
      setEditingClient(currentProject.clientName);
      const parts = parseClientNumberParts(currentProject.clientNumber, currentProject.clientNumberPart1, currentProject.clientNumberPart2);
      setEditingClientNumberPart1(parts.p1);
      setEditingClientNumberPart2(parts.p2);
      setEditingLocation(currentProject.location || '');
      setEditingDepartment(currentProject.department || '');
      setEditingDesc(currentProject.description || '');
    }
  }, [
    currentProject?.id, 
    currentProject?.name, 
    currentProject?.code, 
    currentProject?.clientName, 
    currentProject?.clientNumber, 
    currentProject?.clientNumberPart1, 
    currentProject?.clientNumberPart2,
    currentProject?.location,
    currentProject?.department,
    currentProject?.description
  ]);

  const handleSaveActiveProjectMeta = () => {
    if (!currentProject || !onUpdateProject) return;
    const p1 = editingClientNumberPart1.trim();
    const p2 = editingClientNumberPart2.trim();
    const compositeClientNum = (p1 || p2) ? `【${p1}】-【${p2}】` : '';

    const updated: ProjectWorkspace = {
      ...currentProject,
      name: editingName.trim() || currentProject.name,
      code: editingCode.trim() || currentProject.code,
      clientName: editingClient.trim() || currentProject.clientName,
      clientNumber: compositeClientNum,
      clientNumberPart1: p1,
      clientNumberPart2: p2,
      location: editingLocation.trim(),
      department: editingDepartment.trim(),
      description: editingDesc.trim()
    };
    onUpdateProject(updated);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const fallbackFileInputRef = useRef<HTMLInputElement | null>(null);

  const projectItems = items.filter(i => i.projectId === activeProjectId);

  // Group by delivery date for schedule timeline
  const deliveryMap = projectItems.reduce((acc, it) => {
    const d = it.deliveryDate || '未定';
    if (!acc[d]) acc[d] = [];
    acc[d].push(it);
    return acc;
  }, {} as Record<string, EquipmentItem[]>);

  const deliverySchedule = Object.entries(deliveryMap).sort((a, b) => a[0].localeCompare(b[0]));

  // Category counts
  const categoryCounts = categories.map(cat => ({
    ...cat,
    count: projectItems.filter(it => it.categoryId === cat.id).length
  }));

  // Handle picking an existing JSON file for the new project
  const handlePickExistingJson = async () => {
    setCreationError('');
    if (!('showOpenFilePicker' in window)) {
      if (fallbackFileInputRef.current) fallbackFileInputRef.current.click();
      return;
    }

    try {
      setIsReadingFile(true);
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'JSON Database File',
            accept: { 'application/json': ['.json'] }
          }
        ],
        multiple: false
      });

      if (handle) {
        setSelectedFileHandle(handle);
        setSelectedFileName(handle.name);
        setFileMode('existing');

        // Parse content to verify and count items
        const { payload } = await readFromProjectHandle(
          handle,
          'temp-new-prj',
          categories[0]?.id || 'cat-etc'
        );
        setParsedPreviewItems(payload.items || []);
        setSelectedSchemaType(payload.schemaType || 'generic');
        setSelectedRawDocument(payload.rawDocument || null);

        // Autofill project name & code if detected from Tokki schema document
        if (payload.projects && payload.projects[0]) {
          if (!newProjectName) setNewProjectName(payload.projects[0].name);
          if (!newProjectCode) setNewProjectCode(payload.projects[0].code);
          if (payload.projects[0].description && !newDesc) setNewDesc(payload.projects[0].description);
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setCreationError(`JSONファイルの読み込みに失敗しました: ${err.message || '形式をご確認ください'}`);
      }
    } finally {
      setIsReadingFile(false);
    }
  };

  // Handle creating a new empty JSON file on disk
  const handleCreateNewJsonFile = async () => {
    setCreationError('');
    if (!('showSaveFilePicker' in window)) {
      setCreationError('お使いのブラウザはローカル新規保存APIに対応していません。「既存のJSONファイルを選択」をご利用ください。');
      return;
    }

    try {
      setIsReadingFile(true);
      const codeSuggest = newProjectCode.trim() || `PRJ-${new Date().getFullYear()}-${projects.length + 1}`;
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${codeSuggest}_database.json`,
        types: [
          {
            description: 'JSON Database File',
            accept: { 'application/json': ['.json'] }
          }
        ]
      });

      if (handle) {
        setSelectedFileHandle(handle);
        setSelectedFileName(handle.name);
        setFileMode('new_empty');
        setParsedPreviewItems([]);

        // Write initial empty database structure
        const writable = await (handle as any).createWritable();
        await writable.write(JSON.stringify({
          version: '2.0',
          lastUpdated: new Date().toISOString(),
          items: []
        }, null, 2));
        await writable.close();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setCreationError(`新規JSONファイルの作成に失敗しました: ${err.message}`);
      }
    } finally {
      setIsReadingFile(false);
    }
  };

  // Fallback file input change
  const handleFallbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsReadingFile(true);
      const text = await file.text();
      const raw = JSON.parse(text);
      const normalized = normalizeJsonToDatabase(raw, 'temp-new-prj', categories[0]?.id || 'cat-etc');
      setSelectedFileName(file.name);
      setFileMode('existing');
      setParsedPreviewItems(normalized.items || []);
    } catch (err: any) {
      setCreationError(`JSON解析エラー: ${err.message}`);
    } finally {
      setIsReadingFile(false);
      e.target.value = '';
    }
  };

  // Submit project creation
  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setCreationError('案件名を入力してください。');
      return;
    }

    if (!selectedFileName) {
      setCreationError('案件データベースとして紐づけるJSONファイルを指定してください（既存選択 または 新規作成）。');
      return;
    }

    const projectId = `prj-${Date.now()}`;
    const code = newProjectCode.trim() || `PRJ-${new Date().getFullYear()}-${projects.length + 1}`;

    const p1 = newClientNumberPart1.trim();
    const p2 = newClientNumberPart2.trim();
    const compositeClientNum = (p1 || p2) ? `【${p1}】-【${p2}】` : '';

    const newPrj: ProjectWorkspace = {
      id: projectId,
      name: newProjectName.trim(),
      code,
      clientName: newClientName.trim() || '特記仕様書調達案件',
      clientNumber: compositeClientNum,
      clientNumberPart1: p1,
      clientNumberPart2: p2,
      description: newDesc.trim() || (selectedSchemaType === 'tokki-equipment' ? '特記仕様書スキーマ(v1.0)連動案件' : 'JSONデータベース紐づけ案件'),
      createdAt: new Date().toISOString().slice(0, 10),
      linkedJsonFileName: selectedFileName,
      linkedJsonLastSync: new Date().toLocaleTimeString('ja-JP'),
      isLinkError: false,
      schemaType: selectedSchemaType,
      rawDocument: selectedRawDocument
    };

    // Re-assign items to this projectId
    const finalItems = parsedPreviewItems.map(it => ({
      ...it,
      projectId
    }));

    onAddProjectWithFile(newPrj, finalItems, selectedFileHandle || undefined);
    setIsCreatingProject(false);

    // Reset
    setNewProjectName('');
    setNewProjectCode('');
    setNewClientName('');
    setNewClientNumberPart1('');
    setNewClientNumberPart2('');
    setNewDesc('');
    setSelectedFileHandle(null);
    setSelectedFileName('');
    setParsedPreviewItems([]);
    setFileMode('none');
    setCreationError('');
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>案件サマリー ＆ JSONデータベース管理</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            案件ごとにJSONファイルを正本データベースとして紐づけ。機器の追加・修正が直接JSONに書き込まれます。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Backup JSON */}
          <button
            onClick={onExportProjectBackup}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="全案件のバックアップをPCに保存"
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-slate-500" />
            <span>全案件バックアップ</span>
          </button>

          <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>復元</span>
            <input type="file" accept=".json" onChange={onImportProjectBackup} className="hidden" />
          </label>

          <button
            onClick={() => {
              setIsCreatingProject(true);
              setCreationError('');
            }}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新しい案件を作成</span>
          </button>
        </div>
      </div>

      {/* Linked JSON Status for Active Project */}
      {currentProject && (
        <div className={`p-4 rounded-xl border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
          currentProject.isLinkError
            ? 'bg-red-50/90 border-red-300 text-red-900'
            : currentProject.linkedJsonFileName
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}>
          <div className="flex items-start gap-3">
            {currentProject.isLinkError ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
            ) : currentProject.linkedJsonFileName ? (
              <HardDrive className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <FileCode className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs">
                  {currentProject.isLinkError
                    ? '【参照エラー】紐づけ元のJSONファイルが見つかりません'
                    : currentProject.linkedJsonFileName
                    ? '正本JSONデータベースと連動中 (直接読み書き)'
                    : 'JSONファイルが未紐づけです'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  currentProject.isLinkError 
                    ? 'bg-red-200 text-red-800 font-bold' 
                    : currentProject.linkedJsonFileName 
                    ? 'bg-emerald-200 text-emerald-800' 
                    : 'bg-amber-200 text-amber-800'
                }`}>
                  {currentProject.code}
                </span>
              </div>

              <p className="text-[11px] mt-0.5 leading-relaxed">
                {currentProject.isLinkError ? (
                  <span className="text-red-700 font-medium">
                    {currentProject.linkErrorMessage || `ファイル「${currentProject.linkedJsonFileName}」が移動または削除されたか、アクセス権限が失われました。下のボタンから再度ファイルを選択してください。`}
                  </span>
                ) : currentProject.linkedJsonFileName ? (
                  <span>
                    紐づけファイル: <strong className="font-mono text-emerald-900">{currentProject.linkedJsonFileName}</strong> · 最終同期: {currentProject.linkedJsonLastSync || 'リアルタイム'} (5分毎に自動更新)
                  </span>
                ) : (
                  <span>
                    機器データの変更を社内共有ファイルへ直接反映させるには、JSONファイルを紐づけてください。
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {currentProject.isLinkError ? (
              <button
                type="button"
                onClick={() => onRelinkProjectFile(currentProject.id)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>JSONファイルを再指定・再紐づけ</span>
              </button>
            ) : currentProject.linkedJsonFileName ? (
              <>
                <button
                  type="button"
                  onClick={() => onSyncProjectFile(currentProject.id)}
                  disabled={isSyncing}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="共有ファイルから最新データを読み直す"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>最新同期</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRelinkProjectFile(currentProject.id)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-xs font-medium transition-colors"
                  title="紐づけるファイルパスを変更"
                >
                  <span>ファイル変更</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onRelinkProjectFile(currentProject.id)}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-300" />
                <span>JSONファイルを紐づける</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* New Project Creation Modal with JSON Binding */}
      {isCreatingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="font-bold text-sm">新しい案件の作成 ＆ JSON紐づけ</h2>
                  <p className="text-[11px] text-slate-400">社内共有またはローカルのJSONファイルを正本データベースとして紐づけます</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreatingProject(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} className="p-6 space-y-4 text-xs">
              {creationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{creationError}</span>
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    案件名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: 第2期 工場配管更新工事 調達案件"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">案件コード</label>
                  <input
                    type="text"
                    placeholder={`例: PRJ-${new Date().getFullYear()}-${projects.length + 1}`}
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">発注先・クライアント名</label>
                  <input
                    type="text"
                    placeholder="例: 〇〇エンジニアリング株式会社"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                {/* 客先番号: 【】-【】 */}
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>客先番号</span>
                    <span className="text-[10px] text-slate-400 font-normal font-mono">【】-【】形式</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 flex items-center bg-white border border-slate-300 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all">
                      <span className="text-slate-600 font-bold select-none text-xs font-sans mr-0.5">【</span>
                      <input
                        type="text"
                        placeholder="客先記号 (例: MC)"
                        value={newClientNumberPart1}
                        onChange={(e) => setNewClientNumberPart1(e.target.value)}
                        className="w-full text-xs font-mono font-bold text-center border-0 p-0 text-slate-900 focus:outline-hidden"
                      />
                      <span className="text-slate-600 font-bold select-none text-xs font-sans ml-0.5">】</span>
                    </div>
                    <span className="text-slate-400 font-bold select-none text-sm">-</span>
                    <div className="flex-1 flex items-center bg-white border border-slate-300 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all">
                      <span className="text-slate-600 font-bold select-none text-xs font-sans mr-0.5">【</span>
                      <input
                        type="text"
                        placeholder="番号 (例: 09821)"
                        value={newClientNumberPart2}
                        onChange={(e) => setNewClientNumberPart2(e.target.value)}
                        className="w-full text-xs font-mono font-bold text-center border-0 p-0 text-slate-900 focus:outline-hidden"
                      />
                      <span className="text-slate-600 font-bold select-none text-xs font-sans ml-0.5">】</span>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">案件概要・特記事項</label>
                  <input
                    type="text"
                    placeholder="例: バルブ・ポンプ・配管機器の調達仕様書作成用"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* JSON Database Binding Box */}
              <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4 space-y-3">
                <div>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <HardDrive className="w-4 h-4 text-indigo-600" />
                    <span>正本JSONデータベースの紐づけ設定 (必須)</span>
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    この案件で扱う機器データベースをJSONファイルと直結させます。以後の機器追加・変更・削除はすべてこのJSONファイルに自動書き込みされます。
                  </p>
                </div>

                {/* Binding Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePickExistingJson}
                    disabled={isReadingFile}
                    className="p-3 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-400 rounded-lg text-left transition-all shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-bold text-indigo-900 text-xs">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>既存のJSONを選択</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      社内共有フォルダ(NAS)やPC上の既存JSONを取り込んで紐づけ
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateNewJsonFile}
                    disabled={isReadingFile}
                    className="p-3 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-400 rounded-lg text-left transition-all shadow-2xs group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-bold text-indigo-900 text-xs">
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      <span>新規JSONを作成・保存</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      保存先フォルダを指定して新規の空JSONファイルを初期化紐づけ
                    </p>
                  </button>
                </div>

                <input
                  type="file"
                  ref={fallbackFileInputRef}
                  accept=".json"
                  onChange={handleFallbackFileChange}
                  className="hidden"
                />

                {/* Tokki Schema v1.1 Download & Helper */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800">特記仕様書スキーマ(v1.1 改定版)</span>
                      <p className="text-[10px] text-slate-500">
                        Copilot等のエージェントでJSONを生成する際に読み込ませるスキーマ定義（塗装仕様・案件カテゴリ・変更履歴ログに対応）
                      </p>
                    </div>
                  </div>
                  <a
                    href="/assets/aistudio/tokki_equipment_v1_1.schema.json"
                    download="tokki_equipment_v1_1.schema.json"
                    className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>スキーマDL</span>
                  </a>
                </div>

                {/* Binding Selected Status */}
                {selectedFileName ? (
                  <div className="p-3 bg-white border border-emerald-300 rounded-lg flex items-center justify-between text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5 flex-wrap">
                          <span>{selectedFileName}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-sans font-normal">
                            {fileMode === 'existing' ? '既存ファイル読込' : '新規ファイル作成'}
                          </span>
                          {selectedSchemaType === 'tokki-equipment' && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-sans font-semibold">
                              特記仕様書スキーマ(v1.0/v1.1対応)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {fileMode === 'existing' 
                            ? `${parsedPreviewItems.length} 点の機器データを検出しました` 
                            : '空のデータベースとして初期化されます'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded">
                      紐づけ準備完了
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 text-center py-2 border border-dashed border-indigo-200 rounded-lg">
                    上のいずれかを選択してJSONファイルを指定してください
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!selectedFileName || isReadingFile}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-md flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>案件を作成してデータベース切替</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Common Information Editor (Uniformly applied to Specification Documents) */}
      {currentProject && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-900">
                  案件共通情報（仕様書に一律で自動反映）
                </h2>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-mono font-medium">
                  仕様書共通連携
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ここで設定した案件名・工事コード・発注者・工事場所は、この案件のすべての仕様書に一律で自動転記されます。
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isSavedNotice && (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>保存しました</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveActiveProjectMeta}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>案件情報を保存（仕様書に反映）</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                案件名 / 工事名称 <span className="text-indigo-600">*</span>
              </label>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="例: 令和8年度 配水本管更新工事"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                工事コード / 案件番号 <span className="text-indigo-600">*</span>
              </label>
              <input
                type="text"
                value={editingCode}
                onChange={(e) => setEditingCode(e.target.value)}
                placeholder="例: CW-2026-081"
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-indigo-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* 客先番号: 【】-【】 */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1 flex items-center justify-between">
                <span>客先番号</span>
                <span className="text-[10px] text-slate-400 font-mono">【】-【】</span>
              </label>
              <div className="flex items-center gap-1">
                <div className="flex-1 flex items-center bg-slate-50 border border-slate-300 rounded px-1.5 py-1 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                  <span className="text-slate-600 font-bold select-none text-xs font-sans mr-0.5">【</span>
                  <input
                    type="text"
                    value={editingClientNumberPart1}
                    onChange={(e) => setEditingClientNumberPart1(e.target.value)}
                    placeholder="記号"
                    className="w-full text-xs font-mono font-bold text-center bg-transparent border-0 p-0 text-slate-900 focus:outline-hidden"
                  />
                  <span className="text-slate-600 font-bold select-none text-xs font-sans ml-0.5">】</span>
                </div>
                <span className="text-slate-400 font-bold select-none text-sm">-</span>
                <div className="flex-1 flex items-center bg-slate-50 border border-slate-300 rounded px-1.5 py-1 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                  <span className="text-slate-600 font-bold select-none text-xs font-sans mr-0.5">【</span>
                  <input
                    type="text"
                    value={editingClientNumberPart2}
                    onChange={(e) => setEditingClientNumberPart2(e.target.value)}
                    placeholder="番号"
                    className="w-full text-xs font-mono font-bold text-center bg-transparent border-0 p-0 text-slate-900 focus:outline-hidden"
                  />
                  <span className="text-slate-600 font-bold select-none text-xs font-sans ml-0.5">】</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                発注者 / クライアント名
              </label>
              <input
                type="text"
                value={editingClient}
                onChange={(e) => setEditingClient(e.target.value)}
                placeholder="例: 〇〇市水道局 / 発注元企業"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                工事場所 / 納入設置場所
              </label>
              <input
                type="text"
                value={editingLocation}
                onChange={(e) => setEditingLocation(e.target.value)}
                placeholder="例: 〇〇市〇〇町1丁目地内"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                担当部署 / 仕様書発行元
              </label>
              <input
                type="text"
                value={editingDepartment}
                onChange={(e) => setEditingDepartment(e.target.value)}
                placeholder="例: 技術統括部 設計課"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                案件概要・備考
              </label>
              <input
                type="text"
                value={editingDesc}
                onChange={(e) => setEditingDesc(e.target.value)}
                placeholder="例: 第1工区 バルブおよび配管機器調達"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">登録機器総数</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {projectItems.length} <span className="text-xs font-normal text-slate-500">点</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">データベース登録済</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">カテゴリ分類数</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {categories.length} <span className="text-xs font-normal text-slate-500">種別</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">ドラッグ＆ドロップ対応</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">納入時期設定済件数</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {deliverySchedule.length} <span className="text-xs font-normal text-slate-500">期日グループ</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">直近の納入時期: {deliverySchedule[0]?.[0] || '-'}</div>
        </div>
      </div>

      {/* Projects List with JSON Link Indicators */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 flex items-center gap-1.5">
            <FolderKanban className="w-4 h-4 text-slate-600" />
            <span>登録案件一覧 ({projects.length})</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => {
            const isCurrent = p.id === activeProjectId;
            const pCount = items.filter(it => it.projectId === p.id).length;

            return (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  isCurrent
                    ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isCurrent ? 'bg-slate-800 text-indigo-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {p.code}
                    </span>
                    {(p.clientNumber || p.clientNumberPart1 || p.clientNumberPart2) && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        isCurrent ? 'bg-indigo-950 text-indigo-200 border border-indigo-800' : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        客先: {p.clientNumber || `【${p.clientNumberPart1 || ''}】-【${p.clientNumberPart2 || ''}】`}
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] font-mono tabular-nums ${isCurrent ? 'text-slate-300' : 'text-slate-400'}`}>
                    機器数: {pCount} 点
                  </span>
                </div>

                <div className="font-bold text-sm mt-1.5 leading-snug">
                  {p.name}
                </div>

                <p className={`text-[11px] mt-0.5 line-clamp-1 ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                  {p.description}
                </p>

                {/* Linked JSON status indicator on card */}
                <div className={`mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] font-mono ${
                  isCurrent ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-500'
                }`}>
                  <div className="flex items-center gap-1 truncate max-w-[200px]">
                    {p.isLinkError ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : (
                      <HardDrive className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-indigo-300' : 'text-emerald-600'}`} />
                    )}
                    <span className="truncate">{p.linkedJsonFileName || 'JSON未紐づけ'}</span>
                  </div>

                  <span className="text-[10px]">
                    {isCurrent ? '選択中' : 'クリックで切替'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown & Delivery Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Category breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-slate-600" />
              <span>カテゴリ別 機器構成</span>
            </span>
            <button
              onClick={onSwitchToDatabase}
              className="text-indigo-600 hover:underline flex items-center gap-0.5 text-[11px]"
            >
              <span>一覧で編集</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2">
            {categoryCounts.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="font-medium text-slate-800">{cat.name}</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {cat.count} 点
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Schedule Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-600" />
              <span>納入時期別スケジュール一覧</span>
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {deliverySchedule.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">機器データが登録されていません。</p>
            ) : (
              deliverySchedule.map(([date, group]) => (
                <div key={date} className="p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-slate-900">{date}</span>
                    <span className="text-[11px] text-slate-500 font-medium">{group.length} 点納品予定</span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {group.map(g => `[${g.tagNo || '-'}] ${g.name}`).join(', ')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
