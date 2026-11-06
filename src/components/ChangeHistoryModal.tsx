import React, { useState, useMemo } from 'react';
import { 
  X, 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Tag, 
  ArrowRight,
  Clock,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { EquipmentItem, Category, ChangeLog } from '../types';

interface ChangeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: EquipmentItem[];
  categories: Category[];
}

interface FlattenedChangeLog extends ChangeLog {
  itemTagNo: string;
  itemName: string;
  categoryName: string;
}

export const ChangeHistoryModal: React.FC<ChangeHistoryModalProps> = ({
  isOpen,
  onClose,
  items,
  categories
}) => {
  if (!isOpen) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>('all');

  // Collect all history items from all items
  const allLogs: FlattenedChangeLog[] = useMemo(() => {
    const list: FlattenedChangeLog[] = [];
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    items.forEach(it => {
      const cName = catMap.get(it.categoryId) || '未分類';
      (it.history || []).forEach(h => {
        list.push({
          ...h,
          itemTagNo: it.tagNo || '-',
          itemName: it.name,
          categoryName: cName
        });
      });
    });

    // Sort newest first
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [items, categories]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      if (selectedItemId !== 'all' && log.itemId !== selectedItemId) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          log.itemName.toLowerCase().includes(q) ||
          log.itemTagNo.toLowerCase().includes(q) ||
          log.fieldLabel.toLowerCase().includes(q) ||
          (log.reason && log.reason.toLowerCase().includes(q)) ||
          log.author.toLowerCase().includes(q) ||
          log.oldValue.toLowerCase().includes(q) ||
          log.newValue.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allLogs, selectedItemId, searchTerm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
              <History className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm">機器データベース 変更履歴ログ</h2>
                <span className="text-[10px] bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                  {filteredLogs.length} 件
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                機器の仕様・数量・納入時期・カテゴリ等の過去の変更記録一覧
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="変更項目、機器名、タグ番号、メモで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-[11px] text-slate-500 shrink-0">対象機器:</span>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden max-w-[200px]"
            >
              <option value="all">すべての機器 ({allLogs.length}件)</option>
              {items.map(it => (
                <option key={it.id} value={it.id}>
                  [{it.tagNo || '-'}] {it.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Change Log Table */}
        <div className="overflow-y-auto flex-1 p-4">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <History className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
              <p>変更履歴が見つかりませんでした。</p>
              <p className="text-[11px] text-slate-400 mt-1">機器の情報を更新すると、自動的に差分ログがここに記録されます。</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">更新日時</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">対象機器</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">変更項目</th>
                    <th className="py-2.5 px-3">変更内容 (差分)</th>
                    <th className="py-2.5 px-3">メモ・理由</th>
                    <th className="py-2.5 px-3 whitespace-nowrap text-right">操作者</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                        {log.timestamp}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {log.itemName}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          [{log.itemTagNo}] · {log.categoryName}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-block bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded text-[11px] font-medium">
                          {log.fieldLabel || log.field}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {log.oldValue && log.oldValue !== '-' ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400 line-through max-w-[180px] truncate" title={log.oldValue}>
                              {log.oldValue}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-semibold text-indigo-700 max-w-[220px] truncate" title={log.newValue}>
                              {log.newValue}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-800 font-semibold">{log.newValue}</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {log.reason ? (
                          <span className="text-slate-800">{log.reason}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium text-slate-600 whitespace-nowrap text-[11px]">
                        {log.author || '担当者'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 text-[11px]">
            ※ 機器の更新時に自動的に差分が記録されます（必須入力の強制はありません）
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors font-medium text-xs shadow-2xs"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
