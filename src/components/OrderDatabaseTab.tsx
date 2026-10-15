import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Plus, 
  Edit3, 
  History, 
  Trash2, 
  Upload, 
  GripVertical,
  FolderPlus,
  Folder,
  Tag,
  CheckCircle2,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { EquipmentItem, Category, ProjectWorkspace } from '../types';

interface OrderDatabaseTabProps {
  items: EquipmentItem[];
  categories: Category[];
  activeProjectId: string;
  onEditItem: (item: EquipmentItem) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenAuditTrail: (itemId?: string) => void;
  onAddNewItem: () => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveItemToCategory: (itemId: string, targetCategoryId: string) => void;
  onUploadExcel: (file: File) => void;
  onOpenPdfImport: () => void;
}

export const OrderDatabaseTab: React.FC<OrderDatabaseTabProps> = ({
  items,
  categories,
  activeProjectId,
  onEditItem,
  onDeleteItem,
  onOpenAuditTrail,
  onAddNewItem,
  onAddCategory,
  onDeleteCategory,
  onMoveItemToCategory,
  onUploadExcel,
  onOpenPdfImport,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);

  // Filter items for current project
  const projectItems = items.filter(it => it.projectId === activeProjectId);

  // Filter items by category & search
  const filteredItems = projectItems.filter(item => {
    if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        item.name.toLowerCase().includes(q) ||
        (item.tagNo && item.tagNo.toLowerCase().includes(q)) ||
        (item.diameter && item.diameter.toLowerCase().includes(q)) ||
        (item.material && item.material.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Category counts
  const categoryCountMap = projectItems.reduce((acc, it) => {
    acc[it.categoryId] = (acc[it.categoryId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragOverCategory = (e: React.DragEvent, catId: string) => {
    e.preventDefault();
    if (dragOverCatId !== catId) {
      setDragOverCatId(catId);
    }
  };

  const handleDragLeaveCategory = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCatId(null);
  };

  const handleDropOnCategory = (e: React.DragEvent, targetCatId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
    if (itemId && targetCatId) {
      onMoveItemToCategory(itemId, targetCatId);
    }
    setDraggedItemId(null);
    setDragOverCatId(null);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatName.trim()) {
      onAddCategory(newCatName.trim());
      setNewCatName('');
      setIsAddingCategory(false);
    }
  };

  const handleExcelFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadExcel(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Top Action Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>機器データベース管理</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            機器名・数量・口径・材質・納期を一元管理。ドラッグ＆ドロップで自在にカテゴリ分類できます。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Audit trail quick button */}
          <button
            onClick={() => onOpenAuditTrail()}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="過去の変更理由と履歴を一覧"
          >
            <History className="w-3.5 h-3.5 text-amber-600" />
            <span>変更履歴</span>
          </button>

          {/* PDF Import button (No AI) */}
          <button
            onClick={onOpenPdfImport}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="仕様書PDFからNo-AIで機器仕様を自動読み取り"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>PDF読込 (No AI)</span>
          </button>

          {/* Quick Excel import button */}
          <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel読込</span>
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              onChange={handleExcelFileInput} 
              className="hidden" 
            />
          </label>

          {/* Add item */}
          <button
            onClick={onAddNewItem}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>機器を追加</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Categories (Droppable) & Right Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: カテゴリ一覧＆ドロップ先 (4 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-slate-600" />
              <span>カテゴリ分類</span>
            </span>
            <button
              onClick={() => setIsAddingCategory(true)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
              title="新しいカテゴリを作成"
            >
              <Plus className="w-3 h-3" />
              <span>追加</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            ※ 表の行をつかんでカテゴリにドロップすると移動できます。
          </p>

          {/* New Category Input Form */}
          {isAddingCategory && (
            <form onSubmit={handleAddCategorySubmit} className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <input
                type="text"
                autoFocus
                placeholder="カテゴリ名 (例: 弁類, ポンプ)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(false)}
                  className="px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200 rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-0.5 text-[11px] bg-slate-900 text-white rounded font-medium"
                >
                  作成
                </button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`w-full text-left p-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                selectedCategoryId === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>すべての機器</span>
              <span className={`text-[11px] font-mono tabular-nums ${selectedCategoryId === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
                {projectItems.length}
              </span>
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const isDragOver = dragOverCatId === cat.id;
              const count = categoryCountMap[cat.id] || 0;

              return (
                <div
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  onDragOver={(e) => handleDragOverCategory(e, cat.id)}
                  onDragLeave={handleDragLeaveCategory}
                  onDrop={(e) => handleDropOnCategory(e, cat.id)}
                  className={`w-full text-left p-2 rounded-lg text-xs font-medium flex items-center justify-between transition-all cursor-pointer relative group ${
                    isDragOver 
                      ? 'bg-indigo-50 border-2 border-dashed border-indigo-500 scale-[1.02]' 
                      : isSelected
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Tag className={`w-3 h-3 shrink-0 ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`} />
                    <span className="truncate">{cat.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[11px] font-mono tabular-nums ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {count}
                    </span>
                    {categories.length > 1 && !isSelected && count === 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCategory(cat.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5"
                        title="カテゴリ削除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: 機器一覧テーブル (9 cols) */}
        <div className="lg:col-span-9 space-y-3">
          
          {/* Search bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="機器名、口径、材質、機器番号で絞り込み..."
                className="w-full bg-transparent border-none focus:outline-hidden text-xs text-slate-800"
              />
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              表示: {filteredItems.length} 件
            </div>
          </div>

          {/* Clean High-Legibility Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-8"></th>
                    <th className="py-2.5 px-3">機器番号</th>
                    <th className="py-2.5 px-3">機器名</th>
                    <th className="py-2.5 px-3">口径 (サイズ)</th>
                    <th className="py-2.5 px-3">材質</th>
                    <th className="py-2.5 px-3 text-right">数量</th>
                    <th className="py-2.5 px-3">希望納期</th>
                    <th className="py-2.5 px-3 text-center">変更履歴</th>
                    <th className="py-2.5 px-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        該当する機器データがありません。「機器を追加」または「PDF読込」「Excel読込」から登録してください。
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      return (
                        <tr
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          onClick={() => onEditItem(item)}
                          className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        >
                          <td className="py-3 px-2 text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing text-center" title="ドラッグしてカテゴリへ移動">
                            <GripVertical className="w-4 h-4 mx-auto" />
                          </td>

                          <td className="py-3 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {item.tagNo || '-'}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {item.name}
                            </div>
                            {item.notes && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                                {item.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                            {item.diameter || '-'}
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {item.material || '-'}
                          </td>

                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="font-bold text-slate-900">{item.quantity}</span>
                            <span className="text-slate-500 ml-1">{item.unit || '台'}</span>
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {item.deliveryDate || '-'}
                          </td>

                          <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => onOpenAuditTrail(item.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-amber-800 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded px-2 py-0.5 transition-colors"
                              title="変更理由を確認"
                            >
                              <History className="w-3 h-3 text-amber-500" />
                              <span className="font-mono tabular-nums">{(item.history || []).length}件</span>
                            </button>
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onEditItem(item)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                title="編集・変更理由記入"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer info */}
            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>合計: <strong className="text-slate-900 font-mono tabular-nums">{filteredItems.length}</strong> 機器</span>
              <span className="text-[11px] text-slate-400">行をクリックして変更理由を入力・編集できます</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
