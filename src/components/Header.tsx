import React from 'react';
import { 
  Database, 
  FileText, 
  Settings2, 
  FolderKanban, 
  HardDrive,
  FolderOpen,
  Download,
  RefreshCw,
  AlertTriangle,
  FileCode,
  Save
} from 'lucide-react';
import { ProjectWorkspace } from '../types';

interface HeaderProps {
  activeTab: 'database' | 'spec_studio' | 'templates' | 'projects';
  onTabChange: (tab: 'database' | 'spec_studio' | 'templates' | 'projects') => void;
  projects: ProjectWorkspace[];
  activeProjectId: string;
  onProjectChange: (projectId: string) => void;
  totalItemsCount: number;
  isSyncing: boolean;
  onManualSync: () => void;
  onRelinkFile: () => void;
  onReconnectFile?: () => void;
  hasUnsavedChanges?: boolean;
  onManualSave?: () => void;
  isSaving?: boolean;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  projects,
  activeProjectId,
  onProjectChange,
  totalItemsCount,
  isSyncing,
  onManualSync,
  onRelinkFile,
  onReconnectFile,
  hasUnsavedChanges,
  onManualSave,
  isSaving,
  canInstallPwa,
  onInstallPwa
}) => {
  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          
          {/* Zone 1: Brand & Current Workspace */}
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/assets/aistudio/_____20261113_76ad5948.png"
              alt="SpecForge"
              className="w-8 h-8 rounded-lg object-cover shadow-2xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-slate-900">SpecForge</span>
                <span className="text-xs text-slate-300">|</span>
                <span className="text-xs font-medium text-slate-600 truncate max-w-[180px]">
                  {currentProject?.name}
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">({totalItemsCount}点)</span>
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => onTabChange('database')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'database'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>機器データベース</span>
            </button>

            <button
              onClick={() => onTabChange('spec_studio')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'spec_studio'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>仕様書プレビュー・出力</span>
            </button>

            <button
              onClick={() => onTabChange('projects')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'projects'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>案件サマリー・JSON</span>
            </button>
          </nav>

          {/* Zone 3: Linked Project JSON Status & Project Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Unsaved Changes Save Button (Global across all tabs) */}
            {hasUnsavedChanges && (
              <button
                onClick={onManualSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-md shadow-xs animate-pulse transition-all cursor-pointer"
                title="未保存の変更があります。クリックしてJSONファイルに書き込み保存します"
              >
                <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>未保存あり (JSON保存)</span>
              </button>
            )}

            {/* Linked JSON File Status for Current Project */}
            {currentProject?.isLinkError ? (
              <button
                onClick={onRelinkFile}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-300 rounded-md px-2.5 py-1 shadow-2xs transition-colors cursor-pointer"
                title={currentProject.linkErrorMessage || '紐づけ元のJSONファイルが見つかりません。再選択してください。'}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                <span className="hidden sm:inline">JSON未検出 (再指定)</span>
                <span className="sm:hidden">再指定</span>
              </button>
            ) : currentProject?.needsLinkPermission && currentProject?.linkedJsonFileName ? (
              <button
                onClick={() => (onReconnectFile ? onReconnectFile() : onManualSync())}
                disabled={isSyncing}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-md px-2.5 py-1 shadow-2xs transition-colors cursor-pointer"
                title={`「${currentProject.linkedJsonFileName}」との紐づけは維持されています。クリックしてアクセスを許可・連動再開してください（ファイル再選択不要）`}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="font-mono truncate max-w-[110px]">{currentProject.linkedJsonFileName}</span>
                <span className="hidden sm:inline text-sky-700 font-bold">· 連動再開</span>
              </button>
            ) : currentProject?.linkedJsonFileName ? (
              <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-md px-2.5 py-1 shadow-2xs">
                <HardDrive className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono truncate max-w-[110px]" title={`紐づけJSON: ${currentProject.linkedJsonFileName} (自動読書連動)`}>
                  {currentProject.linkedJsonFileName}
                </span>
                <button
                  onClick={onManualSync}
                  className="p-0.5 hover:bg-emerald-100 text-emerald-700 rounded transition-colors ml-0.5 cursor-pointer"
                  title="紐づけJSONファイルから最新状態を再同期"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ) : null}

            {/* Project Switcher */}
            <div className="hidden md:flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={activeProjectId}
                onChange={(e) => onProjectChange(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-hidden cursor-pointer max-w-[120px] truncate"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.orderNo || p.code}: {p.name}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
