import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import { ProjectWorkspace, EquipmentItem, Category } from '../types';

interface ProjectSummaryTabProps {
  projects: ProjectWorkspace[];
  activeProjectId: string;
  items: EquipmentItem[];
  categories: Category[];
  onSelectProject: (id: string) => void;
  onAddProject: (project: ProjectWorkspace) => void;
  onExportProjectBackup: () => void;
  onImportProjectBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSwitchToDatabase: () => void;
}

export const ProjectSummaryTab: React.FC<ProjectSummaryTabProps> = ({
  projects,
  activeProjectId,
  items,
  categories,
  onSelectProject,
  onAddProject,
  onExportProjectBackup,
  onImportProjectBackup,
  onSwitchToDatabase,
}) => {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const currentProject = projects.find(p => p.id === activeProjectId) || projects[0];
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

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newPrj: ProjectWorkspace = {
      id: `prj-${Date.now()}`,
      name: newProjectName.trim(),
      code: newProjectCode.trim() || `PRJ-${new Date().getFullYear()}-${projects.length + 1}`,
      clientName: newClientName.trim() || '社内調達案件',
      description: newDesc.trim() || '新規作成された調達仕様書案件',
      createdAt: new Date().toISOString().slice(0, 10)
    };

    onAddProject(newPrj);
    onSelectProject(newPrj.id);
    setIsCreatingProject(false);
    setNewProjectName('');
    setNewProjectCode('');
    setNewClientName('');
    setNewDesc('');
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">案件サマリー・ファイル管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            案件ごとの進捗・機器構成・納期スケジュールの確認、および完全オフラインでのバックアップ保存が可能です。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Backup JSON */}
          <button
            onClick={onExportProjectBackup}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="案件データベース全体をオフラインJSONファイルとしてPCに保存"
          >
            <HardDriveDownload className="w-3.5 h-3.5 text-slate-500" />
            <span>ローカル保存 (JSON)</span>
          </button>

          <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>ファイル復元</span>
            <input type="file" accept=".json" onChange={onImportProjectBackup} className="hidden" />
          </label>

          <button
            onClick={() => setIsCreatingProject(true)}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新しい案件を作成</span>
          </button>
        </div>
      </div>

      {/* Security & Offline Explanation Card */}
      <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3.5 flex items-start gap-3 text-xs text-emerald-900 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold flex items-center gap-2">
            <span>セキュリティ・オフライン動作に関する保証</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">100% Client-Side</span>
          </div>
          <p className="text-emerald-800 text-[11px] leading-relaxed">
            本システムはすべてのデータ処理（機器登録・Excelテンプレート解析・仕様書生成・履歴管理）がお使いの端末（ブラウザ内部のlocalStorage）のみで完結しています。
            外部のクラウドサーバーやデータベースへのデータ送信・通信は一切行われませんので、機密性の高いプラント設備や調達情報も安全に運用可能です。
          </p>
        </div>
      </div>

      {/* New Project Form Modal */}
      {isCreatingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-3.5 text-xs">
            <h3 className="text-sm font-bold text-slate-900">新規案件の作成</h3>
            <form onSubmit={handleCreateProjectSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">案件名称 *</label>
                <input
                  type="text"
                  required
                  placeholder="例: 第2工場 配管改修工事機器調達"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">案件コード</label>
                <input
                  type="text"
                  placeholder="例: PRJ-2026-02"
                  value={newProjectCode}
                  onChange={(e) => setNewProjectCode(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">発注先 / 顧客名</label>
                <input
                  type="text"
                  placeholder="例: 〇〇エンジニアリング株式会社"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">概要・特記事項</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white font-medium rounded hover:bg-slate-800"
                >
                  作成して切替
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KPI Overview Strip (Zero monetary values!) */}
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
          <div className="text-xs text-slate-500 font-medium">納期設定済件数</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {deliverySchedule.length} <span className="text-xs font-normal text-slate-500">期日グループ</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">最短納期: {deliverySchedule[0]?.[0] || '-'}</div>
        </div>
      </div>

      {/* Current Project Info & Category Breakdown */}
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
              <span>納期別スケジュール一覧</span>
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
