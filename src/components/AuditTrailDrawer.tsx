import React, { useState } from 'react';
import { X, History, User, Calendar, ArrowRight, Download } from 'lucide-react';
import { EquipmentItem, ChangeLog } from '../types';

interface AuditTrailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: EquipmentItem[];
  selectedItemFilter?: string;
}

export const AuditTrailDrawer: React.FC<AuditTrailDrawerProps> = ({
  isOpen,
  onClose,
  items,
  selectedItemFilter
}) => {
  if (!isOpen) return null;

  const [activeItemFilter, setActiveItemFilter] = useState<string>(selectedItemFilter || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  // Collect all history logs
  const allLogs: (ChangeLog & { tagNo: string; name: string })[] = [];

  for (const item of items) {
    if (item.history) {
      for (const h of item.history) {
        allLogs.push({
          ...h,
          tagNo: item.tagNo || '-',
          name: item.name
        });
      }
    }
  }

  // Sort descending by timestamp
  allLogs.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

  const filteredLogs = allLogs.filter(log => {
    if (activeItemFilter !== 'all' && log.itemId !== activeItemFilter) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = 
        log.reason.toLowerCase().includes(q) ||
        log.author.toLowerCase().includes(q) ||
        log.fieldLabel.toLowerCase().includes(q) ||
        log.name.toLowerCase().includes(q) ||
        log.tagNo.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = ['記録日時', '機器番号', '機器名', '変更項目', '変更前内容', '変更後内容', '変更理由', '担当者'];
    const rows = filteredLogs.map(l => [
      `"${l.timestamp}"`,
      `"${l.tagNo}"`,
      `"${l.name}"`,
      `"${l.fieldLabel}"`,
      `"${l.oldValue}"`,
      `"${l.newValue}"`,
      `"${l.reason}"`,
      `"${l.author}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `変更履歴_監査ログ_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-2xs">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-slate-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm">変更履歴・変更理由トレーサビリティ</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
          <input
            type="text"
            placeholder="理由・機器名・担当者で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs flex-1"
          />

          <select
            value={activeItemFilter}
            onChange={(e) => setActiveItemFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs max-w-[150px] truncate"
          >
            <option value="all">全機器 ({allLogs.length}件)</option>
            {items.map(it => (
              <option key={it.id} value={it.id}>[{it.tagNo || '-'}] {it.name}</option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1 shrink-0"
          >
            <Download className="w-3 h-3 text-slate-500" />
            <span>CSV出力</span>
          </button>
        </div>

        {/* History Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              変更履歴はまだありません。
            </div>
          ) : (
            filteredLogs.map(log => (
              <div
                key={log.id}
                className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <div className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{log.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium text-slate-700">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{log.author}</span>
                  </div>
                </div>

                <div className="font-semibold text-slate-900">
                  <span className="font-mono text-slate-500 mr-1.5">[{log.tagNo}]</span>
                  <span>{log.name}</span>
                </div>

                <div className="bg-slate-50 p-2 rounded text-[11px] space-y-0.5">
                  <span className="text-slate-500">変更項目: <strong className="text-slate-800">{log.fieldLabel}</strong></span>
                  <div className="flex items-center gap-1.5 font-mono text-slate-600">
                    <span className="line-through text-red-600 bg-red-50/50 px-1 rounded">{log.oldValue}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-emerald-700 bg-emerald-50/50 px-1 rounded font-semibold">{log.newValue}</span>
                  </div>
                </div>

                <div className="text-[11px]">
                  <span className="text-slate-500">変更理由: </span>
                  <span className="text-slate-900 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-block">
                    {log.reason}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>表示: {filteredLogs.length} 件</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
