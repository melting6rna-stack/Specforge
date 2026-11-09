import React, { useState } from 'react';
import { 
  Database, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Upload, 
  GripVertical,
  FolderPlus,
  Folder,
  Tag,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  History,
  ArrowRight,
  Calendar,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Layers,
  ChevronDown,
  Check,
  Save,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { EquipmentItem, Category, ProjectWorkspace } from '../types';

interface OrderDatabaseTabProps {
  items: EquipmentItem[];
  categories: Category[];
  activeProjectId: string;
  onEditItem: (item: EquipmentItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddNewItem: () => void;
  onOpenChangeLog: () => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onMoveItemToCategory: (itemId: string, targetCategoryId: string) => void;
  onBatchUpdateDeliveryDate: (itemIds: string[], newDeliveryDate: string) => void;
  onBatchMoveToCategory: (itemIds: string[], targetCategoryId: string) => void;
  onReorderItems?: (reorderedItems: EquipmentItem[]) => void;
  hasUnsavedChanges?: boolean;
  onManualSaveJson?: () => void;
  isSavingJson?: boolean;
  onUploadExcel: (file: File) => void;
}

export const OrderDatabaseTab: React.FC<OrderDatabaseTabProps> = ({
  items,
  categories,
  activeProjectId,
  onEditItem,
  onDeleteItem,
  onAddNewItem,
  onOpenChangeLog,
  onAddCategory,
  onDeleteCategory,
  onMoveItemToCategory,
  onBatchUpdateDeliveryDate,
  onBatchMoveToCategory,
  onReorderItems,
  hasUnsavedChanges,
  onManualSaveJson,
  isSavingJson,
  onUploadExcel,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isAddingCategory, setIsAddingCategory] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);

  // Batch Selection & Editing State
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [isBatchDeliveryModalOpen, setIsBatchDeliveryModalOpen] = useState<boolean>(false);
  const [batchDeliveryValue, setBatchDeliveryValue] = useState<string>('');
  const [isBatchCategoryMenuOpen, setIsBatchCategoryMenuOpen] = useState<boolean>(false);

  // Sorting state: 'manual' (D&D order), 'tagNo', 'deliveryDate'
  const [sortField, setSortField] = useState<'manual' | 'tagNo' | 'deliveryDate'>('manual');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Row Drag-and-Drop Reordering state
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after');

  // Filter items for current project
  const projectItems = items.filter(it => it.projectId === activeProjectId);

  // Filter items by category & search
  const filteredItems = projectItems.filter(item => {
    if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) {
      return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      // Match against tagNo, name, notes, deliveryDate, and specs
      const specText = (item.specs || []).map(s => `${s.name} ${s.value} ${s.unit}`).join(' ').toLowerCase();
      const match =
        item.name.toLowerCase().includes(q) ||
        (item.tagNo && item.tagNo.toLowerCase().includes(q)) ||
        (item.diameter && item.diameter.toLowerCase().includes(q)) ||
        (item.material && item.material.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q)) ||
        (item.deliveryDate && item.deliveryDate.toLowerCase().includes(q)) ||
        specText.includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Apply sorting (manual retains user-defined D&D order)
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortField === 'manual') return 0;
    if (sortField === 'tagNo') {
      const res = (a.tagNo || '').localeCompare(b.tagNo || '', undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? res : -res;
    }
    if (sortField === 'deliveryDate') {
      const valA = a.deliveryDate || '';
      const valB = b.deliveryDate || '';
      const isDateA = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(valA);
      const isDateB = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(valB);
      let res = 0;
      if (isDateA && isDateB) {
        res = valA.localeCompare(valB);
      } else if (isDateA && !isDateB) {
        res = -1;
      } else if (!isDateA && isDateB) {
        res = 1;
      } else if (valA && !valB) {
        res = -1;
      } else if (!valA && valB) {
        res = 1;
      } else {
        res = valA.localeCompare(valB);
      }
      return sortDirection === 'asc' ? res : -res;
    }
    return 0;
  });

  const handleToggleSort = (field: 'tagNo' | 'deliveryDate') => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField('manual');
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Category counts
  const categoryCountMap = projectItems.reduce((acc, it) => {
    acc[it.categoryId] = (acc[it.categoryId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Checkbox selection helpers
  const filteredItemIds = sortedItems.map(it => it.id);
  const isAllSelected = sortedItems.length > 0 && sortedItems.every(it => selectedItemIds.includes(it.id));
  const isSomeSelected = sortedItems.some(it => selectedItemIds.includes(it.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedItemIds(prev => prev.filter(id => !filteredItemIds.includes(id)));
    } else {
      setSelectedItemIds(prev => Array.from(new Set([...prev, ...filteredItemIds])));
    }
  };

  const handleToggleSelectItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Open batch delivery editor
  const handleOpenDeliveryEditor = (targetItemId?: string) => {
    if (targetItemId && !selectedItemIds.includes(targetItemId)) {
      setSelectedItemIds([targetItemId]);
      const targetItem = items.find(it => it.id === targetItemId);
      setBatchDeliveryValue(targetItem?.deliveryDate || '');
    } else if (selectedItemIds.length > 0) {
      const firstSelected = items.find(it => selectedItemIds.includes(it.id));
      setBatchDeliveryValue(firstSelected?.deliveryDate || '');
    }
    setIsBatchDeliveryModalOpen(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    if (selectedItemIds.includes(itemId) && selectedItemIds.length > 1) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'batch', itemIds: selectedItemIds }));
    } else {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'single', itemId }));
    }
  };

  // Category drop handlers
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
    const rawData = e.dataTransfer.getData('text/plain');
    try {
      const parsed = JSON.parse(rawData);
      if (parsed.type === 'batch' && Array.isArray(parsed.itemIds)) {
        onBatchMoveToCategory(parsed.itemIds, targetCatId);
        setSelectedItemIds([]);
      } else if (parsed.itemId) {
        onMoveItemToCategory(parsed.itemId, targetCatId);
      } else {
        onMoveItemToCategory(draggedItemId || '', targetCatId);
      }
    } catch {
      const fallbackId = rawData || draggedItemId;
      if (fallbackId) {
        onMoveItemToCategory(fallbackId, targetCatId);
      }
    }
    setDraggedItemId(null);
    setDragOverCatId(null);
  };

  // Table row reordering handlers
  const handleRowDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedItemId === targetId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const isBefore = relY < rect.height / 2;
    if (dragOverRowId !== targetId || dropPosition !== (isBefore ? 'before' : 'after')) {
      setDragOverRowId(targetId);
      setDropPosition(isBefore ? 'before' : 'after');
    }
  };

  const handleRowDragLeave = () => {
    setDragOverRowId(null);
  };

  const handleRowDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData('text/plain');
    setDragOverRowId(null);

    let idsToMove: string[] = [];
    try {
      const parsed = JSON.parse(rawData);
      if (parsed.type === 'batch' && Array.isArray(parsed.itemIds)) {
        idsToMove = parsed.itemIds;
      } else if (parsed.itemId) {
        idsToMove = [parsed.itemId];
      }
    } catch {
      if (draggedItemId) idsToMove = [draggedItemId];
    }

    if (idsToMove.length === 0 || idsToMove.includes(targetId)) {
      setDraggedItemId(null);
      return;
    }

    // Switch to manual order so the reordered positions are visible
    setSortField('manual');

    // Move dragged items around the targetId in projectItems
    const movingItems = projectItems.filter(it => idsToMove.includes(it.id));
    const remainingItems = projectItems.filter(it => !idsToMove.includes(it.id));

    const targetIndex = remainingItems.findIndex(it => it.id === targetId);
    if (targetIndex === -1) {
      setDraggedItemId(null);
      return;
    }

    const insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
    const reorderedList = [
      ...remainingItems.slice(0, insertIndex),
      ...movingItems,
      ...remainingItems.slice(insertIndex)
    ];

    if (onReorderItems) {
      onReorderItems(reorderedList);
    }
    setDraggedItemId(null);
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
            機器名・数量・仕様項目・特記事項・納入時期を一元管理。ドラッグ＆ドロップで行の並び替えやカテゴリ分類が可能です。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual JSON Save Button (Only shown when changes are unsaved) */}
          {hasUnsavedChanges && (
            <button
              onClick={onManualSaveJson}
              disabled={isSavingJson}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="編集した内容を紐づけ先JSONファイルに今すぐ保存します"
            >
              <Save className={`w-3.5 h-3.5 ${isSavingJson ? 'animate-spin' : ''}`} />
              <span>未保存の変更あり（JSONに保存）</span>
            </button>
          )}

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
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>機器を追加</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Categories (Droppable) & Right Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: 変更履歴 ＆ カテゴリ一覧 (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          
          {/* 変更履歴ボタン (カテゴリカラムの上) */}
          <button
            type="button"
            onClick={onOpenChangeLog}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3 shadow-2xs flex items-center justify-between text-xs transition-all group text-left cursor-pointer"
            title="過去の機器・仕様変更の履歴ログを確認"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 group-hover:bg-amber-100 transition-colors shrink-0">
                <History className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block leading-tight">変更履歴ログ</span>
                <span className="text-[10px] text-slate-400 font-normal">機器・仕様の更新記録</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5 shrink-0" />
          </button>

          {/* カテゴリ一覧＆ドロップ先 */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
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
      </div>

        {/* Right Column: 機器一覧テーブル (9 cols) */}
        <div className="lg:col-span-9 space-y-3">
          
          {/* Controls: Search bar & Sort Switchers */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="機器名、仕様（口径・出力等）、材質、機器番号で絞り込み..."
                className="w-full bg-transparent border-none focus:outline-hidden text-xs text-slate-800"
              />
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
              <span className="text-[11px] text-slate-400 mr-1">並び順:</span>
              
              <button
                type="button"
                onClick={() => setSortField('manual')}
                className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  sortField === 'manual'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="ドラッグ＆ドロップで行を自由に並び替えできる手動順"
              >
                <span>手動 (D&D)</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleSort('tagNo')}
                className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  sortField === 'tagNo'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="機器番号順でソート (昇順/降順)"
              >
                <span>機器番号順</span>
                {sortField === 'tagNo' ? (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleToggleSort('deliveryDate')}
                className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  sortField === 'deliveryDate'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="納期順でソート (昇順/降順)"
              >
                <span>納期順</span>
                {sortField === 'deliveryDate' ? (
                  sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Batch Action Toolbar when items are selected */}
          {selectedItemIds.length > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-3 shadow-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-400">
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{selectedItemIds.length} 件選択中</span>
                </div>
                <span className="text-[11px] text-slate-300 hidden sm:inline">
                  行をつかんで移動（表内の並び替え、または左のカテゴリへドロップ）
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* 納入時期を一括編集 */}
                <button
                  type="button"
                  onClick={() => handleOpenDeliveryEditor()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>納入時期を一括変更</span>
                </button>

                {/* カテゴリ一括移動ドロップダウン */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsBatchCategoryMenuOpen(prev => !prev)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5 text-slate-400" />
                    <span>カテゴリ一括移動</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {isBatchCategoryMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30 text-slate-800 text-xs animate-in fade-in">
                      <div className="px-3 py-1 text-[10px] text-slate-400 uppercase font-bold tracking-wider border-b border-slate-100">
                        移動先カテゴリを選択
                      </div>
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            onBatchMoveToCategory(selectedItemIds, cat.id);
                            setIsBatchCategoryMenuOpen(false);
                            setSelectedItemIds([]);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>{cat.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {categoryCountMap[cat.id] || 0}件
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 選択解除 */}
                <button
                  type="button"
                  onClick={() => setSelectedItemIds([])}
                  className="px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md text-xs transition-colors cursor-pointer"
                  title="選択を解除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Clean High-Legibility Table without Traceability Clutter */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center p-0.5 rounded cursor-pointer mx-auto"
                        title={isAllSelected ? 'すべての選択を解除' : '表示中の全件を選択'}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : isSomeSelected ? (
                          <MinusSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-1.5 w-6 text-center" title="ドラッグ＆ドロップで行順の入替またはカテゴリ移動"></th>
                    
                    {/* 機器番号 (クリックでソート切り替え) */}
                    <th 
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => handleToggleSort('tagNo')}
                      title="クリックして機器番号順でソート"
                    >
                      <div className="flex items-center gap-1">
                        <span>機器番号</span>
                        {sortField === 'tagNo' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-300" />
                        )}
                      </div>
                    </th>

                    <th className="py-2.5 px-3 whitespace-nowrap">機器名</th>
                    <th className="py-2.5 px-3">機器仕様 (口径・出力・材質等)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">数量</th>
                    
                    {/* 特記事項 comes BEFORE 納入時期 */}
                    <th className="py-2.5 px-3">特記事項</th>

                    {/* 納入時期 comes AFTER 特記事項 (クリックでソート切り替え) */}
                    <th 
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => handleToggleSort('deliveryDate')}
                      title="クリックして納期順でソート"
                    >
                      <div className="flex items-center gap-1">
                        <span>納入時期</span>
                        {sortField === 'deliveryDate' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-300" />
                        )}
                      </div>
                    </th>

                    <th className="py-2.5 px-3 text-right whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        該当する機器データがありません。「機器を追加」または「Excel読込」から登録してください。
                      </td>
                    </tr>
                  ) : (
                    sortedItems.map((item) => {
                      const hasSpecs = item.specs && item.specs.length > 0;
                      const isSelected = selectedItemIds.includes(item.id);
                      const isDragHovered = dragOverRowId === item.id;
                      const dropIndicatorClass = isDragHovered
                        ? (dropPosition === 'before' ? 'border-t-2 border-indigo-600 bg-indigo-50/40' : 'border-b-2 border-indigo-600 bg-indigo-50/40')
                        : '';

                      return (
                        <tr
                          key={item.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          onDragOver={(e) => handleRowDragOver(e, item.id)}
                          onDragLeave={handleRowDragLeave}
                          onDrop={(e) => handleRowDrop(e, item.id)}
                          onClick={() => onEditItem(item)}
                          className={`transition-colors group cursor-pointer ${dropIndicatorClass} ${
                            isSelected 
                              ? 'bg-indigo-50/60 hover:bg-indigo-50/90' 
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Checkbox column */}
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleToggleSelectItem(item.id, e)}
                              className="text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center p-0.5 rounded cursor-pointer mx-auto"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* Drag handle for row reordering & category drop */}
                          <td 
                            className="py-3 px-1.5 text-slate-300 group-hover:text-slate-600 cursor-grab active:cursor-grabbing text-center" 
                            title="つかんで上下にドラッグで行順入れ替え / 左へドラッグでカテゴリ移動"
                          >
                            <GripVertical className="w-4 h-4 mx-auto" />
                          </td>

                          <td className="py-3 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {item.tagNo || '-'}
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {item.name}
                            </div>
                          </td>

                          {/* Dynamic specifications display */}
                          <td className="py-2.5 px-3">
                            {hasSpecs ? (
                              <div className="flex flex-wrap gap-1">
                                {item.specs!.map((s) => (
                                  <span
                                    key={s.id}
                                    className="inline-flex items-center gap-1 bg-slate-100/90 text-slate-800 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-200/60"
                                  >
                                    <span className="text-slate-500 font-sans">{s.name}:</span>
                                    <span className="font-semibold text-slate-900">{s.value}</span>
                                    {s.unit && <span className="text-slate-500 text-[10px]">{s.unit}</span>}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                                {item.diameter && item.diameter !== '-' && (
                                  <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60">
                                    <span className="text-slate-500 font-sans">口径:</span> {item.diameter}
                                  </span>
                                )}
                                {item.material && item.material !== '-' && (
                                  <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60">
                                    <span className="text-slate-500 font-sans">材質:</span> {item.material}
                                  </span>
                                )}
                                {(!item.diameter || item.diameter === '-') && (!item.material || item.material === '-') && (
                                  <span className="text-slate-400">-</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <span className="font-bold text-slate-900">{item.quantity}</span>
                            <span className="text-slate-500 ml-1">{item.unit || '台'}</span>
                          </td>

                          {/* 特記事項 comes BEFORE 納入時期 */}
                          <td className="py-3 px-3 text-slate-600 text-[11px]">
                            {item.notes ? (
                              <div className="line-clamp-2 max-w-[240px]" title={item.notes}>
                                {item.notes}
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* 納入時期 comes AFTER 特記事項 (Clickable to edit delivery date) */}
                          <td
                            className="py-3 px-3 font-mono whitespace-nowrap group/deliv cursor-pointer hover:bg-indigo-50/80 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeliveryEditor(item.id);
                            }}
                            title={
                              selectedItemIds.length > 1 && selectedItemIds.includes(item.id)
                                ? `選択中の${selectedItemIds.length}件の納入時期を一括変更`
                                : 'クリックして納入時期を素早く編集'
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={item.deliveryDate ? 'text-slate-800 font-medium' : 'text-slate-300 italic'}>
                                {item.deliveryDate || '-'}
                              </span>
                              <Calendar className="w-3.5 h-3.5 text-slate-300 group-hover/deliv:text-indigo-600 transition-colors opacity-0 group-hover/deliv:opacity-100 shrink-0" />
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onEditItem(item)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="編集"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
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
              <div className="flex items-center gap-3">
                <span>合計: <strong className="text-slate-900 font-mono tabular-nums">{sortedItems.length}</strong> 機器</span>
                {selectedItemIds.length > 0 && (
                  <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                    {selectedItemIds.length} 件選択中
                  </span>
                )}
                {sortField !== 'manual' && (
                  <span className="text-slate-400 text-[11px]">
                    ソート中: {sortField === 'tagNo' ? '機器番号順' : '納期順'} ({sortDirection === 'asc' ? '昇順' : '降順'})
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                行をドラッグ＆ドロップで並び替え / 納入時期クリックで即座に変更 / 複数選択で一括編集
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Batch Delivery Date Modal */}
      {isBatchDeliveryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">納入時期の一括編集</h3>
                  <p className="text-[11px] text-slate-500">
                    選択中の機器 {selectedItemIds.length} 件の納入時期を一度に変更します
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchDeliveryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (batchDeliveryValue.trim()) {
                  onBatchUpdateDeliveryDate(selectedItemIds, batchDeliveryValue.trim());
                  setIsBatchDeliveryModalOpen(false);
                }
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  納入時期を入力（直打ち または カレンダー選択）
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={batchDeliveryValue}
                    onChange={(e) => setBatchDeliveryValue(e.target.value)}
                    placeholder="例: 2026/03/31 または 工事工程による"
                    className="flex-1 text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                  />
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        setBatchDeliveryValue(e.target.value.replace(/-/g, '/'));
                      }
                    }}
                    className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-700 bg-slate-50 cursor-pointer hover:bg-slate-100 h-9 shrink-0"
                    title="カレンダーから日付を選択"
                  />
                </div>
              </div>

              {/* Specific Options: 工事工程による & 未定 */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                  指定設定:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchDeliveryValue('工事工程による')}
                    className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-all cursor-pointer ${
                      batchDeliveryValue === '工事工程による'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    工事工程による
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchDeliveryValue('未定')}
                    className={`px-3 py-1.5 text-xs rounded-md border font-medium transition-all cursor-pointer ${
                      batchDeliveryValue === '未定'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 font-bold shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    未定
                  </button>

                  {batchDeliveryValue && (
                    <button
                      type="button"
                      onClick={() => setBatchDeliveryValue('')}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600 underline ml-auto cursor-pointer"
                    >
                      クリア
                    </button>
                  )}
                </div>
              </div>

              {/* Target Items Preview */}
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
                  <span>対象の機器一覧 ({selectedItemIds.length}件):</span>
                  <span className="text-[10px] text-slate-400">変更前 → 変更後</span>
                </div>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50/50 space-y-1 divide-y divide-slate-100">
                  {items
                    .filter(it => selectedItemIds.includes(it.id))
                    .map(it => (
                      <div key={it.id} className="pt-1 first:pt-0 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate mr-2">
                          <span className="font-mono font-semibold text-slate-700 shrink-0">
                            {it.tagNo || '-'}
                          </span>
                          <span className="text-slate-900 truncate">{it.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
                          <span className="font-mono text-slate-400">{it.deliveryDate || '未設定'}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-mono font-semibold text-indigo-600">
                            {batchDeliveryValue || '未入力'}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBatchDeliveryModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!batchDeliveryValue.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>一括変更を実行（{selectedItemIds.length}件）</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
