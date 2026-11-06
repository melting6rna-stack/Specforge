import * as XLSX from 'xlsx';
import { SpecTemplate, EquipmentItem, EquipmentSpecParam } from '../types';

export interface ParsedTemplateResult {
  template: SpecTemplate;
  detectedColumns: string[];
  sampleRowsCount: number;
  sheetNames: string[];
}

/**
 * Converts ArrayBuffer to Base64 safely.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Parses an Excel template file completely client-side in the browser (100% offline).
 * Extracts headers, columns, structural fields, and preserves original workbook Base64.
 */
export async function parseExcelTemplateFile(
  file: File
): Promise<ParsedTemplateResult> {
  const buffer = await file.arrayBuffer();
  const rawBase64 = arrayBufferToBase64(buffer);

  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetNames = wb.SheetNames;
  const firstSheetName = sheetNames[0];
  const firstSheet = wb.Sheets[firstSheetName];

  if (!firstSheet) {
    throw new Error('Excelファイル内にシートが見つかりませんでした。');
  }

  // Convert to 2D array of rows
  const rawRows: (string | number)[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  // Locate header row containing recognizable column names
  let headerRowIndex = -1;
  let detectedCols: string[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    const rowStr = row.map(c => String(c || '').trim());
    const matches = rowStr.filter(c => 
      c.match(/機器|品名|品目|名称|口径|サイズ|材質|材料|数量|個数|納期|期日|タグ|備考|特記/)
    );

    if (matches.length >= 2) {
      headerRowIndex = r;
      detectedCols = rowStr.filter(c => c.length > 0);
      break;
    }
  }

  // Fallback columns if header row wasn't automatically found
  if (detectedCols.length === 0) {
    detectedCols = ['機器番号', '機器名', '口径', '材質', '数量', '納期', '備考'];
  }

  const sampleRowsCount = headerRowIndex >= 0 ? Math.max(0, rawRows.length - headerRowIndex - 1) : rawRows.length;
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const startRowNumber = headerRowIndex >= 0 ? headerRowIndex + 2 : 12;

  // Auto detect columns A, B, C, D...
  const colLetter = (idx: number) => String.fromCharCode(65 + idx);

  const template: SpecTemplate = {
    id: `tpl-excel-${Date.now()}`,
    code: `TPL-EXCEL-${Math.floor(100 + Math.random() * 900)}`,
    name: baseName || '取込Excel仕様書テンプレート',
    description: `アップロードされたExcelファイル(${file.name})の原本書式を保持したセル指定テンプレート`,
    columns: detectedCols,
    inspectionStandard: 'Excelテンプレート所定の受入検査基準およびミルシート提出要件に準拠する。',
    warrantyPeriod: '引渡完了日より1年間。',
    deliveryTerms: '指定工場受入口納入。',
    notesTemplate: '・仕様に関する特記事項および指示事項を記載。',
    sourceType: 'custom_excel',
    originalFileName: file.name,
    rawWorkbookBase64: rawBase64, // Store original raw workbook for 100% fidelity injection
    cellMappings: [
      { id: 'cm-title', label: '仕様書標題', cell: 'C3', fieldKey: 'title', description: '仕様書メインタイトル' },
      { id: 'cm-docno', label: '文書番号', cell: 'H2', fieldKey: 'documentNo', description: '管理番号' },
      { id: 'cm-date', label: '発行日', cell: 'H3', fieldKey: 'issueDate', description: '発行年月日' },
      { id: 'cm-notes', label: '特記事項 (例: E30)', cell: 'E30', fieldKey: 'notes', description: '指定セルへの個別指示代入' }
    ],
    tableMapping: {
      startRow: startRowNumber,
      targetSheetName: firstSheetName,
      tagNoCol: 'A',
      nameCol: 'B',
      diameterCol: 'C',
      materialCol: 'D',
      quantityCol: 'E',
      deliveryDateCol: 'F',
      notesCol: 'G'
    },
    updatedAt: new Date().toISOString().slice(0, 10)
  };

  return {
    template,
    detectedColumns: detectedCols,
    sampleRowsCount,
    sheetNames
  };
}

/**
 * Client-side offline parser for order lists in Excel / CSV.
 * Extracts: 機器名, 数量, 口径, 材質, 納期, タグNo, 備考.
 * 機器番号が空欄の場合は、あらかじめの機器番号（EQ等）に「-001」形式の3桁連番を自動付与します。
 */
export async function parseEquipmentExcel(
  file: File,
  projectId: string,
  categoryId: string,
  projectCode?: string,
  existingItems?: EquipmentItem[]
): Promise<EquipmentItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rawRows.length < 2) return [];

  // Find header
  let headerIndex = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = (rawRows[i] || []).map((c: any) => String(c || ''));
    if (row.some(c => c.includes('機器') || c.includes('品名') || c.includes('名称') || c.includes('数量'))) {
      headerIndex = i;
      break;
    }
  }

  const headers = (rawRows[headerIndex] || []).map((c: any) => String(c || '').trim());
  const items: EquipmentItem[] = [];
  const now = new Date().toISOString().slice(0, 10);

  // Set of all used tag numbers to guarantee uniqueness
  const usedTags = new Set<string>((existingItems || []).map(it => it.tagNo).filter(Boolean));

  // Determine base prefix for auto numbering:
  // Default equipment base prefix is "EQ" (e.g. EQ-001, EQ-002...)
  const defaultBasePrefix = projectCode && !projectCode.startsWith('PRJ-') ? projectCode : 'EQ';
  let autoSeq = 1;

  const getNextAutoTag = (base: string = defaultBasePrefix): string => {
    while (true) {
      const candidate = `${base}-${String(autoSeq).padStart(3, '0')}`;
      autoSeq++;
      if (!usedTags.has(candidate)) {
        usedTags.add(candidate);
        return candidate;
      }
    }
  };

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = String(row[idx] || '').trim();
    });

    const name = rowObj['機器名'] || rowObj['品名'] || rowObj['名称'] || String(row[1] || `機器-${i}`);
    if (!name.trim()) continue;

    // Check if tag number is explicitly supplied in Excel
    let rawTag = rowObj['機器番号'] || rowObj['タグ'] || rowObj['タグNo'] || rowObj['タグ番号'] || rowObj['No'] || rowObj['No.'] || rowObj['番号'] || '';
    rawTag = rawTag.trim();

    let tagNo = '';
    if (rawTag && rawTag !== '-' && rawTag !== '未定') {
      // If it's just a base prefix without numbers (e.g. "P" or "V"), append -001
      if (/^[a-zA-Z\u3040-\u30FF\u4E00-\u9FAF]+[-_]?$/.test(rawTag)) {
        const cleanBase = rawTag.replace(/[-_]$/, '');
        tagNo = getNextAutoTag(cleanBase);
      } else {
        tagNo = rawTag;
        usedTags.add(tagNo);
      }
    } else {
      // 機器番号が振られていないときは、あらかじめの機器番号（EQ等）に「-001」形式で連番を自動付与
      tagNo = getNextAutoTag(defaultBasePrefix);
    }

    const diameter = rowObj['口径'] || rowObj['サイズ'] || rowObj['呼び径'] || String(row[2] || '');
    const material = rowObj['材質'] || rowObj['材料'] || String(row[3] || '');
    const rawQty = rowObj['数量'] || String(row[4] || '1');
    const quantity = parseInt(String(rawQty).replace(/[^0-9]/g, ''), 10) || 1;
    const unit = rowObj['単位'] || '台';
    const deliveryDate = rowObj['納期'] || rowObj['希望納期'] || rowObj['納入時期'] || '';
    const notes = rowObj['備考'] || rowObj['特記事項'] || '';

    // Build specs array with diameter and material
    const specs: EquipmentSpecParam[] = [];
    if (diameter && diameter !== '-') {
      specs.push({
        id: `sp-imp-${i}-dia`,
        name: '口径',
        value: diameter,
        unit: ''
      });
    }
    if (material && material !== '-') {
      specs.push({
        id: `sp-imp-${i}-mat`,
        name: '材質',
        value: material,
        unit: ''
      });
    }

    items.push({
      id: `eq-imp-${Date.now()}-${i}`,
      projectId,
      tagNo,
      name,
      quantity,
      unit,
      diameter: diameter || '-',
      material: material || '-',
      deliveryDate,
      categoryId,
      deliveryLocation: '指定納入場所',
      notes,
      specs,
      history: [
        {
          id: `hist-imp-${i}`,
          itemId: `eq-imp-${Date.now()}-${i}`,
          timestamp: new Date().toLocaleString('ja-JP', { hour12: false }),
          author: 'Excel取込',
          field: 'all',
          fieldLabel: '初期取込',
          oldValue: '-',
          newValue: `Excelファイルよりインポート (機器番号: ${tagNo})`,
          reason: '発注資料ファイルからの機器データ自動取込'
        }
      ],
      createdAt: now,
      updatedAt: now
    });
  }

  return items;
}
