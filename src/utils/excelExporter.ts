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
 * Normalizes Excel column letter to 0-based column index (e.g. 'A' -> 0, 'E' -> 4, 'AA' -> 26)
 */
export function colLetterToIndex(colStr: string): number {
  const clean = colStr.trim().toUpperCase();
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    index = index * 26 + (clean.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Splits a cell address like "E30" into { c: 4, r: 29 } (0-indexed).
 */
export function parseCellAddress(cellStr: string): { c: number; r: number } | null {
  const match = cellStr.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const col = colLetterToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1;
  if (col < 0 || row < 0) return null;
  return { c: col, r: row };
}

/**
 * Safely updates or creates a cell value in a SheetJS worksheet without destroying styles/formulas.
 */
function setCellValue(ws: XLSX.WorkSheet, cellAddr: string, val: string | number) {
  const cleanAddr = cellAddr.trim().toUpperCase();
  if (!cleanAddr) return;

  const parsed = parseCellAddress(cleanAddr);
  if (!parsed) return;

  // Determine cell type: number or string
  const isNum = typeof val === 'number';
  const cellObj: XLSX.CellObject = ws[cleanAddr] || { t: isNum ? 'n' : 's', v: val };
  cellObj.t = isNum ? 'n' : 's';
  cellObj.v = val;
  cellObj.w = String(val);

  ws[cleanAddr] = cellObj;

  // Update worksheet bounds (!ref) if necessary
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    if (parsed.c > range.e.c) range.e.c = parsed.c;
    if (parsed.r > range.e.r) range.e.r = parsed.r;
    if (parsed.c < range.s.c) range.s.c = parsed.c;
    if (parsed.r < range.s.r) range.s.r = parsed.r;
    ws['!ref'] = XLSX.utils.encode_range(range);
  } else {
    ws['!ref'] = `${cleanAddr}:${cleanAddr}`;
  }
}

/**
 * Helper to resolve dynamic values from SpecExportData or active equipment.
 */
function resolveMappedValue(fieldKey: string, specData: SpecExportData, items: EquipmentItem[]): string {
  const firstItem = items[0];

  switch (fieldKey) {
    case 'title': return specData.title;
    case 'documentNo': return specData.documentNo;
    case 'version': return `Rev ${specData.version}`;
    case 'issueDate': return specData.issueDate;
    case 'issuerCompany': return specData.issuerCompany;
    case 'issuerAuthor': return specData.issuerAuthor;
    case 'approverName': return specData.approverName;
    case 'clientCompany': return specData.clientCompany;
    case 'inspectionStandard': return specData.inspectionStandard;
    case 'deliveryTerms': return specData.deliveryTerms;
    case 'warrantyPeriod': return specData.warrantyPeriod;
    case 'notes': return specData.notes;
    // Primary equipment specific fallbacks
    case 'equip_name': return firstItem ? firstItem.name : '';
    case 'equip_tag': return firstItem ? firstItem.tagNo : '';
    case 'equip_diameter': return firstItem ? (firstItem.diameter || '') : '';
    case 'equip_material': return firstItem ? (firstItem.material || '') : '';
    case 'equip_quantity': return firstItem ? `${firstItem.quantity} ${firstItem.unit || '台'}` : '';
    case 'equip_delivery': return firstItem ? firstItem.deliveryDate : '';
    default:
      // If user typed custom text or unknown key
      return fieldKey.startsWith('TEXT:') ? fieldKey.replace('TEXT:', '') : '';
  }
}

/**
 * Generates and downloads an Excel file.
 * If rawWorkbookBase64 is provided, it reads the original Excel template and updates exact cells (e.g. E30)
 * directly in place, preserving existing formulas, logos, borders, fonts, and print settings!
 */
export function exportEquipmentSpecToExcel(
  specData: SpecExportData,
  items: EquipmentItem[],
  template: SpecTemplate
) {
  // Case A: Customized Excel Template with Original Workbook Injected
  if (template.rawWorkbookBase64) {
    try {
      // Decode Base64 binary
      const binaryString = atob(template.rawWorkbookBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Read original workbook preserving structure and formulas
      const wb = XLSX.read(bytes, { type: 'array', cellStyles: true, cellNF: true, cellDates: true });
      const targetSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[targetSheetName];

      if (ws) {
        // 1. Inject Exact Single Cell Mappings (e.g. E30: notes, C3: title, etc.)
        if (template.cellMappings && template.cellMappings.length > 0) {
          for (const mapping of template.cellMappings) {
            if (mapping.cell && mapping.fieldKey) {
              const val = resolveMappedValue(mapping.fieldKey, specData, items);
              setCellValue(ws, mapping.cell, val);
            }
          }
        }

        // 2. Inject Individual Detail Field Mappings (機器名, 数量, 納期, 特記事項)
        if (template.fields && template.fields.length > 0) {
          const detailFields = template.fields.filter(f => f.group === 'detail');
          for (const f of detailFields) {
            const slots = [f.cell, f.cellSlot2, f.cellSlot3, f.cellSlot4];
            slots.forEach((addr, idx) => {
              const item = items[idx];
              if (!addr || !item) return;
              if (f.label.includes('機器名')) setCellValue(ws, addr, item.name);
              else if (f.label.includes('数量')) setCellValue(ws, addr, `${item.quantity} ${item.unit || '台'}`);
              else if (f.label.includes('納期')) setCellValue(ws, addr, item.deliveryDate || '-');
              else if (f.label.includes('特記')) setCellValue(ws, addr, item.notes || '');
            });
          }
        }

        // Generate download
        const filename = `${specData.documentNo || '仕様書'}_${specData.issueDate || 'draft'}.xlsx`;
        XLSX.writeFile(wb, filename);
        return;
      }
    } catch (e) {
      console.warn('Failed to inject into custom workbook, falling back to standard 3-sheet generator', e);
    }
  }

  // Case B: Standard Output (Default / Fallback)
  const wb = XLSX.utils.book_new();

  // Helper to format item specs
  const formatSpecs = (item: EquipmentItem): string => {
    if (item.specs && item.specs.length > 0) {
      return item.specs.map(s => `${s.name}: ${s.value}${s.unit ? ' ' + s.unit : ''}`).join(' / ');
    }
    const parts: string[] = [];
    if (item.diameter && item.diameter !== '-') parts.push(`口径: ${item.diameter}`);
    if (item.material && item.material !== '-') parts.push(`材質: ${item.material}`);
    return parts.join(' / ') || '-';
  };

  // Sheet 1: 仕様書本紙
  const summaryRows: (string | number)[][] = [
    ['【 機 器 調 達 仕 様 書 】', '', '', '', '', ''],
    ['文書管理番号:', specData.documentNo, '', '改訂番号 (Rev):', `Rev ${specData.version}`, ''],
    ['発行年月日:', specData.issueDate, '', '適用テンプレート:', template.name, ''],
    ['仕様書標題:', specData.title, '', '作成担当者:', specData.issuerAuthor, ''],
    ['発行元会社:', specData.issuerCompany, '', '承認責任者:', specData.approverName, ''],
    ['納入先・発注先:', specData.clientCompany, '', '', '', ''],
    ['', '', '', '', '', ''],
    ['【1. 対象機器・調達仕様一覧】', '', '', '', '', ''],
    ['機器番号', '機器名', '機器仕様 (口径・出力・材質等)', '数量', '納入時期', '特記事項'],
  ];

  for (const item of items) {
    summaryRows.push([
      item.tagNo || '-',
      item.name,
      formatSpecs(item),
      `${item.quantity} ${item.unit || '台'}`,
      item.deliveryDate || '-',
      item.notes || '-'
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
    { wch: 16 },
    { wch: 30 },
    { wch: 38 },
    { wch: 14 },
    { wch: 16 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, '仕様書本紙');

  // Sheet 2: 機器明細一覧
  const itemHeader = ['機器番号', '機器名', '仕様項目 (口径・出力・材質等)', '数量', '単位', '納入時期', '納入場所', '特記事項'];
  const itemDataRows = items.map(item => [
    item.tagNo || '',
    item.name,
    formatSpecs(item),
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
    { wch: 36 },
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
    { wch: 24 },
    { wch: 36 }
  ];
  XLSX.utils.book_append_sheet(wb, wsItems, '機器明細一覧');

  const filename = `${specData.documentNo || '仕様書'}_${specData.issueDate || 'draft'}.xlsx`;
  XLSX.writeFile(wb, filename);
}
