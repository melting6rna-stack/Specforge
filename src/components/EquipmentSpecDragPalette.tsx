import React, { useMemo, useState } from 'react';
import {
  GripVertical,
  Sparkles,
  CheckCircle2,
  MapPin,
  Undo2,
  Save,
  Download,
  Layers,
  StickyNote,
} from 'lucide-react';
import { EquipmentItem, SpecTemplate, TemplateFolderState } from '../types';
import {
  buildDraggableSpecChipsForItem,
  DragDropMode,
  DraggableSpecChip,
} from '../utils/specDragDropUtils';

interface EquipmentSpecDragPaletteProps {
  orderedActiveItems: EquipmentItem[];
  activeTemplate: SpecTemplate;
  dndMode: DragDropMode;
  onChangeDndMode: (mode: DragDropMode) => void;
  draggingChip: DraggableSpecChip | null;
  onDragStartChip: (chip: DraggableSpecChip) => void;
  onDragEndChip: () => void;
  onJumpToCell: (cellAddress: string) => void;
  overrideChipCells: Record<string, string[]>;
  canUndo: boolean;
  onUndo: () => void;
  hasUnsavedMappingChanges: boolean;
  templateFolderState?: TemplateFolderState | null;
  onSaveMappingToFolder?: () => void;
  onDownloadMappingJson?: () => void;
  isSavingMapping?: boolean;
}

export const EquipmentSpecDragPalette: React.FC<EquipmentSpecDragPaletteProps> = ({
  orderedActiveItems,
  activeTemplate,
  dndMode,
  onChangeDndMode,
  draggingChip,
  onDragStartChip,
  onDragEndChip,
  onJumpToCell,
  overrideChipCells,
  canUndo,
  onUndo,
  hasUnsavedMappingChanges,
  templateFolderState,
  onSaveMappingToFolder,
  onDownloadMappingJson,
  isSavingMapping = false,
}) => {
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(0);
  const [onlyUnmapped, setOnlyUnmapped] = useState<boolean>(true);

  const maxSlots = Math.min(orderedActiveItems.length, 4);
  const effectiveSlotIdx = (selectedSlotIdx < maxSlots ? selectedSlotIdx : 0) as 0 | 1 | 2 | 3;
  const activeItem = orderedActiveItems[effectiveSlotIdx];

  const allChips = useMemo(() => {
    if (!activeItem) return [];
    return buildDraggableSpecChipsForItem(
      activeItem,
      effectiveSlotIdx,
      activeTemplate,
      overrideChipCells
    );
  }, [activeItem, effectiveSlotIdx, activeTemplate, overrideChipCells]);

  const unmappedCount = useMemo(
    () => allChips.filter((c) => !c.mappedCell && c.overriddenCells.length === 0).length,
    [allChips]
  );

  const visibleChips = useMemo(() => {
    if (!onlyUnmapped) return allChips;
    return allChips.filter((c) => !c.mappedCell && c.overriddenCells.length === 0);
  }, [allChips, onlyUnmapped]);

  if (!activeItem) return null;

  return (
    <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3 space-y-2.5 text-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>機器仕様チップ（プレビューへドラッグ＆ドロップ）</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">
            下の仕様チップを右側の仕様書プレビューのセルにドロップして配置できます。
          </p>
        </div>

        <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-emerald-200 text-emerald-800">
          未配置 {unmappedCount} / {allChips.length}
        </span>
      </div>

      {/* Mode Switcher: Pattern A (Template Mapping) vs Pattern B (One-time Override) */}
      <div className="bg-white border border-slate-200 rounded-lg p-1.5 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
          <span className="font-semibold text-slate-700">ドロップ時の反映パターン</span>
          <span>
            {dndMode === 'mapping'
              ? 'テンプレート定義へ登録（再利用可）'
              : 'この仕様書限りの単発貼付'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onChangeDndMode('mapping')}
            className={`px-2 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              dndMode === 'mapping'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>マッピング登録</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeDndMode('override')}
            className={`px-2 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              dndMode === 'override'
                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5 shrink-0" />
            <span>今回のみ値貼付</span>
          </button>
        </div>
      </div>

      {/* Equipment Slot Tabs (when multiple equipment items are selected) */}
      {maxSlots > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {orderedActiveItems.slice(0, 4).map((it, idx) => {
            const isActive = idx === effectiveSlotIdx;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setSelectedSlotIdx(idx)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {idx + 1}種類目 [{it.tagNo || '未割当'}]
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Row */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="text-[10px] font-semibold text-slate-700 truncate">
          対象: <span className="font-mono text-indigo-700">[{activeItem.tagNo || '未割当'}]</span>{' '}
          {activeItem.name}
        </div>
        <div className="flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setOnlyUnmapped(true)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
              onlyUnmapped
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            未配置のみ ({unmappedCount})
          </button>
          <button
            type="button"
            onClick={() => setOnlyUnmapped(false)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
              !onlyUnmapped
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            すべて ({allChips.length})
          </button>
        </div>
      </div>

      {/* Draggable Chip Grid */}
      {visibleChips.length === 0 ? (
        <div className="bg-white/90 border border-emerald-200 rounded-lg p-3 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>この機器の仕様項目はすべて配置済みです</span>
          </div>
          <p className="text-[10px] text-slate-500">
            「すべて」に切り替えると、配置済み項目の再配置や別セルへのコピーも可能です。
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
          {visibleChips.map((chip) => {
            const isDraggingThis = draggingChip?.chipKey === chip.chipKey;
            const isMapped = Boolean(chip.mappedCell);
            const hasOverride = chip.overriddenCells.length > 0;

            return (
              <div
                key={chip.chipKey}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copyLink';
                  try {
                    e.dataTransfer.setData('application/x-specforge-chip', JSON.stringify(chip));
                    e.dataTransfer.setData('text/plain', `${chip.label}: ${chip.value}`);
                  } catch {
                    // ignore clipboard/dataTransfer restriction
                  }
                  onDragStartChip(chip);
                }}
                onDragEnd={onDragEndChip}
                title={`ドラッグしてプレビューのセルにドロップ（${chip.label}: ${chip.value}）`}
                className={`group inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] transition-all select-none cursor-grab active:cursor-grabbing shadow-2xs ${
                  isDraggingThis
                    ? 'opacity-50 ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50'
                    : isMapped
                    ? 'bg-white border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/40'
                    : hasOverride
                    ? 'bg-amber-50/70 border-amber-300 hover:border-amber-500'
                    : 'bg-white border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50'
                }`}
              >
                <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                <span className="text-slate-600 font-semibold">{chip.label}:</span>
                <span className="font-mono font-bold text-slate-900 max-w-[160px] truncate">
                  {chip.value}
                </span>

                {isMapped ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (chip.mappedCell) onJumpToCell(chip.mappedCell);
                    }}
                    className="inline-flex items-center gap-0.5 font-mono text-[9px] font-bold bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-1.5 py-0.5 rounded cursor-pointer shrink-0"
                    title={`セル ${chip.mappedCell} へジャンプ`}
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    <span>{chip.mappedCell}</span>
                  </button>
                ) : hasOverride ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToCell(chip.overriddenCells[chip.overriddenCells.length - 1]);
                    }}
                    className="inline-flex items-center gap-0.5 font-mono text-[9px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 px-1.5 py-0.5 rounded cursor-pointer shrink-0"
                    title={`単発貼付先 ${chip.overriddenCells.join(', ')} へジャンプ`}
                  >
                    <span>貼付 {chip.overriddenCells[chip.overriddenCells.length - 1]}</span>
                  </button>
                ) : (
                  <span className="font-mono text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                    未配置
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action Footer: Undo + Save Mapping JSON */}
      {(canUndo || hasUnsavedMappingChanges) && (
        <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between gap-2 flex-wrap">
          <div>
            {canUndo && (
              <button
                type="button"
                onClick={onUndo}
                className="px-2 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                <span>直前の配置を元に戻す</span>
              </button>
            )}
          </div>

          {hasUnsavedMappingChanges && (
            <div className="flex items-center gap-1.5">
              {templateFolderState && onSaveMappingToFolder ? (
                <button
                  type="button"
                  onClick={onSaveMappingToFolder}
                  disabled={isSavingMapping}
                  className="px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                  title="ドラッグ＆ドロップで追加・変更したセルマッピングを参照元フォルダの .specmap.json に保存します"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingMapping ? '保存中...' : 'フォルダのJSONに保存'}</span>
                </button>
              ) : (
                onDownloadMappingJson && (
                  <button
                    type="button"
                    onClick={onDownloadMappingJson}
                    className="px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                    title="変更したマッピング定義を .specmap.json としてダウンロードします"
                  >
                    <Download className="w-3 h-3" />
                    <span>マッピングJSONを保存</span>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
