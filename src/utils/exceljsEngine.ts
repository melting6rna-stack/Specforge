import ExcelJS from 'exceljs';
import { SpecTemplate, EquipmentItem, SpecFieldMapping, SpecMappingAssetFile } from '../types';

/**
 * Creates a professional fallback master Excel template if none was uploaded.
 * Designed with standard civil/plant engineering styles: title header, metadata grid,
 * check requirements box, equipment list table, and remarks section.
 */
export async function createDefaultMasterWorkbook(template: SpecTemplate): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SpecForge Specification System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('仕様書', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Set column widths
  worksheet.columns = [
    { width: 5 },   // A: Margin
    { width: 14 },  // B: No / Tag
    { width: 28 },  // C: 項目 / 機器名
    { width: 16 },  // D: 仕様 / 口径
    { width: 14 },  // E: 材質 / 設定値
    { width: 10 },  // F: 数量
    { width: 14 },  // G: 納期 / 単位
    { width: 26 },  // H: 備考 / 特記事項
  ];

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const borderDark: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF334155' } },
    left: { style: 'thin', color: { argb: 'FF334155' } },
    bottom: { style: 'thin', color: { argb: 'FF334155' } },
    right: { style: 'thin', color: { argb: 'FF334155' } }
  };

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }
  };

  // Row 2: Main Document Header Banner
  worksheet.mergeCells('B2:H2');
  const titleCell = worksheet.getCell('B2');
  titleCell.value = `【 ${template.name} 】`;
  titleCell.font = { name: 'Meiryo UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 36;

  // Row 4: Document Metadata
  worksheet.getCell('B4').value = '仕様書番号:';
  worksheet.getCell('B4').font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('C4').value = 'SPEC-2026-001';
  worksheet.getCell('C4').font = { name: 'Meiryo UI', size: 10, bold: true };

  worksheet.getCell('F4').value = '発行日:';
  worksheet.getCell('F4').font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('G4').value = new Date().toISOString().slice(0, 10);
  worksheet.getCell('G4').font = { name: 'Meiryo UI', size: 9 };

  // Row 5: Construction Name & Client
  worksheet.getCell('B5').value = '工事・件名:';
  worksheet.getCell('B5').font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF64748B' } };
  worksheet.mergeCells('C5:E5');
  worksheet.getCell('C5').value = '令和8年度 設備更新工事';
  worksheet.getCell('C5').font = { name: 'Meiryo UI', size: 10, bold: true };

  worksheet.getCell('F5').value = '発行元:';
  worksheet.getCell('F5').font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('G5').value = '設計部';
  worksheet.getCell('G5').font = { name: 'Meiryo UI', size: 9 };

  // Row 6: Client Number & Client Name
  worksheet.getCell('B6').value = '客先番号:';
  worksheet.getCell('B6').font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF64748B' } };
  worksheet.mergeCells('C6:E6');
  worksheet.getCell('C6').value = '【MC】-【09821】';
  worksheet.getCell('C6').font = { name: 'Meiryo UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };

  worksheet.getCell('F6').value = '発注元:';
  worksheet.getCell('F6').font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('G6').value = '〇〇化学工業株式会社';
  worksheet.getCell('G6').font = { name: 'Meiryo UI', size: 9 };

  // Row 7: Section 1 Header
  worksheet.mergeCells('B7:H7');
  const sec1 = worksheet.getCell('B7');
  sec1.value = '1. 適用要件・指定基準 (チェック項目 & 選択条件)';
  sec1.font = { name: 'Meiryo UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  sec1.fill = headerFill;
  worksheet.getRow(7).height = 24;

  // Rows 8-11: Form Fields / Checkboxes area
  const reqLabels = [
    { cell: 'B8', val: '耐圧・漏れ検査:', valCell: 'C8', defaultVal: '☑ 要 (JIS準拠耐圧試験成績書を提出)' },
    { cell: 'F8', val: 'ミルシート提出:', valCell: 'G8', defaultVal: '☑ 要 (材料検査証明書)' },
    { cell: 'B9', val: '塗装仕様:', valCell: 'C9', defaultVal: 'エポキシ樹脂系防錆塗装 (指定色)' },
    { cell: 'F9', val: '禁油脱脂処理:', valCell: 'G9', defaultVal: '☐ 不要' },
    { cell: 'B10', val: '受渡・引渡条件:', valCell: 'C10', defaultVal: '指定プラント受入口車上渡し' },
    { cell: 'F10', val: '立会検査要否:', valCell: 'G10', defaultVal: '☐ 不要' }
  ];

  for (const item of reqLabels) {
    const lbl = worksheet.getCell(item.cell);
    lbl.value = item.val;
    lbl.font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF475569' } };
    const val = worksheet.getCell(item.valCell);
    val.value = item.defaultVal;
    val.font = { name: 'Meiryo UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  }

  // Row 13: Section 2 Header (Equipment Table)
  worksheet.mergeCells('B13:H13');
  const sec2 = worksheet.getCell('B13');
  sec2.value = '2. 対象機器・調達品目明細';
  sec2.font = { name: 'Meiryo UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  sec2.fill = headerFill;
  worksheet.getRow(13).height = 24;

  // Row 14: Table Column Headers
  const tableHeaders = [
    { col: 'B', title: '機器番号' },
    { col: 'C', title: '機器名' },
    { col: 'D', title: '口径・仕様' },
    { col: 'E', title: '材質' },
    { col: 'F', title: '数量' },
    { col: 'G', title: '納入時期' },
    { col: 'H', title: '特記事項' },
  ];

  worksheet.getRow(14).height = 22;
  for (const h of tableHeaders) {
    const c = worksheet.getCell(`${h.col}14`);
    c.value = h.title;
    c.font = { name: 'Meiryo UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    c.alignment = { vertical: 'middle', horizontal: h.col === 'F' ? 'right' : 'center' };
    c.border = borderDark;
  }

  // Sample data row at row 15
  const sampleRow = [
    { col: 'B', val: 'V-101' },
    { col: 'C', val: 'ボール弁ユニット' },
    { col: 'D', val: '50A 10K' },
    { col: 'E', val: 'SCS13A' },
    { col: 'F', val: 4 },
    { col: 'G', val: '2026/05/15' },
    { col: 'H', val: '禁油脱脂証明書添付' }
  ];
  worksheet.getRow(15).height = 20;
  for (const cellInfo of sampleRow) {
    const c = worksheet.getCell(`${cellInfo.col}15`);
    c.value = cellInfo.val;
    c.font = { name: 'Meiryo UI', size: 9 };
    c.border = borderThin;
    c.alignment = { vertical: 'middle', horizontal: cellInfo.col === 'F' ? 'right' : 'left' };
  }

  // Section 3: Special Notes (e.g. Row 25 - E30 area)
  worksheet.mergeCells('B22:H22');
  const sec3 = worksheet.getCell('B22');
  sec3.value = '3. 特記事項・技術指示事項';
  sec3.font = { name: 'Meiryo UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  sec3.fill = headerFill;

  worksheet.mergeCells('B23:H28');
  const notesArea = worksheet.getCell('B23');
  notesArea.value = '・指定の検査成績書およびミルシートは納品書に同封の上、1部提出すること。\n・製品銘板には必ず機器番号（タグNo.）を明記のこと。';
  notesArea.font = { name: 'Meiryo UI', size: 9 };
  notesArea.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
  notesArea.border = borderThin;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/**
 * Fills an Excel template with exact values using ExcelJS.
 * Operates in memory on an ArrayBuffer copy (protects the original master file).
 * Injects single fields (text, select, checkbox) into exact cell addresses (e.g. C4, E12, E30),
 * and injects equipment table detail rows starting at startRow.
 */
export async function fillSpecificationExcel(
  template: SpecTemplate,
  formValues: Record<string, any>,
  items: EquipmentItem[],
  docInfo: Record<string, string>
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();

  // Load master template (either uploaded Base64 or newly generated fallback)
  if (template.rawWorkbookBase64 || template.masterWorkbookBase64) {
    const base64 = template.rawWorkbookBase64 || template.masterWorkbookBase64!;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Load buffer copy into ExcelJS
    await workbook.xlsx.load(bytes.buffer.slice(0));
  } else {
    // Generate default styled master workbook
    const defaultBuffer = await createDefaultMasterWorkbook(template);
    await workbook.xlsx.load(defaultBuffer);
  }

  const targetSheetName = template.tableMapping?.targetSheetName;
  const worksheet = targetSheetName 
    ? (workbook.getWorksheet(targetSheetName) || workbook.worksheets[0]) 
    : workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('対象のワークシートが見つかりません。');
  }

  // 1. INJECT SPEC FIELD MAPPINGS (Form inputs: text, select, checkbox, date, textarea)
  const fields: SpecFieldMapping[] = template.fields || [];

  for (const field of fields) {
    if (!field.cell) continue;
    const cellAddr = field.cell.trim().toUpperCase();
    const cell = worksheet.getCell(cellAddr);

    // Resolve value
    const rawVal = formValues[field.id];

    if (field.type === 'checkbox') {
      const isChecked = Boolean(rawVal);
      const outputText = isChecked 
        ? (field.checkboxConfig?.checkedValue || '☑ 要') 
        : (field.checkboxConfig?.uncheckedValue || '☐ 不要');
      cell.value = outputText;
    } else if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      cell.value = String(rawVal);
    } else if (field.defaultValue !== undefined && field.defaultValue !== '') {
      cell.value = String(field.defaultValue);
    }
  }

  // 2. INJECT LEGACY / BASELINE DOCUMENT CELL MAPPINGS (e.g. E30: notes, C3: title, etc.)
  if (template.cellMappings && template.cellMappings.length > 0) {
    for (const cm of template.cellMappings) {
      if (!cm.cell || !cm.fieldKey) continue;
      const cell = worksheet.getCell(cm.cell.trim().toUpperCase());
      const val = docInfo[cm.fieldKey];
      if (val !== undefined && val !== null) {
        cell.value = val;
      }
    }
  }

  // 3. INJECT EQUIPMENT TABLE DETAIL ROWS
  if (template.tableMapping) {
    const tMap = template.tableMapping;
    const startRow = tMap.startRow || 14;

    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    items.forEach((item, index) => {
      const rowNum = startRow + index;
      const row = worksheet.getRow(rowNum);
      if (!row.height || row.height < 20) {
        row.height = 20;
      }

      // Format specs summary string (e.g. 50A, 7.5kW, etc.)
      const specSummary = item.specs && item.specs.length > 0
        ? item.specs.map(s => `${s.name}: ${s.value}${s.unit ? ' ' + s.unit : ''}`).join(', ')
        : (item.diameter && item.diameter !== '-' ? `口径: ${item.diameter}` : '-');

      if (tMap.tagNoCol) {
        const c = worksheet.getCell(`${tMap.tagNoCol.toUpperCase()}${rowNum}`);
        c.value = item.tagNo || '-';
        c.border = borderThin;
        c.font = { name: 'Meiryo UI', size: 9 };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      if (tMap.nameCol) {
        const c = worksheet.getCell(`${tMap.nameCol.toUpperCase()}${rowNum}`);
        c.value = item.name;
        c.border = borderThin;
        c.font = { name: 'Meiryo UI', size: 9, bold: true };
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      if (tMap.diameterCol) {
        const c = worksheet.getCell(`${tMap.diameterCol.toUpperCase()}${rowNum}`);
        c.value = specSummary;
        c.border = borderThin;
        c.font = { name: 'Meiryo UI', size: 9 };
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      if (tMap.materialCol) {
        const c = worksheet.getCell(`${tMap.materialCol.toUpperCase()}${rowNum}`);
        c.value = item.material || '-';
        c.border = borderThin;
        c.font = { name: 'Meiryo UI', size: 9 };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      if (tMap.quantityCol) {
        const c = worksheet.getCell(`${tMap.quantityCol.toUpperCase()}${rowNum}`);
        c.value = `${item.quantity} ${item.unit || '台'}`;
        c.border = borderThin;
        c.font = { name: 'Meiryo UI', size: 9, bold: true };
        c.alignment = { vertical: 'middle', horizontal: 'right' };
      }

      if (tMap.deliveryDateCol) {
        const c = worksheet.getCell(`${tMap.deliveryDateCol.toUpperCase()}${rowNum}`);
        c.value = item.deliveryDate || '-';
        c.border = borderThin;
        c.font = { name: 'Meiryo UI', size: 9 };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      if (tMap.notesCol) {
        const c = worksheet.getCell(`${tMap.notesCol.toUpperCase()}${rowNum}`);
        c.value = item.notes || '-';
        c.border = borderThin;
        c.font = { name: 'Meiryo UI', size: 9 };
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }

  // Export buffer
  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(outBuffer as ArrayBuffer);
}

/**
 * Direct file download trigger for filled specification Excel
 */
export async function downloadSpecificationExcel(
  template: SpecTemplate,
  formValues: Record<string, any>,
  items: EquipmentItem[],
  docInfo: Record<string, string>,
  customFileName?: string
): Promise<void> {
  const bytes = await fillSpecificationExcel(template, formValues, items, docInfo);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const fileName = customFileName || `${template.name.replace(/[\s/\\?%*:|"<>]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports mapping definition asset as a JSON file for sharing / distribution.
 */
export function exportMappingAssetAsJson(template: SpecTemplate): void {
  const asset: SpecMappingAssetFile = {
    version: '1.0',
    schemaType: 'specforge-mapping-asset',
    exportedAt: new Date().toISOString(),
    templateId: template.id,
    templateName: template.name,
    templateCode: template.code,
    description: template.description,
    targetCategoryName: template.targetCategoryName,
    fields: template.fields || [],
    tableMapping: template.tableMapping,
    masterFileName: template.masterFileName || template.originalFileName,
    masterWorkbookBase64: template.masterWorkbookBase64 || template.rawWorkbookBase64
  };

  const jsonStr = JSON.stringify(asset, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MappingAsset_${template.code}_${new Date().toISOString().slice(0, 10)}.specmap.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and imports a mapping asset JSON file.
 */
export function importMappingAssetFromJson(jsonString: string): SpecMappingAssetFile {
  const parsed = JSON.parse(jsonString);
  if (!parsed.schemaType || parsed.schemaType !== 'specforge-mapping-asset') {
    // Check if it's a general spec template
    if (!parsed.templateName && !parsed.name) {
      throw new Error('有効なSpecForgeマッピング定義ファイル（.specmap.json）ではありません。');
    }
  }
  return {
    version: '1.0',
    schemaType: 'specforge-mapping-asset',
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    templateId: parsed.templateId || parsed.id || `tpl-${Date.now()}`,
    templateName: parsed.templateName || parsed.name || 'インポート仕様書',
    templateCode: parsed.templateCode || parsed.code || 'SPEC-IMPORTED',
    description: parsed.description || '',
    targetCategoryName: parsed.targetCategoryName,
    fields: parsed.fields || [],
    tableMapping: parsed.tableMapping,
    masterFileName: parsed.masterFileName || parsed.originalFileName,
    masterWorkbookBase64: parsed.masterWorkbookBase64 || parsed.rawWorkbookBase64
  };
}

export interface RenderedCellData {
  address: string;
  col: string;
  row: number;
  value: string;
  isBold?: boolean;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  bgColor?: string;
  hasBorder?: boolean;
}

export interface RenderedSheetGrid {
  sheetName: string;
  columns: { colLetter: string; width: number }[];
  rows: {
    rowNumber: number;
    cells: RenderedCellData[];
  }[];
  totalCells: number;
  benchmarkMs: number;
}

/**
 * Real-time In-Memory Excel Renderer:
 * Evaluates template updates in memory using ExcelJS on every keystroke/change,
 * analyzes cell matrices, styles, and values, and returns grid representation with benchmark time.
 */
export async function renderSpecificationExcelGrid(
  template: SpecTemplate,
  formValues: Record<string, any>,
  items: EquipmentItem[],
  docInfo: Record<string, string>,
  maxRows: number = 28
): Promise<RenderedSheetGrid> {
  const startTime = performance.now();

  const workbook = new ExcelJS.Workbook();
  if (template.rawWorkbookBase64 || template.masterWorkbookBase64) {
    const base64 = template.rawWorkbookBase64 || template.masterWorkbookBase64!;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    await workbook.xlsx.load(bytes.buffer.slice(0));
  } else {
    const defaultBuffer = await createDefaultMasterWorkbook(template);
    await workbook.xlsx.load(defaultBuffer);
  }

  const targetSheetName = template.tableMapping?.targetSheetName;
  const worksheet = targetSheetName 
    ? (workbook.getWorksheet(targetSheetName) || workbook.worksheets[0]) 
    : workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('ワークシートが見つかりません。');
  }

  // 1. Inject Fields
  const fields = template.fields || [];
  for (const field of fields) {
    if (!field.cell) continue;
    const cell = worksheet.getCell(field.cell.trim().toUpperCase());
    const rawVal = formValues[field.id];
    if (field.type === 'checkbox') {
      const isChecked = Boolean(rawVal);
      cell.value = isChecked 
        ? (field.checkboxConfig?.checkedValue || '☑ 要') 
        : (field.checkboxConfig?.uncheckedValue || '☐ 不要');
    } else if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
      cell.value = String(rawVal);
    } else if (field.defaultValue !== undefined && field.defaultValue !== '') {
      cell.value = String(field.defaultValue);
    }
  }

  // 2. Inject Legacy Mappings
  if (template.cellMappings) {
    for (const cm of template.cellMappings) {
      if (!cm.cell || !cm.fieldKey) continue;
      const cell = worksheet.getCell(cm.cell.trim().toUpperCase());
      const val = docInfo[cm.fieldKey];
      if (val !== undefined && val !== null) {
        cell.value = val;
      }
    }
  }

  // 3. Inject Equipment Table
  if (template.tableMapping) {
    const tMap = template.tableMapping;
    const startRow = tMap.startRow || 15;
    items.forEach((item, index) => {
      const rowNum = startRow + index;
      const specSummary = item.specs && item.specs.length > 0
        ? item.specs.map(s => `${s.name}: ${s.value}${s.unit ? ' ' + s.unit : ''}`).join(', ')
        : (item.diameter && item.diameter !== '-' ? `口径: ${item.diameter}` : '-');

      if (tMap.tagNoCol) worksheet.getCell(`${tMap.tagNoCol.toUpperCase()}${rowNum}`).value = item.tagNo || '-';
      if (tMap.nameCol) worksheet.getCell(`${tMap.nameCol.toUpperCase()}${rowNum}`).value = item.name;
      if (tMap.diameterCol) worksheet.getCell(`${tMap.diameterCol.toUpperCase()}${rowNum}`).value = specSummary;
      if (tMap.materialCol) worksheet.getCell(`${tMap.materialCol.toUpperCase()}${rowNum}`).value = item.material || '-';
      if (tMap.quantityCol) worksheet.getCell(`${tMap.quantityCol.toUpperCase()}${rowNum}`).value = `${item.quantity} ${item.unit || '台'}`;
      if (tMap.deliveryDateCol) worksheet.getCell(`${tMap.deliveryDateCol.toUpperCase()}${rowNum}`).value = item.deliveryDate || '-';
      if (tMap.notesCol) worksheet.getCell(`${tMap.notesCol.toUpperCase()}${rowNum}`).value = item.notes || '-';
    });
  }

  // Build grid data for browser Excel viewer (Columns A to H)
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const colWidths = [36, 110, 190, 120, 100, 75, 110, 190];
  const columns = colLetters.map((c, i) => ({ colLetter: c, width: colWidths[i] }));

  const rows: { rowNumber: number; cells: RenderedCellData[] }[] = [];
  let cellCount = 0;

  for (let r = 1; r <= maxRows; r++) {
    const rowCells: RenderedCellData[] = [];
    for (const c of colLetters) {
      const addr = `${c}${r}`;
      const cell = worksheet.getCell(addr);
      cellCount++;

      let displayVal = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object') {
          if ('result' in cell.value && cell.value.result !== undefined) {
            displayVal = String(cell.value.result);
          } else if ('text' in cell.value && cell.value.text !== undefined) {
            displayVal = String(cell.value.text);
          } else if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
            displayVal = (cell.value as any).richText.map((t: any) => t.text).join('');
          } else {
            displayVal = String(cell.value);
          }
        } else {
          displayVal = String(cell.value);
        }
      }

      // Extract colors
      let bgColor: string | undefined;
      const fill = cell.fill as any;
      if (fill && fill.fgColor && fill.fgColor.argb) {
        const argb = String(fill.fgColor.argb);
        if (argb.length === 8) {
          bgColor = `#${argb.slice(2)}`;
        }
      }

      const isBold = Boolean(cell.font && cell.font.bold);
      const fontSize = cell.font && cell.font.size ? cell.font.size : 10;
      const align = (cell.alignment && cell.alignment.horizontal as any) || (typeof cell.value === 'number' ? 'right' : 'left');
      const hasBorder = Boolean(cell.border && (cell.border.top || cell.border.bottom || cell.border.left || cell.border.right));

      rowCells.push({
        address: addr,
        col: c,
        row: r,
        value: displayVal,
        isBold,
        fontSize,
        align,
        bgColor,
        hasBorder
      });
    }
    rows.push({ rowNumber: r, cells: rowCells });
  }

  const benchmarkMs = Math.round((performance.now() - startTime) * 10) / 10;

  return {
    sheetName: worksheet.name,
    columns,
    rows,
    totalCells: cellCount,
    benchmarkMs
  };
}
