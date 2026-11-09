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
  AlertTriangle
} from 'lucide-react';
import { ProjectWorkspace } from '../types';

interface ProjectDetailModalProps {
  isOpen: boolean;
  project: ProjectWorkspace | null;
  onClose: () => void;
  onSave: (updated: ProjectWorkspace) => void;
  onRelinkJson?: (projectId: string) => void;
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
  onRelinkJson
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

          {/* Modal Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
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

        </form>

      </div>
    </div>
  );
};
