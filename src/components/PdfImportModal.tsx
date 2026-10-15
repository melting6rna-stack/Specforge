import React, { useState, useRef } from 'react';
import { X, FileText, Check, AlertCircle, Edit2, Database, Upload, ArrowRight } from 'lucide-react';
import { EquipmentItem, Category } from '../types';
import { extractTextFromPdf, parsePdfTextToEquipment, ExtractedPdfItem } from '../utils/pdfParser';

interface PdfImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (newItems: EquipmentItem[]) => void;
  activeProjectId: string;
  categories: Category[];
}

export const PdfImportModal: React.FC<PdfImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  activeProjectId,
  categories
}) => {
  if (!isOpen) return null;

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedItems, setExtractedItems] = useState<ExtractedPdfItem[]>([]);
  const [targetCategoryId, setTargetCategoryId] = useState<string>(categories[0]?.id || 'cat-etc');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rawPreview, setRawPreview] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMessage('');
    setIsProcessing(true);

    try {
      const { fullText, totalPages } = await extractTextFromPdf(file);
      if (!fullText.trim()) {
        setErrorMessage('PDFからテキストを抽出できませんでした。スキャン画像のみのPDFの場合は、OCR処理されたPDFをご利用ください。');
        setIsProcessing(false);
        return;
      }

      const result = parsePdfTextToEquipment(fullText, file.name, totalPages);
      setExtractedItems(result.extractedItems);
      setRawPreview(result.rawTextPreview);
    } catch (err: any) {
      setErrorMessage(`PDFの読み取り中にエラーが発生しました: ${err.message || '形式をご確認ください'}`);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleUpdateItem = (index: number, field: keyof ExtractedPdfItem, value: any) => {
    setExtractedItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveToDatabase = () => {
    if (extractedItems.length === 0) return;

    const now = new Date().toISOString().slice(0, 10);
    const convertedItems: EquipmentItem[] = extractedItems.map((item, idx) => ({
      id: `eq-pdf-${Date.now()}-${idx}`,
      projectId: activeProjectId,
      tagNo: item.tagNo,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit || '台',
      diameter: item.diameter,
      material: item.material,
      deliveryDate: item.deliveryDate || now,
      categoryId: targetCategoryId,
      deliveryLocation: '指定受入場所',
      notes: item.notes,
      history: [
        {
          id: `hist-pdf-${idx}`,
          itemId: `eq-pdf-${Date.now()}-${idx}`,
          timestamp: new Date().toLocaleString('ja-JP', { hour12: false }),
          author: 'PDF取込 (No AI)',
          field: 'all',
          fieldLabel: '初期取込',
          oldValue: '-',
          newValue: '仕様書PDFより自動抽出',
          reason: `仕様書PDF (${selectedFile?.name || 'PDF'}) からのルールベース読み取り取込`
        }
      ],
      createdAt: now,
      updatedAt: now
    }));

    onConfirmImport(convertedItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">仕様書PDFの読み取り＆データベース化</h2>
                <span className="text-[10px] bg-slate-800 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                  No AI・100% オフライン
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                外部サーバー通信なしでPDF内の文字を直接解析し、機器名・口径・材質・数量・納期を抽出します
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50 rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileText className="w-9 h-9 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">
              {selectedFile ? selectedFile.name : '仕様書PDFファイルをドラッグ＆ドロップ、またはクリックして選択'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              ※ CADやWord、Excelから直接出力された文字選択可能なPDFに対応しています
            </p>
          </div>

          {isProcessing && (
            <div className="py-6 text-center text-slate-600 space-y-2">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-slate-900 border-t-transparent"></div>
              <p className="text-xs">PDFをブラウザ内部でオフライン解析中...</p>
            </div>
          )}

          {/* Extracted Items Verification Table */}
          {!isProcessing && extractedItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">抽出結果の確認・編集</span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                    {extractedItems.length} 件検出
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">取込先カテゴリ:</span>
                  <select
                    value={targetCategoryId}
                    onChange={(e) => setTargetCategoryId(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5">機器番号</th>
                      <th className="py-2 px-2.5">機器名</th>
                      <th className="py-2 px-2.5">口径</th>
                      <th className="py-2 px-2.5">材質</th>
                      <th className="py-2 px-2.5 text-right">数量</th>
                      <th className="py-2 px-2.5">納期</th>
                      <th className="py-2 px-2.5 text-center">削除</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extractedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.tagNo}
                            onChange={(e) => handleUpdateItem(idx, 'tagNo', e.target.value)}
                            className="w-20 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            className="w-full min-w-[160px] border border-slate-200 rounded px-1.5 py-0.5 font-medium text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.diameter}
                            onChange={(e) => handleUpdateItem(idx, 'diameter', e.target.value)}
                            className="w-20 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={item.material}
                            onChange={(e) => handleUpdateItem(idx, 'material', e.target.value)}
                            className="w-24 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-16 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-right text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="date"
                            value={item.deliveryDate}
                            onChange={(e) => handleUpdateItem(idx, 'deliveryDate', e.target.value)}
                            className="border border-slate-200 rounded px-1.5 py-0.5 font-mono text-xs"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-400 hover:text-red-500 p-1"
                            title="除外"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400">
                ※ 表内の値は直接編集可能です。確認後に下のボタンでデータベースへ一括登録されます。
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded transition-colors"
          >
            キャンセル
          </button>

          <button
            onClick={handleSaveToDatabase}
            disabled={extractedItems.length === 0}
            className={`px-4 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-2xs ${
              extractedItems.length > 0
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>データベースに取込登録 ({extractedItems.length}件)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
