import * as XLSX from 'xlsx';
import { SpecTemplate, EquipmentItem } from '../types';

export interface ParsedTemplateResult {
  template: SpecTemplate;
  detectedColumns: string[];
  sampleRowsCount: number;
  sheetNames: string[];
}

/**
 * Parses an Excel template file completely client-side in the browser (100% offline).
 * Extracts headers, columns, and structural fields.
 */
export async function parseExcelTemplateFile(
  file: File
): Promise<ParsedTemplateResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetNames = wb.SheetNames;
  const firstSheet = wb.Sheets[sheetNames[0]];

  if (!firstSheet) {
    throw new Error('Excelファイル内にシートが見つかりませんでした。');
  }

  // Convert to 2D array of rows
  const rawRows: (string | number)[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  // Locate header row containing recognizable column names
  let headerRowIndex = -1;
  let detectedCols: string[] = [];

  for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
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

  const template: SpecTemplate = {
    id: `tpl-excel-${Date.now()}`,
    code: `TPL-EXCEL-${Math.floor(100 + Math.random() * 900)}`,
    name: baseName || '取込Excel仕様書テンプレート',
    description: `アップロードされたExcelファイル(${file.name})から生成された仕様書テンプレート`,
    columns: detectedCols,
    inspectionStandard: 'Excelテンプレート所定の受入検査基準およびミルシート提出要件に準拠する。',
    warrantyPeriod: '引渡完了日より1年間。',
    deliveryTerms: '指定工場受入口納入。',
    notesTemplate: '・仕様に関する特記事項および指示事項を記載。',
    sourceType: 'custom_excel',
    originalFileName: file.name,
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
 */
export async function parseEquipmentExcel(
  file: File,
  projectId: string,
  categoryId: string
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
    if (row.some(c => c.includes('機器') || c.includes('品名') || c.includes('数量'))) {
      headerIndex = i;
      break;
    }
  }

  const headers = (rawRows[headerIndex] || []).map((c: any) => String(c || '').trim());
  const items: EquipmentItem[] = [];
  const now = new Date().toISOString().slice(0, 10);

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = String(row[idx] || '').trim();
    });

    const name = rowObj['機器名'] || rowObj['品名'] || rowObj['名称'] || String(row[1] || `機器-${i}`);
    if (!name.trim()) continue;

    const tagNo = rowObj['機器番号'] || rowObj['タグ'] || rowObj['タグNo'] || String(row[0] || `EQ-${i}`);
    const diameter = rowObj['口径'] || rowObj['サイズ'] || rowObj['呼び径'] || String(row[2] || '50A');
    const material = rowObj['材質'] || rowObj['材料'] || String(row[3] || 'SUS304');
    const rawQty = rowObj['数量'] || String(row[4] || '1');
    const quantity = parseInt(String(rawQty).replace(/[^0-9]/g, ''), 10) || 1;
    const unit = rowObj['単位'] || '台';
    const deliveryDate = rowObj['納期'] || rowObj['希望納期'] || now;
    const notes = rowObj['備考'] || rowObj['特記事項'] || '';

    items.push({
      id: `eq-imp-${Date.now()}-${i}`,
      projectId,
      tagNo,
      name,
      quantity,
      unit,
      diameter,
      material,
      deliveryDate,
      categoryId,
      deliveryLocation: '指定納入場所',
      notes,
      history: [
        {
          id: `hist-imp-${i}`,
          itemId: `eq-imp-${Date.now()}-${i}`,
          timestamp: new Date().toLocaleString('ja-JP', { hour12: false }),
          author: 'Excel取込',
          field: 'all',
          fieldLabel: '初期取込',
          oldValue: '-',
          newValue: 'Excelファイルよりインポート',
          reason: '発注資料ファイルからの機器データ自動取込'
        }
      ],
      createdAt: now,
      updatedAt: now
    });
  }

  return items;
}
