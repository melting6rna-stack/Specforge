import React, { useState } from 'react';
import { 
  X, 
  FolderSync, 
  HardDrive, 
  Globe, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  AlertCircle,
  FileCode,
  Link,
  Unlink
} from 'lucide-react';
import { SyncConfig } from '../utils/sharedSyncManager';

interface SharedSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncConfig: SyncConfig;
  onUpdateConfig: (config: SyncConfig) => void;
  onSelectLocalFile: () => Promise<void>;
  onUnlinkFile: () => Promise<void>;
  onTriggerManualSync: () => Promise<void>;
  lastSyncTime?: string;
  isSyncing: boolean;
}

export const SharedSyncModal: React.FC<SharedSyncModalProps> = ({
  isOpen,
  onClose,
  syncConfig,
  onUpdateConfig,
  onSelectLocalFile,
  onUnlinkFile,
  onTriggerManualSync,
  lastSyncTime,
  isSyncing
}) => {
  if (!isOpen) return null;

  const [networkUrlInput, setNetworkUrlInput] = useState(syncConfig.networkUrl || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLinkFile = async () => {
    setErrorMessage('');
    try {
      await onSelectLocalFile();
      setStatusMessage('共有ネットワーク上のJSONファイルと正常に紐付けました。');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setErrorMessage(e.message || 'ファイルの選択に失敗しました。');
      }
    }
  };

  const handleSaveNetworkUrl = () => {
    if (!networkUrlInput.trim()) {
      setErrorMessage('URLを入力してください。');
      return;
    }
    onUpdateConfig({
      ...syncConfig,
      mode: 'network_url',
      networkUrl: networkUrlInput.trim()
    });
    setStatusMessage('社内ネットワークURLを保存しました。');
    setTimeout(() => setStatusMessage(''), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-6 flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <FolderSync className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">社内共有ネットワーク同期設定</h2>
              <p className="text-[11px] text-slate-400">
                共有フォルダ内のJSONファイルを参照し、複数人での最新データ共有・5分ごとの自動更新を設定します
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          
          {statusMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sync Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">現在の参照ステータス:</div>
              <div className="font-bold text-slate-900 text-xs mt-0.5 flex items-center gap-1.5">
                {syncConfig.mode === 'file_handle' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>社内共有ファイル連携中 ({syncConfig.networkFileName || 'specforge_db.json'})</span>
                  </>
                ) : syncConfig.mode === 'network_url' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>社内ネットワークURL連携中</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>個人の単独ローカルストレージ参照中 (非同期)</span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                最終同期: {lastSyncTime || '未同期'}
              </div>
            </div>

            <button
              onClick={onTriggerManualSync}
              disabled={isSyncing || syncConfig.mode === 'none'}
              className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition-colors ${
                syncConfig.mode !== 'none'
                  ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-2xs'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '同期中...' : '今すぐ同期'}</span>
            </button>
          </div>

          {/* 5-minute Auto-refresh toggle */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <span className="font-bold text-slate-900">ページ表示中の5分ごと自動更新</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncConfig.autoSyncEnabled}
                  onChange={(e) => onUpdateConfig({ ...syncConfig, autoSyncEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ブラウザのタブを開いている間のみ、5分（300秒）ごとに共有元を自動ポーリングします。他のユーザーが機器情報を更新または追加した際、最新状態をシームレスに取り込みます。
            </p>
          </div>

          {/* Option A: Link Network File */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-slate-900">方法 1: 社内共有フォルダ（ファイルサーバー・NAS）のJSONファイルと紐付け</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              社内のネットワークドライブ（例: <code>Z:\共有フォルダ\specforge_db.json</code> や <code>\\fileserver\share\specforge_db.json</code>）にあるJSONファイルを一度指定すると、ブラウザが記憶し、次回以降ページを開いた際に自動で最新ファイルを参照します。
            </p>

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleLinkFile}
                className="px-3.5 py-1.5 bg-slate-900 text-white font-medium rounded hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Link className="w-3.5 h-3.5" />
                <span>共有フォルダ内のJSONファイルを選択・紐付け</span>
              </button>

              {syncConfig.mode === 'file_handle' && (
                <button
                  type="button"
                  onClick={onUnlinkFile}
                  className="px-3 py-1.5 text-slate-600 hover:text-red-600 border border-slate-300 rounded hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>紐付け解除</span>
                </button>
              )}
            </div>
          </div>

          {/* Option B: Intranet URL */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-slate-900">方法 2: 社内Webサーバー / NASのURLを指定</span>
            </div>
            <p className="text-[11px] text-slate-600">
              社内LAN内のWebサーバーやAPIエンドポイントでJSONが配信されている場合は、URLを指定して定期取得できます。
            </p>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="url"
                placeholder="例: http://192.168.1.100:8080/specforge_db.json"
                value={networkUrlInput}
                onChange={(e) => setNetworkUrlInput(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={handleSaveNetworkUrl}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded transition-colors whitespace-nowrap"
              >
                URLを保存
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 transition-colors"
          >
            設定を閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
