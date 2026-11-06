import React from 'react';
import { AlertTriangle, Save, Trash2, X, ArrowRight, HardDrive } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void> | void;
  onDiscard: () => void;
  projectName?: string;
  projectCode?: string;
  fileName?: string;
  isSaving?: boolean;
  reason?: 'exit' | 'switch-project' | 'manual';
  targetProjectName?: string;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  projectName = '案件',
  projectCode,
  fileName,
  isSaving = false,
  reason = 'manual',
  targetProjectName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">未保存の変更があります</h2>
              <p className="text-[11px] text-slate-500">
                {reason === 'exit' 
                  ? 'ページの終了・離脱を行う前に変更を保存してください' 
                  : reason === 'switch-project' 
                    ? '案件を切り替える前に現在の編集内容を保存してください' 
                    : '編集内容がまだJSONファイルに書き込まれていません'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">対象案件:</span>
              <span className="font-semibold text-slate-900">
                {projectCode ? `[${projectCode}] ` : ''}{projectName}
              </span>
            </div>
            {fileName && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">紐づけJSON:</span>
                <span className="font-mono text-slate-700 flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                  {fileName}
                </span>
              </div>
            )}
            {reason === 'switch-project' && targetProjectName && (
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-indigo-700">
                <span className="font-medium">切り替え先:</span>
                <span className="font-bold flex items-center gap-1">
                  <ArrowRight className="w-3.5 h-3.5" />
                  {targetProjectName}
                </span>
              </div>
            )}
          </div>

          <p className="text-slate-600 leading-relaxed">
            機器の追加・仕様編集・納入時期の変更・カテゴリ並び替えなどの編集内容がメモリ内に保持されています。
            <strong className="text-slate-900 font-semibold block mt-1">
              このまま保存せずに終了または画面を離れると、前回の保存以降の編集データは失われます。
            </strong>
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5 text-[11px] text-blue-900 flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <span>
              「今すぐJSONファイルに保存」を押すと、紐づけられているローカル/ネットワークドライブのJSONファイルに最新の機器データが即時上書き保存されます。
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onDiscard}
            className="w-full sm:w-auto px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            title="未保存の変更を破棄して続行します"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>保存せずに続行（破棄）</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 bg-white border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              編集を続ける（留まる）
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? '保存中...' : '今すぐJSONファイルに保存'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
