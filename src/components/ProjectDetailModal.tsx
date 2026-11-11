import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, 
  Hash, 
  FileText, 
  Building2, 
  MapPin, 
  Users, 
  Check, 
  X, 
  HardDrive, 
  Save, 
  Calendar,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { ProjectWorkspace } from '../types';

interface ProjectDetailModalProps {
  isOpen: boolean;
  project: ProjectWorkspace | null;
  onClose: () => void;
  onSave: (updated: ProjectWorkspace) => void;
  onRelinkJson?: (projectId: string) => void;
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

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  isOpen,
  project,
  onClose,
  onSave,
  onRelinkJson,
  onDeleteProject
}) => {
  if (!isOpen || !project) return null;

  // Form states
  const [orderNo, setOrderNo] = useState(project.orderNo || '');
  const [name, setName] = useState(project.name || '');
  const [clientName, setClientName] = useState(project.clientName || '');
  
  const initialCode = parseCodeParts(project.code, project.codePart1, project.codePart2);
  const [codePart1, setCodePart1] = useState(initialCode.c1);
  const [codePart2, setCodePart2] = useState(initialCode.c2);

  const initialClientNum = parseClientNumberParts(project.clientNumber, project.clientNumberPart1, project.clientNumberPart2);
  const [clientNumberPart1, setClientNumberPart1] = useState(initialClientNum.p1);
  const [clientNumberPart2, setClientNumberPart2] = useState(initialClientNum.p2);

  const [location, setLocation] = useState(project.location || '');
  const [department, setDepartment] = useState(project.department || '');
  const [description, setDescription] = useState(project.description || '');
  const [validationError, setValidationError] = useState('');
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  // 2-cushion deletion state (0: normal, 1: first cushion confirmation, 2: second cushion final confirmation)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (project) {
      setOrderNo(project.orderNo || '');
      setName(project.name || '');
      setClientName(project.clientName || '');
      
      const c = parseCodeParts(project.code, project.codePart1, project.codePart2);
      setCodePart1(c.c1);
      setCodePart2(c.c2);

      const cn = parseClientNumberParts(project.clientNumber, project.clientNumberPart1, project.clientNumberPart2);
      setClientNumberPart1(cn.p1);
      setClientNumberPart2(cn.p2);

      setLocation(project.location || '');
      setDepartment(project.department || '');
      setDescription(project.description || '');
      setValidationError('');
      setIsSavedSuccess(false);
      setDeleteStep(0);
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('案件名を入力してください。');
      return;
    }

    const c1 = codePart1.trim();
    const c2 = codePart2.trim();
    if (!c1) {
      setValidationError('案件コードの前半を入力してください。');
      return;
    }
    const combinedCode = c2 ? `${c1}-${c2}` : c1;

    const p1 = clientNumberPart1.trim();
    const p2 = clientNumberPart2.trim();
    const combinedClientNumber = (p1 || p2) ? `【${p1}】-【${p2}】` : '';

    const updated: ProjectWorkspace = {
      ...project,
      orderNo: orderNo.trim(),
      name: trimmedName,
      code: combinedCode,
      codePart1: c1,
      codePart2: c2,
      clientName: clientName.trim() || '未設定',
      clientNumber: combinedClientNumber,
      clientNumberPart1: p1,
      clientNumberPart2: p2,
      location: location.trim(),
      department: department.trim(),
      description: description.trim()
    };

    onSave(updated);
    setIsSavedSuccess(true);
    setTimeout(() => {
      setIsSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center">
              <FolderKanban className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h2 className="font-bold text-sm">案件基本情報の登録・編集</h2>
              <p className="text-[11px] text-slate-400">
                オーダーNo・案件コード・案件名・客先名などのマスター共通設定
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {isSavedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">案件情報を正常に更新・保存しました。</span>
            </div>
          )}

          {/* Section: コア識別情報 (オーダーNo, 案件コード, 案件名, 客先名) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-600" />
                <span>案件の主要識別情報</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">全仕様書・帳票に一律反映</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* 1. オーダーNo. */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  オーダーNo. <span className="text-slate-400 font-normal">(例: 202500444)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    placeholder="202500444"
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 2. 案件コード (ハイフン固定・左右2分割入力) */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>案件コード <span className="text-indigo-600">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal font-mono">[前半] - [後半] (例: 20345-001)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={codePart1}
                    onChange={(e) => setCodePart1(e.target.value)}
                    placeholder="20345"
                    className="flex-1 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-indigo-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <span className="text-slate-500 font-bold text-sm select-none px-0.5">-</span>
                  <input
                    type="text"
                    value={codePart2}
                    onChange={(e) => setCodePart2(e.target.value)}
                    placeholder="001"
                    className="w-24 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-indigo-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 3. 案件名 */}
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  案件名 / 工事名称 <span className="text-indigo-600">*</span> <span className="text-slate-400 font-normal">(例: 〇〇市水道工事)</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 令和8年度 〇〇市水道工事 配水管敷設替"
                  className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* 4. 客先名 */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  客先名 / 発注者 <span className="text-slate-400 font-normal">(例: 〇〇市水道局)</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="例: 〇〇市水道局"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* 5. 客先番号 【】-【】 */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>客先番号</span>
                  <span className="text-[10px] text-slate-400 font-mono">【】-【】形式</span>
                </label>
                <div className="flex items-center gap-1">
                  <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <span className="text-slate-500 font-bold select-none text-xs font-sans mr-0.5">【</span>
                    <input
                      type="text"
                      value={clientNumberPart1}
                      onChange={(e) => setClientNumberPart1(e.target.value)}
                      placeholder="記号"
                      className="w-full text-xs font-mono font-bold text-center bg-transparent border-0 p-0 text-slate-900 focus:outline-hidden"
                    />
                    <span className="text-slate-500 font-bold select-none text-xs font-sans ml-0.5">】</span>
                  </div>
                  <span className="text-slate-400 font-bold select-none text-sm">-</span>
                  <div className="flex-1 flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                    <span className="text-slate-500 font-bold select-none text-xs font-sans mr-0.5">【</span>
                    <input
                      type="text"
                      value={clientNumberPart2}
                      onChange={(e) => setClientNumberPart2(e.target.value)}
                      placeholder="番号"
                      className="w-full text-xs font-mono font-bold text-center bg-transparent border-0 p-0 text-slate-900 focus:outline-hidden"
                    />
                    <span className="text-slate-500 font-bold select-none text-xs font-sans ml-0.5">】</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Section: 付帯情報 (工事場所, 担当部署, 概要) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                工事場所 / 納入設置場所
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 〇〇市中央通り 1工区"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                担当部署 / 仕様書発行元
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="例: 水道工務部 配水課"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                案件概要・特記事項
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: バルブ・ポンプ・配管機器の調達仕様書作成および現地据付工事"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden leading-relaxed font-sans"
              />
            </div>
          </div>

          {/* Section: 紐づけJSONデータベースの状態 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px]">
            <div className="flex items-center gap-2">
              <HardDrive className={`w-4 h-4 shrink-0 ${project.isLinkError ? 'text-red-500' : 'text-indigo-600'}`} />
              <div>
                <span className="font-semibold text-slate-700">紐づけJSON正本ファイル: </span>
                <span className="font-mono text-slate-900 font-bold">{project.linkedJsonFileName || '未紐づけ（ブラウザ内保存）'}</span>
              </div>
            </div>
            {onRelinkJson && (
              <button
                type="button"
                onClick={() => onRelinkJson(project.id)}
                className="px-2.5 py-1 text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md font-medium text-[11px] transition-colors cursor-pointer self-start sm:self-auto"
              >
                ファイル再紐づけ
              </button>
            )}
          </div>

          {/* Modal Footer Actions & 2-Cushion Deletion */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            {deleteStep === 0 ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Small delete button at the bottom left */}
                {onDeleteProject ? (
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    className="inline-flex items-center justify-center gap-1.5 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200/80 transition-colors cursor-pointer self-start"
                    title="この案件登録を画面から削除（※PC上のJSONファイルは消去されず安全に保持されます）"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>この案件登録を削除</span>
                  </button>
                ) : <div />}

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStep(0);
                      onClose();
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>保存して仕様書に反映</span>
                  </button>
                </div>
              </div>
            ) : deleteStep === 1 ? (
              /* Cushion 1: First check */
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5 text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <p className="font-bold text-amber-900">【確認 1/2】この案件を画面の登録一覧から削除しますか？</p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      ※ 画面上の一覧・作業リストからのみ消去されます。<strong className="font-bold underline text-amber-950">PC上に保存されているJSONファイルは絶対に消去されず安全にそのまま保持されます。</strong>（後からいつでもJSONファイルを開いて再読み込みできます）
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/60">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                  >
                    取り消す
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-md shadow-2xs transition-colors cursor-pointer"
                  >
                    次へ進む (最終確認へ)
                  </button>
                </div>
              </div>
            ) : (
              /* Cushion 2: Second and final check */
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5 text-red-950">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <p className="font-bold text-red-800">【最終確認 2/2】本当にこの案件登録を画面から削除しますか？</p>
                    <p className="text-red-700 text-[11px] mt-0.5">
                      ※ 削除されるのはあくまで画面・ブラウザ上の登録情報のみです。<strong className="font-bold underline text-red-900">PCのディスク上にあるJSONファイル実体は一切削除されません。</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-200/60">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                  >
                    やめる
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteProject) {
                        onDeleteProject(project.id);
                      }
                      setDeleteStep(0);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>画面の登録を削除する</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};
