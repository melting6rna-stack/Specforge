import React from 'react';
import { X, Download, Monitor, ShieldCheck, CheckCircle2, ArrowRight, Laptop } from 'lucide-react';

interface PwaInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerInstall?: () => void;
  canDirectInstall?: boolean;
}

export const PwaInstallGuideModal: React.FC<PwaInstallGuideModalProps> = ({
  isOpen,
  onClose,
  onTriggerInstall,
  canDirectInstall
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-6 flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">デスクトップアプリとしてPCにインストール</h2>
              <p className="text-[11px] text-slate-400">
                オフラインでも直接起動できる軽量デスクトップアプリとして登録します
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          
          {canDirectInstall && onTriggerInstall ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center space-y-3">
              <p className="font-bold text-slate-900 text-sm">
                ワンクリックでデスクトップに保存できます
              </p>
              <button
                onClick={() => {
                  onTriggerInstall();
                  onClose();
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-xs flex items-center justify-center gap-2 text-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>今すぐPCにインストールする</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <span className="font-bold text-slate-900 block text-xs">
                  ブラウザのアドレスバーからインストールする手順
                </span>
                
                {/* Steps */}
                <div className="space-y-2 text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <span>ブラウザ（ChromeまたはEdge）の</span>
                      <strong className="text-slate-900"> アドレスバー（URLが表示されている枠の右端） </strong>
                      <span>を見ます。</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <span>表示されている </span>
                      <strong className="text-slate-900">「アプリをインストール（パソコンと下矢印のマーク）」</strong>
                      <span>をクリックします。</span>
                      <div className="text-[11px] text-slate-500 mt-0.5 bg-white p-1.5 rounded border border-slate-200">
                        ※ 出ていない場合は、ブラウザ右上のメニュー「︙」または「…」→「アプリ」→「SpecForge をインストール」でも可能です。
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <span>確認画面で</span>
                      <strong className="text-indigo-600">「インストール」</strong>
                      <span>を押すと、PCのデスクトップに専用アイコンが作成されます。</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Benefits badge */}
              <div className="space-y-1.5 text-slate-600 bg-emerald-50/60 border border-emerald-200/80 p-3 rounded-lg text-[11px]">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>デスクトップアプリ化のメリット</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                  <li>インターネット未接続の完全オフラインでもデスクトップから即座に起動</li>
                  <li>ブラウザの余計なタブやアドレスバーが消え、専用ソフトとして画面を広く使える</li>
                  <li>社内共有フォルダのJSON同期やPDF読み取りもそのまま動作</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 transition-colors"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
