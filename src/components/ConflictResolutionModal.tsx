import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  GitMerge,
  Check,
  X,
  HardDrive,
  User,
  Save,
} from 'lucide-react';
import {
  ConflictChoice,
  EquipmentConflict,
  LedgerConflict,
} from '../utils/mergeConflictUtils';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflictType: 'equipment' | 'ledger';
  fileName?: string;
  projectName?: string;
  equipmentConflicts?: EquipmentConflict[];
  ledgerConflicts?: LedgerConflict[];
  autoMergedInfoText?: string;
  isSaving?: boolean;
  onCancel: () => void;
  onResolve: (resolutions: Record<string, ConflictChoice>) => Promise<void> | void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflictType,
  fileName,
  projectName,
  equipmentConflicts = [],
  ledgerConflicts = [],
  autoMergedInfoText,
  isSaving = false,
  onCancel,
  onResolve,
}) => {
  const [resolutions, setResolutions] = useState<Record<string, ConflictChoice>>({});

  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, ConflictChoice> = {};
    for (const c of equipmentConflicts) {
      init[c.conflictId] = 'disk';
    }
    for (const c of ledgerConflicts) {
      init[c.conflictId] = 'disk';
    }
    setResolutions(init);
  }, [isOpen, equipmentConflicts, ledgerConflicts]);

  if (!isOpen) return null;

  const totalConflicts =
    conflictType === 'equipment' ? equipmentConflicts.length : ledgerConflicts.length;

  const handleSetAll = (choice: ConflictChoice) => {
    const next: Record<string, ConflictChoice> = {};
    if (conflictType === 'equipment') {
      for (const c of equipmentConflicts) next[c.conflictId] = choice;
    } else {
      for (const c of ledgerConflicts) next[c.conflictId] = choice;
    }
    setResolutions(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-200 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">
                  同時編集による競合を検出しました（{totalConflicts}件）
                </h2>
                {fileName && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-white border border-rose-200 text-rose-800 px-2 py-0.5 rounded">
                    <HardDrive className="w-3 h-3" />
                    {fileName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {projectName ? `案件「${projectName}」で` : ''}
                他の担当者が先に同じ箇所を更新していました。どちらの値を残すか選択してください。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
            title="閉じて保存を保留"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auto-merged note + batch pickers */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              {autoMergedInfoText || '別機器・別項目の変更は自動で統合済みです（以下の競合箇所のみ選択してください）。'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSetAll('disk')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 rounded cursor-pointer transition-colors"
            >
              すべて相手(最新)を採用
            </button>
            <button
              type="button"
              onClick={() => handleSetAll('local')}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-300 rounded cursor-pointer transition-colors"
            >
              すべて自分を採用
            </button>
          </div>
        </div>

        {/* Conflicts list */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {conflictType === 'equipment' &&
            equipmentConflicts.map((c) => {
              const selected = resolutions[c.conflictId] || 'disk';
              return (
                <div
                  key={c.conflictId}
                  className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded text-[11px]">
                        {c.itemTagNo}
                      </span>
                      <span className="font-bold text-slate-900">{c.itemName}</span>
                      <span className="text-slate-300">/</span>
                      <span className="font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                        {c.fieldLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      基準値: {c.baseDisplay}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* Disk option */}
                    <button
                      type="button"
                      onClick={() =>
                        setResolutions((prev) => ({ ...prev, [c.conflictId]: 'disk' }))
                      }
                      className={`text-left p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        selected === 'disk'
                          ? 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-300'
                          : 'border-slate-200 bg-slate-50/60 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-sky-600" />
                          <span>最新ファイル（他ユーザーの更新）</span>
                        </span>
                        {selected === 'disk' && (
                          <span className="text-[10px] font-bold bg-sky-600 text-white px-1.5 py-0.5 rounded">
                            採用
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-900 break-words bg-white/80 border border-slate-200/80 rounded p-2">
                        {c.diskDisplay}
                      </div>
                    </button>

                    {/* Local option */}
                    <button
                      type="button"
                      onClick={() =>
                        setResolutions((prev) => ({ ...prev, [c.conflictId]: 'local' }))
                      }
                      className={`text-left p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        selected === 'local'
                          ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-300'
                          : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          <span>あなたの編集内容</span>
                        </span>
                        {selected === 'local' && (
                          <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                            採用
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-slate-900 break-words bg-white/80 border border-slate-200/80 rounded p-2">
                        {c.localDisplay}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}

          {conflictType === 'ledger' &&
            ledgerConflicts.map((c) => {
              const selected = resolutions[c.conflictId] || 'disk';
              return (
                <div
                  key={c.conflictId}
                  className="border border-slate-200 rounded-xl p-3.5 bg-white shadow-2xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded text-[11px]">
                        {c.recordTitle}
                      </span>
                      <span className="font-mono text-indigo-700 font-semibold">
                        {c.docNo}
                      </span>
                      <span className="font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                        Rev.{c.revision}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setResolutions((prev) => ({ ...prev, [c.conflictId]: 'disk' }))
                      }
                      className={`text-left p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        selected === 'disk'
                          ? 'border-sky-600 bg-sky-50/70 ring-1 ring-sky-300'
                          : 'border-slate-200 bg-slate-50/60 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-sky-600" />
                          <span>台帳JSON上の最新データ</span>
                        </span>
                        {selected === 'disk' && (
                          <span className="text-[10px] font-bold bg-sky-600 text-white px-1.5 py-0.5 rounded">
                            採用
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-900 break-words bg-white/80 border border-slate-200/80 rounded p-2">
                        {c.diskSummaryText}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setResolutions((prev) => ({ ...prev, [c.conflictId]: 'local' }))
                      }
                      className={`text-left p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        selected === 'local'
                          ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-300'
                          : 'border-slate-200 bg-slate-50/60 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          <span>今回確定した内容</span>
                        </span>
                        {selected === 'local' && (
                          <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                            採用
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-900 break-words bg-white/80 border border-slate-200/80 rounded p-2">
                        {c.localSummaryText}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              選択されなかった方の編集も、過去の変更履歴としては保持または破棄前に確認された上で最新のJSONファイルへ安全に保存されます。
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 bg-white border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            キャンセル（保存せず画面に留まる）
          </button>

          <button
            type="button"
            onClick={() => onResolve(resolutions)}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'マージ保存中...' : '選択内容でマージして保存'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
