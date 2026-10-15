import React from 'react';
import { 
  Database, 
  FileText, 
  Settings2, 
  FolderKanban, 
  FolderSync,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import { ProjectWorkspace } from '../types';
import { SyncConfig } from '../utils/sharedSyncManager';

interface HeaderProps {
  activeTab: 'database' | 'spec_studio' | 'templates' | 'projects';
  onTabChange: (tab: 'database' | 'spec_studio' | 'templates' | 'projects') => void;
  projects: ProjectWorkspace[];
  activeProjectId: string;
  onProjectChange: (projectId: string) => void;
  totalItemsCount: number;
  syncConfig: SyncConfig;
  onOpenSyncModal: () => void;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  projects,
  activeProjectId,
  onProjectChange,
  totalItemsCount,
  syncConfig,
  onOpenSyncModal,
  isSyncing
}) => {
  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">
          
          {/* Zone 1: Brand & Current Workspace */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-2xs">
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
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
              onClick={() => onTabChange('templates')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'templates'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>テンプレート設定</span>
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
              <span>案件サマリー</span>
            </button>
          </nav>

          {/* Zone 3: Shared Network Sync Status & Project Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Network Sync status badge with click to configure */}
            <button
              onClick={onOpenSyncModal}
              className={`flex items-center gap-1.5 text-[11px] font-medium border rounded-md px-2.5 py-1 shadow-2xs transition-colors ${
                syncConfig.mode !== 'none'
                  ? 'text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                  : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
              title="社内共有フォルダ(JSON)との自動同期設定を開く"
            >
              <FolderSync className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-600' : syncConfig.mode !== 'none' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">
                {syncConfig.mode === 'file_handle' 
                  ? '社内共有同期: ON (5分毎)' 
                  : syncConfig.mode === 'network_url' 
                  ? '社内URL同期: ON' 
                  : '共有同期: 未設定'}
              </span>
              <span className="sm:hidden">共有同期</span>
            </button>

            {/* Project Switcher */}
            <div className="hidden md:flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={activeProjectId}
                onChange={(e) => onProjectChange(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 focus:outline-hidden cursor-pointer max-w-[120px] truncate"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
