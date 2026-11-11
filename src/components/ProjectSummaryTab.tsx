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
  Save,
  Edit3,
  Hash,
  ExternalLink,
  Building2
} from 'lucide-react';
import { ProjectWorkspace, EquipmentItem, Category } from '../types';
import { readFromProjectHandle, normalizeJsonToDatabase } from '../utils/sharedSyncManager';
import { ProjectDetailModal } from './ProjectDetailModal';

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
  onInstallPwa?: () => void;
  onDeleteProject?: (projectId: string) => void;
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

const parseCodeParts = (code?: string, part1?: string, part2?: string) => {
  if (part1 !== undefined && part1 !== null && part2 !== undefined && part2 !== null) {
    return { c1: part1, c2: part2 };
  }
  if (!code) return { c1: '', c2: '' };
  const dashIndex = code.indexOf('-');
  if (dashIndex !== -1) {
    return {
      c1: code.slice(0, dashIndex),
      c2: code.slice(dashIndex + 1)
    };
  }
  return { c1: code, c2: '' };
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
  onInstallPwa,
  onDeleteProject,
}) => {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<ProjectWorkspace | null>(null);

  // New project creation state
  const [newProjectName, setNewProjectName] = useState('');
  const [newOrderNo, setNewOrderNo] = useState('');
  const [newCodePart1, setNewCodePart1] = useState('');
  const [newCodePart2, setNewCodePart2] = useState('');
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

  // Active project
  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const otherProjects = projects.filter(p => p.id !== currentProject?.id);

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
    const c1 = newCodePart1.trim();
    const c2 = newCodePart2.trim();
    const combinedCode = c1 ? (c2 ? `${c1}-${c2}` : c1) : (newProjectCode.trim() || `PRJ-${new Date().getFullYear()}-${projects.length + 1}`);

    const p1 = newClientNumberPart1.trim();
    const p2 = newClientNumberPart2.trim();
    const compositeClientNum = (p1 || p2) ? `【${p1}】-【${p2}】` : '';

    const newPrj: ProjectWorkspace = {
      id: projectId,
      orderNo: newOrderNo.trim(),
      name: newProjectName.trim(),
      code: combinedCode,
      codePart1: c1,
      codePart2: c2,
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
    setNewOrderNo('');
    setNewCodePart1('');
    setNewCodePart2('');
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
      
      {/* Projects List with JSON Link Indicators (Moved to top of Project Summary) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
              <FolderKanban className="w-4 h-4 text-slate-700" />
              <span>登録案件一覧 ({projects.length})</span>
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              左側で選択中案件の情報を確認し、右下の「基本情報編集」ボタンから編集できます。右側の一覧をクリックすると案件が切り替わります。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreatingProject(true);
              setCreationError('');
            }}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新しい案件を作成</span>
          </button>
        </div>

        {/* 2-Column Layout: Left = Selected Project Details, Right = Other Registered Projects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Left Column: Currently Selected Project Details */}
          {currentProject ? (
            <div className="bg-slate-900 text-white rounded-xl p-4 shadow-2xs border border-slate-900 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {currentProject.orderNo && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                        Ord: {currentProject.orderNo}
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300">
                      コード: {currentProject.code}
                    </span>
                    {(currentProject.clientNumber || currentProject.clientNumberPart1 || currentProject.clientNumberPart2) && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-slate-800 text-slate-300">
                        客先No: {currentProject.clientNumber || `【${currentProject.clientNumberPart1 || ''}】-【${currentProject.clientNumberPart2 || ''}】`}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-300">
                    機器数: {items.filter(it => it.projectId === currentProject.id).length} 点
                  </span>
                </div>

                <div className="font-bold text-sm leading-snug text-white pt-1">
                  {currentProject.name}
                </div>

                {currentProject.clientName && (
                  <div className="text-[11px] font-medium text-indigo-200 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>客先: {currentProject.clientName}</span>
                  </div>
                )}

                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                  {currentProject.description || '案件備考なし'}
                </p>
              </div>

              {/* Card Footer: Linked JSON status & basic info edit button ONLY */}
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                  {currentProject.isLinkError ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                  )}
                  <span className="truncate">{currentProject.linkedJsonFileName || 'JSON未紐づけ'}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProjectForEdit(currentProject);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-colors cursor-pointer"
                  title="この案件の基本情報（オーダーNo.・案件コード・案件名・客先名）を編集"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>基本情報編集</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              案件が選択されていません
            </div>
          )}

          {/* Right Column: Other / Unselected Registered Projects (Name Only) */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-200/80 pb-2">
                <span className="flex items-center gap-1.5">
                  <span>登録済み案件一覧 ({otherProjects.length}件)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  クリックで選択
                </span>
              </div>

              {otherProjects.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-xs text-slate-400">
                  <FolderKanban className="w-6 h-6 text-slate-300 mb-1" />
                  <span>他に登録された案件はありません</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">右上の「+ 新しい案件を作成」から新規案件を追加できます</span>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {otherProjects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      className="px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-slate-800 font-bold text-xs transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs group"
                      title={`クリックして「${p.name}」を選択`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] font-normal text-slate-400 group-hover:text-indigo-600 font-mono shrink-0 flex items-center gap-0.5">
                        <span>選択</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-right">
              ※案件名をクリックすると選択案件が切り替わります
            </div>
          </div>
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
                <button
                  type="button"
                  onClick={() => setSelectedProjectForEdit(currentProject)}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  title="案件の共通基本情報（オーダーNo, 案件コード, 客先等）を確認・編集"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>基本情報を確認・編集</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onRelinkProjectFile(currentProject.id)}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-300" />
                  <span>JSONファイルを紐づける</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProjectForEdit(currentProject)}
                  className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>基本情報</span>
                </button>
              </>
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
                    案件名 <span className="text-red-500">*</span> <span className="text-slate-400 font-normal">(例: 〇〇市水道工事)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: 令和8年度 〇〇市水道工事 配水管敷設"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    オーダーNo. <span className="text-slate-400 font-normal">(例: 202500444)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例: 202500444"
                    value={newOrderNo}
                    onChange={(e) => setNewOrderNo(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono font-bold focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>案件コード <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-slate-400 font-normal font-mono">[前半] - [後半] (例: 20345-001)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="20345"
                      value={newCodePart1}
                      onChange={(e) => setNewCodePart1(e.target.value)}
                      className="flex-1 text-xs font-mono font-bold text-center border border-slate-300 rounded px-2.5 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                    <span className="text-slate-400 font-bold select-none">-</span>
                    <input
                      type="text"
                      placeholder="001"
                      value={newCodePart2}
                      onChange={(e) => setNewCodePart2(e.target.value)}
                      className="w-24 text-xs font-mono font-bold text-center border border-slate-300 rounded px-2.5 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    客先名 / 発注元 <span className="text-slate-400 font-normal">(例: 〇〇市水道局)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例: 〇〇市水道局"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
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

      {/* Database & Full Project Management Banner (Moved to bottom of Project Summary) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>案件サマリー ＆ JSONデータベース管理</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            案件ごとにJSONファイルを正本データベースとして紐づけ。機器の追加・修正が直接JSONに書き込まれます。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Backup JSON */}
          <button
            type="button"
            onClick={onExportProjectBackup}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
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
            type="button"
            onClick={() => {
              setIsCreatingProject(true);
              setCreationError('');
            }}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新しい案件を作成</span>
          </button>
        </div>
      </div>

      {/* PC App Install / Desktop App Section (Moved from top header) */}
      {onInstallPwa && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">PCにアプリ保存 (デスクトップアプリ化)</div>
              <div className="text-slate-500 text-xs">
                ブラウザを開かずにWindows/Macのデスクトップから直接起動でき、案件JSONファイルとも高速に連動します。
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onInstallPwa}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer whitespace-nowrap transition-colors shrink-0"
            title="このアプリをWindows/MacのデスクトップアプリとしてPCに保存 (オフライン起動可能)"
          >
            <Download className="w-4 h-4" />
            <span>PCにアプリ保存</span>
          </button>
        </div>
      )}

      {/* Detailed Project Basic Info Edit Modal */}
      <ProjectDetailModal
        isOpen={Boolean(selectedProjectForEdit)}
        project={selectedProjectForEdit}
        onClose={() => setSelectedProjectForEdit(null)}
        onSave={(updated) => {
          onUpdateProject?.(updated);
          setSelectedProjectForEdit(null);
        }}
        onRelinkJson={onRelinkProjectFile}
        onDeleteProject={onDeleteProject}
      />

    </div>
  );
};

