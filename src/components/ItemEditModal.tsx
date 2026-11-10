import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  AlertCircle, 
  Plus, 
  Trash2, 
  SlidersHorizontal,
  Hash,
  FileText,
  History,
  Clock,
  MessageSquare
} from 'lucide-react';
import { EquipmentItem, Category, EquipmentSpecParam, ChangeLog } from '../types';

interface ItemEditModalProps {
  item: EquipmentItem;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: EquipmentItem) => void;
}

const PRESET_SPECS = [
  { name: '口径', unit: 'A', defaultVal: '50' },
  { name: '出力', unit: 'kW', defaultVal: '7.5' },
  { name: '流量', unit: 'm³/h', defaultVal: '30' },
  { name: '全揚程', unit: 'm', defaultVal: '25' },
  { name: '材質', unit: '', defaultVal: 'SUS304' },
  { name: '耐圧', unit: 'MPa', defaultVal: '1.0' },
  { name: '電圧', unit: 'V', defaultVal: '200' },
  { name: '塗装仕様', unit: '', defaultVal: 'エポキシ樹脂塗装' },
  { name: '塗色', unit: '', defaultVal: '5Y7/1' },
];

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  item,
  categories,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  const [tagNo, setTagNo] = useState(item.tagNo || '');
  const [equipmentType, setEquipmentType] = useState(item.equipmentType || '');
  const [name, setName] = useState(item.name || '');
  const [categoryId, setCategoryId] = useState(item.categoryId || categories[0]?.id || 'cat-etc');
  const [quantity, setQuantity] = useState<number>(item.quantity || 1);
  const [unit, setUnit] = useState(item.unit || '台');
  const [deliveryLocation, setDeliveryLocation] = useState(item.deliveryLocation || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [changeNote, setChangeNote] = useState('');

  // Specifications state
  const [specs, setSpecs] = useState<EquipmentSpecParam[]>(() => {
    if (item.specs && item.specs.length > 0) {
      return JSON.parse(JSON.stringify(item.specs));
    }
    // Synthesize initial specs from diameter and material if available
    const initialList: EquipmentSpecParam[] = [];
    if (item.diameter && item.diameter !== '-') {
      // e.g. "50A" -> name: "口径", value: "50", unit: "A"
      const match = item.diameter.match(/^([\d./x×~-]+)\s*([a-zA-Z\u3000-\u30FF]*)$/);
      if (match) {
        initialList.push({ id: 'sp-init-dia', name: '口径', value: match[1], unit: match[2] || 'A' });
      } else {
        initialList.push({ id: 'sp-init-dia', name: '口径', value: item.diameter, unit: '' });
      }
    }
    if (item.material && item.material !== '-') {
      initialList.push({ id: 'sp-init-mat', name: '材質', value: item.material, unit: '' });
    }
    return initialList;
  });

  const [errorMessage, setErrorMessage] = useState('');

  // Add a spec row
  const handleAddSpecRow = (namePreset = '', unitPreset = '', valPreset = '') => {
    const newSpec: EquipmentSpecParam = {
      id: `sp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: namePreset,
      value: valPreset,
      unit: unitPreset
    };
    setSpecs(prev => [...prev, newSpec]);
  };

  const handleRemoveSpecRow = (id: string) => {
    setSpecs(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateSpecRow = (id: string, updates: Partial<EquipmentSpecParam>) => {
    setSpecs(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('機器名を入力してください。');
      return;
    }

    const nowStr = new Date().toISOString().slice(0, 10);
    const validSpecs = specs.filter(s => s.name.trim() || s.value.trim());

    // Update derived diameter and material for export backward compatibility
    const diameterSpec = validSpecs.find(s => s.name.includes('口径') || s.name.toLowerCase().includes('size'));
    const materialSpec = validSpecs.find(s => s.name.includes('材質') || s.name.toLowerCase().includes('mat'));

    const derivedDiameter = diameterSpec 
      ? `${diameterSpec.value}${diameterSpec.unit ? ' ' + diameterSpec.unit : ''}`.trim()
      : (item.diameter || '-');

    const derivedMaterial = materialSpec 
      ? `${materialSpec.value}${materialSpec.unit ? ' ' + materialSpec.unit : ''}`.trim()
      : (item.material || '-');

    // Generate diff log automatically
    const diffList: string[] = [];
    if (tagNo.trim() !== (item.tagNo || '')) diffList.push(`機器番号: ${item.tagNo || '-'} → ${tagNo.trim()}`);
    if (equipmentType.trim().toUpperCase() !== (item.equipmentType || '')) diffList.push(`機器種別: ${item.equipmentType || '-'} → ${equipmentType.trim().toUpperCase()}`);
    if (name.trim() !== item.name) diffList.push(`機器名: ${item.name} → ${name.trim()}`);
    if (Number(quantity) !== item.quantity || unit.trim() !== item.unit) diffList.push(`数量: ${item.quantity}${item.unit} → ${quantity}${unit}`);
    if (categoryId !== item.categoryId) {
      const oldCat = categories.find(c => c.id === item.categoryId)?.name || '未分類';
      const newCat = categories.find(c => c.id === categoryId)?.name || '未分類';
      diffList.push(`カテゴリ: ${oldCat} → ${newCat}`);
    }
    if (notes.trim() !== (item.notes || '')) diffList.push('特記事項更新');

    const oldSpecsStr = (item.specs || []).map(s => `${s.name}:${s.value}${s.unit}`).join(', ');
    const newSpecsStr = validSpecs.map(s => `${s.name}:${s.value}${s.unit}`).join(', ');
    if (oldSpecsStr !== newSpecsStr && validSpecs.length > 0) {
      diffList.push(`仕様更新: ${validSpecs.map(s => `${s.name}: ${s.value}${s.unit ? ' ' + s.unit : ''}`).join(', ')}`);
    }

    let nextHistory = item.history || [];
    if (diffList.length > 0 || changeNote.trim()) {
      const logEntry: ChangeLog = {
        id: `hist-${Date.now()}`,
        itemId: item.id,
        timestamp: new Date().toLocaleString('ja-JP', { hour12: false }),
        author: '設計担当',
        field: diffList.length > 0 ? 'update' : 'memo',
        fieldLabel: diffList.length === 0 ? '変更メモ記録' : (diffList.length === 1 ? diffList[0].split(':')[0] : '複数項目変更'),
        oldValue: '-',
        newValue: diffList.length > 0 ? diffList.join(' / ') : changeNote.trim(),
        reason: changeNote.trim() || undefined
      };
      nextHistory = [logEntry, ...nextHistory];
    }

    const updatedItem: EquipmentItem = {
      ...item,
      tagNo: tagNo.trim(),
      equipmentType: equipmentType.trim().toUpperCase() || undefined,
      name: name.trim(),
      quantity: Number(quantity) || 1,
      unit: unit.trim() || '台',
      deliveryDate: item.deliveryDate || '',
      categoryId,
      deliveryLocation: deliveryLocation.trim() || undefined,
      notes: notes.trim() || undefined,
      specs: validSpecs,
      diameter: derivedDiameter,
      material: derivedMaterial,
      history: nextHistory,
      updatedAt: nowStr
    };

    onSave(updatedItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">機器情報の編集</span>
            {item.tagNo && (
              <span className="text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
                {item.tagNo}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>機器種別 (2文字)</span>
                <span className="text-[10px] text-slate-400">例: VA, PU</span>
              </label>
              <input
                type="text"
                maxLength={2}
                placeholder="VA"
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                className="w-full border border-slate-300 rounded px-3 py-2 font-mono font-bold uppercase text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                機器番号 (タグNo.)
              </label>
              <input
                type="text"
                placeholder="例: V-101, P-01"
                value={tagNo}
                onChange={(e) => setTagNo(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                所属カテゴリ
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* 機器名と数量・単位を同じ1行にまとめて配置 */}
            <div className="sm:col-span-2 grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 sm:col-span-7">
                <label className="block font-semibold text-slate-700 mb-1">
                  機器名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: ステンレス製ボールバルブ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="col-span-7 sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">
                  数量 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono tabular-nums focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="col-span-5 sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  単位
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="台"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>特記事項・指示事項</span>
              </label>
              <input
                type="text"
                placeholder="例: 禁油処理、JIS 10K フランジ接続、ミルシート添付要"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dynamic Specifications Editor */}
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                <span>機器仕様項目 (数値と単位を個別に編集)</span>
              </span>
              <button
                type="button"
                onClick={() => handleAddSpecRow('', '', '')}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>項目を追加</span>
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-indigo-900">クイック追加:</span>
              {PRESET_SPECS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleAddSpecRow(p.name, p.unit, p.defaultVal)}
                  className="text-[10px] bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded transition-colors"
                >
                  +{p.name}
                </button>
              ))}
            </div>

            <div className="bg-white border border-indigo-100 rounded-lg overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-3 w-1/3">仕様項目名</th>
                    <th className="py-1.5 px-3 w-1/3">数値</th>
                    <th className="py-1.5 px-3 w-1/4">単位</th>
                    <th className="py-1.5 px-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {specs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-slate-400 text-[11px]">
                        仕様項目が登録されていません。［項目を追加］で仕様を設定できます。
                      </td>
                    </tr>
                  ) : (
                    specs.map((sp) => (
                      <tr key={sp.id} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            placeholder="例: 口径, 出力..."
                            value={sp.name}
                            onChange={(e) => handleUpdateSpecRow(sp.id, { name: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            placeholder="例: 50, 7.5..."
                            value={sp.value}
                            onChange={(e) => handleUpdateSpecRow(sp.id, { value: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono font-medium focus:border-indigo-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            placeholder="例: A, kW..."
                            value={sp.unit}
                            onChange={(e) => handleUpdateSpecRow(sp.id, { unit: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-600 focus:border-indigo-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecRow(sp.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optional Change Note */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              変更メモ <span className="text-slate-400 font-normal text-[10px]">(任意入力 · 変更履歴ログに記録されます)</span>
            </label>
            <input
              type="text"
              placeholder="例: 流体条件変更に伴う口径修正、客先指示による納期変更など"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Item's Own Change History & Memo Timeline */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-600" />
                <span>この機器の変更履歴・メモ一覧</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">
                  {item.history?.length || 0} 件
                </span>
              </span>
              <span className="text-[10px] text-slate-400">新しい履歴が上部に表示されます</span>
            </div>

            {(!item.history || item.history.length === 0) ? (
              <p className="text-slate-400 text-[11px] py-2.5 text-center bg-white rounded border border-dashed border-slate-200">
                まだ変更履歴・メモはありません。上の入力欄に変更メモを残して保存するとここに蓄積されます。
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {item.history.map((log) => (
                  <div key={log.id} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{log.timestamp}</span>
                      </span>
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-sans text-[10px]">
                        {log.author || '設計担当'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-800 flex items-start gap-1">
                      <span className="font-semibold text-indigo-700 shrink-0">[{log.fieldLabel || '変更'}]:</span>
                      <span className="text-slate-700 font-mono text-[11px] break-all">{log.newValue}</span>
                    </div>

                    {log.reason && (
                      <div className="bg-amber-50/90 border border-amber-200 text-amber-950 rounded px-2 py-1 text-[11px] flex items-start gap-1.5 mt-1">
                        <MessageSquare className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <span className="font-medium">{log.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 text-white font-medium rounded hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>更新を保存</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
