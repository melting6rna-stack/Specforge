import React, { useState } from 'react';
import { X, Save, Clock, AlertCircle } from 'lucide-react';
import { EquipmentItem, Category, ChangeLog } from '../types';

interface ItemEditModalProps {
  item: EquipmentItem;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedItem: EquipmentItem, newLog: ChangeLog | null) => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  item,
  categories,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    tagNo: item.tagNo || '',
    name: item.name || '',
    quantity: item.quantity || 1,
    unit: item.unit || '台',
    diameter: item.diameter || '',
    material: item.material || '',
    deliveryDate: item.deliveryDate || '',
    categoryId: item.categoryId || categories[0]?.id || 'cat-etc',
    deliveryLocation: item.deliveryLocation || '',
    notes: item.notes || '',
  });

  const [changeReason, setChangeReason] = useState('');
  const [changeAuthor, setChangeAuthor] = useState('設計担当');
  const [errorMessage, setErrorMessage] = useState('');

  const quickReasons = [
    '設計変更による口径・仕様見直し',
    '流体条件変更に伴う材質変更',
    '工事日程調整による納期前倒し',
    '予備品追加による数量変更',
    '配管ルート変更による型式改定'
  ];

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setErrorMessage('機器名を入力してください。');
      return;
    }

    // Detect changes
    const diffs: { field: string; label: string; oldVal: string; newVal: string }[] = [];

    if (formData.name !== item.name) {
      diffs.push({ field: 'name', label: '機器名', oldVal: item.name, newVal: formData.name });
    }
    if (formData.diameter !== item.diameter) {
      diffs.push({ field: 'diameter', label: '口径', oldVal: item.diameter, newVal: formData.diameter });
    }
    if (formData.material !== item.material) {
      diffs.push({ field: 'material', label: '材質', oldVal: item.material, newVal: formData.material });
    }
    if (formData.quantity !== item.quantity) {
      diffs.push({ field: 'quantity', label: '数量', oldVal: `${item.quantity}${item.unit}`, newVal: `${formData.quantity}${formData.unit}` });
    }
    if (formData.deliveryDate !== item.deliveryDate) {
      diffs.push({ field: 'deliveryDate', label: '納期', oldVal: item.deliveryDate, newVal: formData.deliveryDate });
    }
    if (formData.categoryId !== item.categoryId) {
      const oldCat = categories.find(c => c.id === item.categoryId)?.name || '未分類';
      const newCat = categories.find(c => c.id === formData.categoryId)?.name || '未分類';
      diffs.push({ field: 'category', label: 'カテゴリ', oldVal: oldCat, newVal: newCat });
    }
    if (formData.tagNo !== item.tagNo) {
      diffs.push({ field: 'tagNo', label: '機器番号', oldVal: item.tagNo || '(なし)', newVal: formData.tagNo });
    }
    if (formData.notes !== item.notes) {
      diffs.push({ field: 'notes', label: '特記事項', oldVal: item.notes || '(なし)', newVal: formData.notes });
    }

    // If changes occurred and reason is empty, enforce entry
    if (diffs.length > 0 && !changeReason.trim()) {
      setErrorMessage('変更履歴のトレーサビリティ管理のため、変更理由を入力してください。');
      return;
    }

    const nowStr = new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    let newLog: ChangeLog | null = null;
    if (diffs.length > 0) {
      newLog = {
        id: `hist-${Date.now()}`,
        itemId: item.id,
        timestamp: nowStr,
        author: changeAuthor.trim() || '担当者',
        field: diffs[0].field,
        fieldLabel: diffs.map(d => d.label).join(' / '),
        oldValue: diffs.map(d => `${d.label}: ${d.oldVal}`).join(', '),
        newValue: diffs.map(d => `${d.label}: ${d.newVal}`).join(', '),
        reason: changeReason.trim()
      };
    }

    const updatedItem: EquipmentItem = {
      ...item,
      tagNo: formData.tagNo,
      name: formData.name,
      quantity: Number(formData.quantity) || 1,
      unit: formData.unit,
      diameter: formData.diameter,
      material: formData.material,
      deliveryDate: formData.deliveryDate,
      categoryId: formData.categoryId,
      deliveryLocation: formData.deliveryLocation,
      notes: formData.notes,
      updatedAt: nowStr.slice(0, 10),
      history: newLog ? [newLog, ...(item.history || [])] : item.history
    };

    onSave(updatedItem, newLog);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">機器情報の編集・更新</span>
            {item.tagNo && (
              <span className="text-xs bg-slate-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
                {item.tagNo}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                機器番号 (タグNo.)
              </label>
              <input
                type="text"
                placeholder="例: V-101, P-01"
                value={formData.tagNo}
                onChange={(e) => handleFieldChange('tagNo', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                所属カテゴリ
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => handleFieldChange('categoryId', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                機器名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="例: ステンレス製ボールバルブ"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                口径 (呼び径・サイズ) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="例: 50A (2B), 100A, φ25"
                value={formData.diameter}
                onChange={(e) => handleFieldChange('diameter', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                材質 (材料規格) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="例: SUS304, SCS13A, SS400, PVC"
                value={formData.material}
                onChange={(e) => handleFieldChange('material', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  数量 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.quantity}
                  onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 1)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono tabular-nums focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  単位
                </label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => handleFieldChange('unit', e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                希望納期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.deliveryDate}
                onChange={(e) => handleFieldChange('deliveryDate', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                特記事項・指示事項
              </label>
              <input
                type="text"
                placeholder="例: 禁油処理、JIS 10K フランジ接続、ミルシート添付要"
                value={formData.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Change Reason Box */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3.5 space-y-2 mt-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>変更理由の記録 (トレーサビリティ)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="変更理由を入力 (例: 設計変更に伴う口径修正)"
                  value={changeReason}
                  onChange={(e) => {
                    setChangeReason(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full bg-white border border-amber-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="変更担当者名"
                  value={changeAuthor}
                  onChange={(e) => setChangeAuthor(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Quick reason buttons */}
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <span className="text-[10px] text-amber-800">定型:</span>
              {quickReasons.map(qr => (
                <button
                  key={qr}
                  type="button"
                  onClick={() => setChangeReason(qr)}
                  className="text-[10px] bg-white border border-amber-200 px-1.5 py-0.5 rounded text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  {qr}
                </button>
              ))}
            </div>
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
              <span>保存して履歴を記録</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
