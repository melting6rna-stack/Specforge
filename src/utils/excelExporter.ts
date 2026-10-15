import * as XLSX from 'xlsx';
import { EquipmentItem, SpecTemplate } from '../types';

export interface SpecExportData {
  documentNo: string;
  title: string;
  version: string;
  issueDate: string;
  issuerCompany: string;
  issuerAuthor: string;
  approverName: string;
  clientCompany: string;
  inspectionStandard: string;
  deliveryTerms: string;
  warrantyPeriod: string;
  notes: string;
}

/**
 * Generates and downloads a clean, structured Excel (.xlsx) equipment specification.
 * No monetary values; focused on 機器名, 口径, 材質, 数量, 納期, 変更履歴.
 */
export function exportEquipmentSpecToExcel(
  specData: SpecExportData,
  items: EquipmentItem[],
  template: SpecTemplate
) {
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: 仕様書本紙 (Formal Specification Sheet)
  // -------------------------------------------------------------
  const summaryRows: (string | number)[][] = [
    ['【 機 器 調 達 仕 様 書 】', '', '', '', '', ''],
    ['文書管理番号:', specData.documentNo, '', '改訂番号 (Rev):', `Rev ${specData.version}`, ''],
    ['発行年月日:', specData.issueDate, '', '適用テンプレート:', template.name, ''],
    ['仕様書標題:', specData.title, '', '作成担当者:', specData.issuerAuthor, ''],
    ['発行元会社:', specData.issuerCompany, '', '承認責任者:', specData.approverName, ''],
    ['納入先・発注先:', specData.clientCompany, '', '', '', ''],
    ['', '', '', '', '', ''],
    ['【1. 対象機器・調達仕様一覧】', '', '', '', '', ''],
    ['機器番号(タグNo)', '機器名', '口径', '材質', '数量', '希望納期'],
  ];

  for (const item of items) {
    summaryRows.push([
      item.tagNo || '-',
      item.name,
      item.diameter || '-',
      item.material || '-',
      `${item.quantity} ${item.unit || '台'}`,
      item.deliveryDate || '-'
    ]);
  }

  summaryRows.push(['', '', '', '', '', '']);
  summaryRows.push(['【2. 検査・納入・品質保証条件】', '', '', '', '', '']);
  summaryRows.push(['受入検査基準:', specData.inspectionStandard || template.inspectionStandard, '', '', '', '']);
  summaryRows.push(['納入場所・引渡条件:', specData.deliveryTerms || template.deliveryTerms, '', '', '', '']);
  summaryRows.push(['品質保証期間:', specData.warrantyPeriod || template.warrantyPeriod, '', '', '', '']);
  summaryRows.push(['特記事項・指示事項:', specData.notes || template.notesTemplate, '', '', '', '']);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 18 },
    { wch: 32 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, '仕様書本紙');

  // -------------------------------------------------------------
  // Sheet 2: 機器明細一覧 (Detailed Equipment List)
  // -------------------------------------------------------------
  const itemHeader = ['機器番号', '機器名', '口径', '材質', '数量', '単位', '納期', '納入場所', '備考・特記事項'];
  const itemDataRows = items.map(item => [
    item.tagNo || '',
    item.name,
    item.diameter || '',
    item.material || '',
    item.quantity,
    item.unit || '台',
    item.deliveryDate || '',
    item.deliveryLocation || '',
    item.notes || ''
  ]);

  const wsItems = XLSX.utils.aoa_to_sheet([itemHeader, ...itemDataRows]);
  wsItems['!cols'] = [
    { wch: 14 },
    { wch: 30 },
    { wch: 16 },
    { wch: 20 },
    { wch: 10 },
    { wch: 8 },
    { wch: 14 },
    { wch: 26 },
    { wch: 36 }
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, '機器明細一覧');

  // -------------------------------------------------------------
  // Sheet 3: 変更履歴・改訂記録 (Audit Trail)
  // -------------------------------------------------------------
  const historyHeader = ['記録日時', '機器番号', '機器名', '変更項目', '変更前内容', '変更後内容', '変更理由 (必須記録)', '担当者'];
  const historyDataRows: (string | number)[][] = [];

  for (const item of items) {
    if (item.history && item.history.length > 0) {
      for (const h of item.history) {
        historyDataRows.push([
          h.timestamp,
          item.tagNo || '-',
          item.name,
          h.fieldLabel || h.field,
          h.oldValue,
          h.newValue,
          h.reason,
          h.author
        ]);
      }
    }
  }

  if (historyDataRows.length === 0) {
    historyDataRows.push(['-', '-', '-', '初版作成', '-', '初期機器データ登録', '新規仕様書起票', specData.issuerAuthor]);
  }

  const wsHistory = XLSX.utils.aoa_to_sheet([historyHeader, ...historyDataRows]);
  wsHistory['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 28 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 36 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsHistory, '変更履歴・改訂記録');

  // Download
  const filename = `${specData.documentNo || '仕様書'}_${specData.issueDate || 'draft'}.xlsx`;
  XLSX.writeFile(wb, filename);
}
