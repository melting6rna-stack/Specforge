import React, { useState, useRef } from 'react';
import { 
  Settings2, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Save, 
  FileText, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SpecTemplate } from '../types';
import { parseExcelTemplateFile } from '../utils/excelTemplateParser';
import { DEFAULT_TEMPLATES } from '../data/defaultTemplates';

interface TemplateAdminTabProps {
  templates: SpecTemplate[];
  onUpdateTemplates: (updated: SpecTemplate[]) => void;
}

export const TemplateAdminTab: React.FC<TemplateAdminTabProps> = ({
  templates,
  onUpdateTemplates,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingTemplate, setEditingTemplate] = useState<SpecTemplate | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Upload Excel template
  const handleUploadExcelTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setUploadMessage('Excelファイルをブラウザ内で解析中 (オフライン)...');

    try {
      const result = await parseExcelTemplateFile(file);
      const nextTemplates = [result.template, ...templates];
      onUpdateTemplates(nextTemplates);
      setSelectedTemplateId(result.template.id);
      setUploadMessage(`Excelテンプレート「${file.name}」を正常に読み込み、登録しました。検出項目: [${result.detectedColumns.join(', ')}]`);
      setTimeout(() => setUploadMessage(''), 5000);
    } catch (err: any) {
      setErrorMessage(`Excelテンプレートの解析に失敗しました: ${err.message || '形式をご確認ください'}`);
    } finally {
      e.target.value = '';
    }
  };

  // Download a sample Excel template file so user can test or use it as reference
  const handleDownloadSampleExcel = () => {
    const wb = XLSX.utils.book_new();

    const headerRows = [
      ['【 機器調達仕様書 テンプレート 】', '', '', '', '', ''],
      ['文書番号:', 'SPEC-SAMPLE-001', '', '発行日:', new Date().toISOString().slice(0, 10), ''],
      ['案件名:', 'サンプル調達案件', '', '作成担当:', '設計部', ''],
      ['', '', '', '', '', ''],
      ['【機器明細一覧】', '', '', '', '', ''],
      ['機器番号', '機器名', '口径', '材質', '数量', '納期', '特記事項'],
      ['V-101', 'ステンレス製ボール弁', '50A', 'SCS13A', '4 台', '2026-05-15', 'JIS 10K フランジ'],
      ['P-201', '渦巻ポンプユニット', '80A×50A', 'SUS304', '2 基', '2026-06-20', '屋内型 7.5kW'],
      ['', '', '', '', '', ''],
      ['【検査基準】', '全数耐圧検査成績書およびミルシートの提出を必須とする。', '', '', '', ''],
      ['【引渡条件】', '指定工場受入口車上渡し。', '', '', '', ''],
      ['【品質保証】', '納入引渡完了日より1年間。', '', '', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(headerRows);
    ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, '仕様書フォーマット');
    XLSX.writeFile(wb, 'サンプル機器調達仕様書テンプレート.xlsx');
  };

  const handleStartEdit = (tpl: SpecTemplate) => {
    setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editingTemplate) return;
    const next = templates.map(t => t.id === editingTemplate.id ? editingTemplate : t);
    onUpdateTemplates(next);
    setIsEditing(false);
  };

  const handleDelete = (id: string) => {
    if (templates.length <= 1) {
      alert('テンプレートをすべて削除することはできません。');
      return;
    }
    const next = templates.filter(t => t.id !== id);
    onUpdateTemplates(next);
    setSelectedTemplateId(next[0].id);
    setIsEditing(false);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('標準のテンプレート構成にリセットしますか？')) {
      onUpdateTemplates(DEFAULT_TEMPLATES);
      setSelectedTemplateId(DEFAULT_TEMPLATES[0].id);
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">仕様書テンプレート管理</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Excelテンプレートを直接アップロードして項目を自動読み取り、仕様書の書き出しフォーマットとして登録できます。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Download sample excel */}
          <button
            onClick={handleDownloadSampleExcel}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
            title="参考用のサンプルExcelテンプレートファイルをダウンロード"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>サンプルExcel入手</span>
          </button>

          {/* Upload Excel template */}
          <label className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Excelテンプレート取込</span>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleUploadExcelTemplate}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {uploadMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{uploadMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Template List + Template Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Template List (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
              <span>登録済テンプレート ({templates.length})</span>
            </span>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {templates.map(tpl => {
              const isSelected = tpl.id === selectedTemplateId;
              return (
                <div
                  key={tpl.id}
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                    setIsEditing(false);
                  }}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-slate-800 text-indigo-300' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {tpl.sourceType === 'custom_excel' ? '取込Excel' : '標準プリセット'}
                    </span>
                    <span className={`font-mono text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {tpl.code}
                    </span>
                  </div>

                  <div className="font-semibold text-xs mt-1 leading-snug">
                    {tpl.name}
                  </div>

                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                    {tpl.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
            <span className="text-slate-400">100% オフライン保存</span>
            <button
              onClick={handleResetToDefaults}
              className="text-slate-500 hover:underline"
            >
              初期状態に戻す
            </button>
          </div>
        </div>

        {/* Template Detail / Edit Pane (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          
          {isEditing && editingTemplate ? (
            /* Editing mode */
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="font-bold text-slate-900 text-sm">テンプレート設定の編集</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3.5 py-1 bg-slate-900 text-white rounded font-medium flex items-center gap-1 shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>保存</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">テンプレート名</label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">受入検査基準の定型文</label>
                <textarea
                  rows={3}
                  value={editingTemplate.inspectionStandard}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, inspectionStandard: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">納入引渡条件の定型文</label>
                <textarea
                  rows={2}
                  value={editingTemplate.deliveryTerms}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, deliveryTerms: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">品質保証期間の定型文</label>
                <input
                  type="text"
                  value={editingTemplate.warrantyPeriod}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, warrantyPeriod: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{currentTemplate.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{currentTemplate.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEdit(currentTemplate)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>定型文を編集</span>
                  </button>

                  {templates.length > 1 && (
                    <button
                      onClick={() => handleDelete(currentTemplate.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Detected Columns */}
              <div>
                <span className="font-bold text-slate-900 block mb-1">構成項目・列名:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentTemplate.columns.map(col => (
                    <span key={col} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Standard text previews */}
              <div className="space-y-3 pt-2">
                <div>
                  <span className="font-bold text-slate-900 block mb-0.5">受入検査基準:</span>
                  <p className="whitespace-pre-line text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                    {currentTemplate.inspectionStandard}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block mb-0.5">納入引渡条件:</span>
                  <p className="whitespace-pre-line text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                    {currentTemplate.deliveryTerms}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 block mb-0.5">品質保証期間:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                    {currentTemplate.warrantyPeriod}
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
