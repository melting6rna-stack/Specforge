import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Layers, 
  PlusCircle, 
  SlidersHorizontal,
  Calendar,
  Hash,
  FileText
} from 'lucide-react';
import { EquipmentItem, Category, EquipmentSpecParam } from '../types';

interface ItemCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: EquipmentItem) => void;
  categories: Category[];
  projectId: string;
  existingCount: number;
}

// Preset specification suggestions commonly used in industrial plants
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
  { name: '回転数', unit: 'min⁻¹', defaultVal: '1750' },
  { name: '重量', unit: 'kg', defaultVal: '' }
];

export const ItemCreateModal: React.FC<ItemCreateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  projectId,
  existingCount
}) => {
  if (!isOpen) return null;

  // Basic Information
  const [tagNo, setTagNo] = useState(`EQ-${String(existingCount + 1).padStart(3, '0')}`);
  const [equipmentType, setEquipmentType] = useState('VA');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-etc');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('台');
  const [deliveryDate, setDeliveryDate] = useState(() => {
    // Default to roughly 2 months from now
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Dynamic Specifications: User adds specs one by one with item name, value, and unit
  const [specs, setSpecs] = useState<EquipmentSpecParam[]>([
    { id: `sp-1`, name: '口径', value: '50', unit: 'A' },
    { id: `sp-2`, name: '材質', value: 'SUS304', unit: '' }
  ]);

  const [errorMessage, setErrorMessage] = useState('');

  // Add a blank specification item
  const handleAddSpecRow = (namePreset = '', unitPreset = '', valPreset = '') => {
    const newSpec: EquipmentSpecParam = {
      id: `sp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: namePreset,
      value: valPreset,
      unit: unitPreset
    };
    setSpecs(prev => [...prev, newSpec]);
  };

  // Remove a spec row
  const handleRemoveSpecRow = (id: string) => {
    setSpecs(prev => prev.filter(s => s.id !== id));
  };

  // Update a spec row
  const handleUpdateSpecRow = (id: string, updates: Partial<EquipmentSpecParam>) => {
    setSpecs(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('機器名を入力してください。');
      return;
    }

    const nowStr = new Date().toISOString().slice(0, 10);

    // Filter out completely empty spec rows
    const validSpecs = specs.filter(s => s.name.trim() || s.value.trim());

    // Extract diameter & material for backward-compatibility if present in specs
    const diameterSpec = validSpecs.find(s => s.name.includes('口径') || s.name.toLowerCase().includes('size'));
    const materialSpec = validSpecs.find(s => s.name.includes('材質') || s.name.toLowerCase().includes('mat'));

    const derivedDiameter = diameterSpec 
      ? `${diameterSpec.value}${diameterSpec.unit ? ' ' + diameterSpec.unit : ''}`.trim()
      : '-';

    const derivedMaterial = materialSpec 
      ? `${materialSpec.value}${materialSpec.unit ? ' ' + materialSpec.unit : ''}`.trim()
      : '-';

    const newItem: EquipmentItem = {
      id: `eq-${Date.now()}`,
      projectId,
      tagNo: tagNo.trim(),
      equipmentType: equipmentType.trim().toUpperCase(),
      name: name.trim(),
      quantity: Number(quantity) || 1,
      unit: unit.trim() || '台',
      deliveryDate: deliveryDate.trim(),
      categoryId,
      deliveryLocation: deliveryLocation.trim() || undefined,
      notes: notes.trim() || undefined,
      specs: validSpecs,
      diameter: derivedDiameter,
      material: derivedMaterial,
      createdAt: nowStr,
      updatedAt: nowStr
    };

    onSave(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header: Distinct UI for adding equipment */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-400/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm">新規機器の登録</h2>
                <span className="text-[10px] bg-indigo-900/80 text-indigo-200 border border-indigo-700/60 px-2 py-0.5 rounded font-mono">
                  個別仕様項目対応
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                機器に合わせて仕様項目（口径・出力等）を1つずつ個別追加できます
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: 基本情報 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span>1. 機器基本情報</span>
              </span>
              <span className="text-[11px] text-slate-400">* は必須項目</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono font-bold uppercase text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  機器番号 (タグNo.)
                </label>
                <input
                  type="text"
                  placeholder="例: V-101, P-201"
                  value={tagNo}
                  onChange={(e) => setTagNo(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  所属カテゴリ
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
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
                    placeholder="例: 高圧渦巻ポンプ, ステンレス製電動仕切弁"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
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
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono tabular-nums focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
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
                    className="w-full border border-slate-300 rounded-md px-2 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>納入時期</span>
                </label>
                <input
                  type="text"
                  placeholder="例: 契約後 6ヶ月以内, 令和8年3月末 (空欄でも可、後から一括設定可能)"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 2: 機器仕様 (1つずつ追加・数値と単位を別々に入力) */}
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                  <span>2. 機器仕様項目の設定 (１つずつ追加)</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  機器仕様は機器ごとに異なるため、項目追加ボタンで必要な分だけ増やします。数値と単位は別々に入力します。
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAddSpecRow('', '', '')}
                className="self-start sm:self-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>項目を追加</span>
              </button>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-indigo-900">クイック追加:</span>
              {PRESET_SPECS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleAddSpecRow(p.name, p.unit, p.defaultVal)}
                  className="text-[10px] bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full transition-colors flex items-center gap-0.5"
                >
                  <span>+</span>
                  <span className="font-medium">{p.name}</span>
                  {p.unit && <span className="text-slate-400 font-mono text-[9px]">({p.unit})</span>}
                </button>
              ))}
            </div>

            {/* Dynamic Specification Rows Table */}
            <div className="bg-white border border-indigo-100 rounded-lg overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 w-1/3">仕様の項目 (項目名)</th>
                    <th className="py-2 px-3 w-1/3">実際の数値</th>
                    <th className="py-2 px-3 w-1/4">単位</th>
                    <th className="py-2 px-2 text-center w-10">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {specs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 text-[11px]">
                        仕様項目がありません。上の［項目を追加］またはクイック追加ボタンをクリックしてください。
                      </td>
                    </tr>
                  ) : (
                    specs.map((sp, idx) => (
                      <tr key={sp.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="例: 口径, 出力, 流量..."
                            value={sp.name}
                            onChange={(e) => handleUpdateSpecRow(sp.id, { name: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-medium focus:border-indigo-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="例: 50, 7.5, SUS304..."
                            value={sp.value}
                            onChange={(e) => handleUpdateSpecRow(sp.id, { value: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono font-medium focus:border-indigo-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="例: A, kW, m³/h (単位なしは空欄)"
                            value={sp.unit}
                            onChange={(e) => handleUpdateSpecRow(sp.id, { unit: e.target.value })}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-600 focus:border-indigo-500 focus:outline-hidden"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveSpecRow(sp.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                            title="この仕様項目を削除"
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

            {/* Live Spec Preview */}
            {specs.some(s => s.name && s.value) && (
              <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1 pt-1">
                <span className="font-semibold text-slate-500">仕様表示プレビュー:</span>
                {specs
                  .filter(s => s.name && s.value)
                  .map(s => (
                    <span key={s.id} className="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded text-[10px] font-mono shadow-2xs">
                      <span className="text-slate-500">{s.name}:</span>
                      <strong className="text-indigo-700">{s.value}</strong>
                      {s.unit && <span className="text-slate-600 font-normal">{s.unit}</span>}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Section 3: 特記事項 */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>特記事項・指示事項</span>
            </label>
            <textarea
              rows={2}
              placeholder="例: 禁油脱脂洗浄証明書添付のこと、JIS 10K フランジ接続、ミルシート提出要"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-slate-900 text-white font-medium rounded-md hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm text-xs"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>機器をデータベースに追加登録</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
