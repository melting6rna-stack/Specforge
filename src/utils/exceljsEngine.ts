import ExcelJS from 'exceljs';
import { SpecTemplate, EquipmentItem, SpecFieldMapping, SpecMappingAssetFile } from '../types';
import { normalizeSpecTemplate } from './templateUtils';

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

  // Row 3: Order No.
  worksheet.getCell('B3').value = 'オーダーNo.:';
  worksheet.getCell('B3').font = { name: 'Meiryo UI', size: 9, color: { argb: 'FF64748B' } };
  worksheet.getCell('C3').value = '202500444';
  worksheet.getCell('C3').font = { name: 'Meiryo UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };

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

  // Styled empty equipment rows (rows 15-18) ready for individual cell mapping
  const rowCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
  for (let r = 15; r <= 18; r++) {
    worksheet.getRow(r).height = 20;
    for (const col of rowCols) {
      const c = worksheet.getCell(`${col}${r}`);
      c.value = '';
      c.font = { name: 'Meiryo UI', size: 9 };
      c.border = borderThin;
      c.alignment = { vertical: 'middle', horizontal: col === 'F' ? 'right' : 'left' };
    }
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
  docInfo: Record<string, string>,
  cellOverrides?: Record<string, string>,
  customColWidths?: Record<string, number>
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

  const normalizedTpl = normalizeSpecTemplate(template);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('対象のワークシートが見つかりません。');
  }

  // Helper to find spec/detail value from an item by label
  const getItemValByLabel = (it: EquipmentItem | undefined, label: string) => {
    if (!it) return '';
    const clean = label.toLowerCase();
    if (clean.includes('機器番号') || clean.includes('tag')) return it.tagNo || '';
    if (clean.includes('機器名') || clean.includes('名称')) return it.name || '';
    if (clean.includes('数量')) return `${it.quantity} ${it.unit || '台'}`;
    if (clean.includes('納期')) return it.deliveryDate || '';
    if (clean.includes('特記') || clean.includes('備考')) return it.notes || '';
    if (clean.includes('口径') && it.diameter && it.diameter !== '-') return it.diameter;
    if (clean.includes('材質') && it.material && it.material !== '-') return it.material;
    if (it.specs && it.specs.length > 0) {
      for (const sp of it.specs) {
        if (clean.includes(sp.name.toLowerCase()) || sp.name.toLowerCase().includes(clean)) {
          return `${sp.value}${sp.unit ? ' ' + sp.unit : ''}`;
        }
      }
    }
    return '';
  };

  // 1. INJECT SPEC & DETAIL FIELD MAPPINGS (Individual 1〜4 slot cell mappings)
  const fields: SpecFieldMapping[] = normalizedTpl.fields || [];

  for (const field of fields) {
    if (field.cell && field.cell.trim()) {
      const cellAddr = field.cell.trim().toUpperCase();
      const cell = worksheet.getCell(cellAddr);
      const rawVal = formValues[field.id];

      if (field.type === 'checkbox') {
        const isChecked = Boolean(rawVal);
        const outputText = isChecked
          ? (field.checkboxConfig?.checkedValue || '☑ 要')
          : (field.checkboxConfig?.uncheckedValue || '☐ 不要');
        cell.value = outputText;

        if (field.labelCell && field.label) {
          const lCell = worksheet.getCell(field.labelCell.trim().toUpperCase());
          lCell.value = field.label;
        }
      } else if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        cell.value = String(rawVal);
      } else if (field.group === 'detail') {
        const item1Val = getItemValByLabel(items[0], field.label);
        if (item1Val) cell.value = item1Val;
      } else if (field.defaultValue !== undefined && field.defaultValue !== '') {
        cell.value = String(field.defaultValue);
      }
    }

    // Slot 2 (2種類目)
    if (field.cellSlot2 && field.cellSlot2.trim()) {
      const addr2 = field.cellSlot2.trim().toUpperCase();
      const key2 = `${field.id}__slot2`;
      const val2 = formValues[key2] !== undefined ? formValues[key2] : getItemValByLabel(items[1], field.label);
      if (val2 !== undefined && val2 !== null && val2 !== '') {
        worksheet.getCell(addr2).value = String(val2);
      }
    }
    // Slot 3 (3種類目)
    if (field.cellSlot3 && field.cellSlot3.trim()) {
      const addr3 = field.cellSlot3.trim().toUpperCase();
      const key3 = `${field.id}__slot3`;
      const val3 = formValues[key3] !== undefined ? formValues[key3] : getItemValByLabel(items[2], field.label);
      if (val3 !== undefined && val3 !== null && val3 !== '') {
        worksheet.getCell(addr3).value = String(val3);
      }
    }
    // Slot 4 (4種類目)
    if (field.cellSlot4 && field.cellSlot4.trim()) {
      const addr4 = field.cellSlot4.trim().toUpperCase();
      const key4 = `${field.id}__slot4`;
      const val4 = formValues[key4] !== undefined ? formValues[key4] : getItemValByLabel(items[3], field.label);
      if (val4 !== undefined && val4 !== null && val4 !== '') {
        worksheet.getCell(addr4).value = String(val4);
      }
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

  // 3. Inject In-Preview Manual Cell Overrides
  if (cellOverrides) {
    for (const [addr, val] of Object.entries(cellOverrides)) {
      if (addr && val !== undefined) {
        try {
          const c = worksheet.getCell(addr.toUpperCase());
          c.value = val;
        } catch (_) {}
      }
    }
  }

  // 5. Apply Custom Column Widths
  if (customColWidths) {
    for (const [colLetter, pixelWidth] of Object.entries(customColWidths)) {
      const colNum = colLetterToIndex(colLetter);
      if (colNum > 0) {
        try {
          const col = worksheet.getColumn(colNum);
          col.width = Math.max(1, Math.round(((pixelWidth - 5) / 8.0) * 10) / 10);
        } catch (_) {}
      }
    }
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
  customFileName?: string,
  cellOverrides?: Record<string, string>,
  customColWidths?: Record<string, number>
): Promise<void> {
  const bytes = await fillSpecificationExcel(template, formValues, items, docInfo, cellOverrides, customColWidths);
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
  const normalized = normalizeSpecTemplate(template);
  const asset: SpecMappingAssetFile = {
    version: '1.0',
    schemaType: 'specforge-mapping-asset',
    exportedAt: new Date().toISOString(),
    templateId: normalized.id,
    templateName: normalized.name,
    templateCode: normalized.code,
    description: normalized.description,
    targetCategoryName: normalized.targetCategoryName,
    fields: normalized.fields || [],
    masterFileName: normalized.masterFileName || normalized.originalFileName,
    masterWorkbookBase64: normalized.masterWorkbookBase64 || normalized.rawWorkbookBase64
  };

  const jsonStr = JSON.stringify(asset, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (template.name || 'template').replace(/[\s/\\?%*:|"<>]/g, '_');
  a.download = `MappingAsset_${safeName}_${new Date().toISOString().slice(0, 10)}.specmap.json`;
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
    templateCode: parsed.templateCode || parsed.code || '',
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
  fontColor?: string;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  bgColor?: string;
  wrapText?: boolean;
  borderTopStyle?: string;
  borderBottomStyle?: string;
  borderLeftStyle?: string;
  borderRightStyle?: string;
  hasBorder?: boolean;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  isMergedChild?: boolean;
  colSpan?: number;
  rowSpan?: number;
  isMapped?: boolean;
  mappedFieldId?: string;
  mappedFieldLabel?: string;
}

export interface RenderedSheetGrid {
  sheetName: string;
  availableSheets: string[];
  columns: { colLetter: string; width: number }[];
  rows: {
    rowNumber: number;
    height?: number;
    cells: RenderedCellData[];
  }[];
  totalCells: number;
  benchmarkMs: number;
}

export function colLetterToIndex(colLetters: string): number {
  let col = 0;
  for (let i = 0; i < colLetters.length; i++) {
    col = col * 26 + (colLetters.toUpperCase().charCodeAt(i) - 64);
  }
  return col;
}

function parseCellAddress(addr: string): { col: number; row: number } | null {
  const match = addr.match(/^([A-Z]+)([0-9]+)$/i);
  if (!match) return null;
  const letters = match[1].toUpperCase();
  const col = colLetterToIndex(letters);
  const row = parseInt(match[2], 10);
  return { col, row };
}

function colIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

function formatExcelBorder(borderItem: any): string | undefined {
  if (!borderItem) return undefined;
  const style = typeof borderItem === 'string' ? borderItem : borderItem.style;
  if (!style) return undefined;

  let width = '1px';
  let type = 'solid';
  if (style === 'medium') width = '2px';
  else if (style === 'thick') width = '2.5px';
  else if (style === 'double') { width = '3px'; type = 'double'; }
  else if (style === 'dotted') type = 'dotted';
  else if (style === 'dashed') type = 'dashed';
  else if (style === 'hair') width = '1px';

  let color = '#334155';
  if (borderItem.color && typeof borderItem.color === 'object') {
    const argb = String(borderItem.color.argb || '');
    if (argb.length === 8) color = `#${argb.slice(2)}`;
    else if (argb.length === 6) color = `#${argb}`;
  }
  return `${width} ${type} ${color}`;
}

interface MergeRangeInfo {
  top: number;
  left: number;
  bottom: number;
  right: number;
  colSpan: number;
  rowSpan: number;
  masterAddress: string;
}

/**
 * Real-time In-Memory Excel Renderer:
 * Evaluates template updates in memory using ExcelJS on every keystroke/change,
 * analyzes cell matrices, merges, styles, and values, and returns grid representation with benchmark time.
 */
export async function renderSpecificationExcelGrid(
  template: SpecTemplate,
  formValues: Record<string, any>,
  items: EquipmentItem[],
  docInfo: Record<string, string>,
  targetSheetOverride?: string,
  cellOverrides?: Record<string, string>,
  customColWidths?: Record<string, number>
): Promise<RenderedSheetGrid> {
  const startTime = performance.now();

  const workbook = new ExcelJS.Workbook();
  const rawBase64 = template.rawWorkbookBase64 || template.masterWorkbookBase64;
  if (rawBase64) {
    try {
      const binary = atob(rawBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      await workbook.xlsx.load(bytes.buffer.slice(0));
    } catch (e) {
      console.warn('Failed to load rawWorkbookBase64, falling back to default', e);
      const defaultBuffer = await createDefaultMasterWorkbook(template);
      await workbook.xlsx.load(defaultBuffer);
    }
  } else {
    const defaultBuffer = await createDefaultMasterWorkbook(template);
    await workbook.xlsx.load(defaultBuffer);
  }

  const normalizedTpl = normalizeSpecTemplate(template);
  const availableSheets = workbook.worksheets.map(w => w.name);
  const worksheet = targetSheetOverride
    ? (workbook.getWorksheet(targetSheetOverride) || workbook.worksheets[0])
    : workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('ワークシートが見つかりません。');
  }

  // Helper to find spec/detail value from an item by label
  const getItemVal = (it: EquipmentItem | undefined, label: string) => {
    if (!it) return '';
    const clean = label.toLowerCase();
    if (clean.includes('機器番号') || clean.includes('tag')) return it.tagNo || '';
    if (clean.includes('機器名') || clean.includes('名称')) return it.name || '';
    if (clean.includes('数量')) return `${it.quantity} ${it.unit || '台'}`;
    if (clean.includes('納期')) return it.deliveryDate || '';
    if (clean.includes('特記') || clean.includes('備考')) return it.notes || '';
    if (clean.includes('口径') && it.diameter && it.diameter !== '-') return it.diameter;
    if (clean.includes('材質') && it.material && it.material !== '-') return it.material;
    if (it.specs && it.specs.length > 0) {
      for (const sp of it.specs) {
        if (clean.includes(sp.name.toLowerCase()) || sp.name.toLowerCase().includes(clean)) {
          return `${sp.value}${sp.unit ? ' ' + sp.unit : ''}`;
        }
      }
    }
    return '';
  };

  // 1. Inject Fields (including 4-slot detail & spec mappings)
  const fields = normalizedTpl.fields || [];
  const fieldMappingMap: Record<string, { id: string; label: string }> = {};
  for (const field of fields) {
    if (field.cell && field.cell.trim()) {
      const cleanAddr = field.cell.trim().toUpperCase();
      fieldMappingMap[cleanAddr] = { id: field.id, label: field.label };

      const cell = worksheet.getCell(cleanAddr);
      const rawVal = formValues[field.id];
      if (field.type === 'checkbox') {
        const isChecked = Boolean(rawVal);
        cell.value = isChecked
          ? (field.checkboxConfig?.checkedValue || '☑ 要')
          : (field.checkboxConfig?.uncheckedValue || '☐ 不要');
        if (field.labelCell && field.label) {
          const lCell = worksheet.getCell(field.labelCell.trim().toUpperCase());
          lCell.value = field.label;
        }
      } else if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        cell.value = String(rawVal);
      } else if (field.group === 'detail') {
        const item1Val = getItemVal(items[0], field.label);
        if (item1Val) cell.value = item1Val;
      } else if (field.defaultValue !== undefined && field.defaultValue !== '') {
        cell.value = String(field.defaultValue);
      }
    }

    // Slot 2 (2種類目)
    if (field.cellSlot2 && field.cellSlot2.trim()) {
      const addr2 = field.cellSlot2.trim().toUpperCase();
      fieldMappingMap[addr2] = { id: `${field.id}__slot2`, label: `${field.label} (2種類目)` };
      const key2 = `${field.id}__slot2`;
      const val2 = formValues[key2] !== undefined ? formValues[key2] : getItemVal(items[1], field.label);
      if (val2 !== undefined && val2 !== null && val2 !== '') {
        worksheet.getCell(addr2).value = String(val2);
      }
    }
    // Slot 3 (3種類目)
    if (field.cellSlot3 && field.cellSlot3.trim()) {
      const addr3 = field.cellSlot3.trim().toUpperCase();
      fieldMappingMap[addr3] = { id: `${field.id}__slot3`, label: `${field.label} (3種類目)` };
      const key3 = `${field.id}__slot3`;
      const val3 = formValues[key3] !== undefined ? formValues[key3] : getItemVal(items[2], field.label);
      if (val3 !== undefined && val3 !== null && val3 !== '') {
        worksheet.getCell(addr3).value = String(val3);
      }
    }
    // Slot 4 (4種類目)
    if (field.cellSlot4 && field.cellSlot4.trim()) {
      const addr4 = field.cellSlot4.trim().toUpperCase();
      fieldMappingMap[addr4] = { id: `${field.id}__slot4`, label: `${field.label} (4種類目)` };
      const key4 = `${field.id}__slot4`;
      const val4 = formValues[key4] !== undefined ? formValues[key4] : getItemVal(items[3], field.label);
      if (val4 !== undefined && val4 !== null && val4 !== '') {
        worksheet.getCell(addr4).value = String(val4);
      }
    }
  }

  // 2. Inject Legacy Mappings
  if (normalizedTpl.cellMappings) {
    for (const cm of normalizedTpl.cellMappings) {
      if (!cm.cell || !cm.fieldKey) continue;
      const cleanAddr = cm.cell.trim().toUpperCase();
      if (!fieldMappingMap[cleanAddr]) {
        fieldMappingMap[cleanAddr] = { id: cm.fieldKey, label: cm.label || cm.fieldKey };
      }
      const cell = worksheet.getCell(cleanAddr);
      const val = docInfo[cm.fieldKey];
      if (val !== undefined && val !== null) {
        cell.value = val;
      }
    }
  }

  // 3. Inject In-Preview Manual Cell Overrides
  if (cellOverrides) {
    for (const [addr, val] of Object.entries(cellOverrides)) {
      if (addr && val !== undefined) {
        try {
          const cleanAddr = addr.trim().toUpperCase();
          worksheet.getCell(cleanAddr).value = val;
          if (!fieldMappingMap[cleanAddr]) {
            fieldMappingMap[cleanAddr] = { id: `override-${cleanAddr}`, label: `直接編集セル (${cleanAddr})` };
          }
        } catch (_) {}
      }
    }
  }

  // 4. Parse Merged Cells
  const mergeList: MergeRangeInfo[] = [];
  const rawMerges: string[] = [];
  if (Array.isArray((worksheet as any).model?.merges)) {
    rawMerges.push(...(worksheet as any).model.merges);
  }
  if ((worksheet as any)._merges) {
    const mObj = (worksheet as any)._merges;
    if (Array.isArray(mObj)) {
      rawMerges.push(...mObj.map((m: any) => typeof m === 'string' ? m : m?.range || ''));
    } else if (typeof mObj === 'object') {
      for (const k of Object.keys(mObj)) {
        rawMerges.push(k);
      }
    }
  }

  const uniqueMerges = Array.from(new Set(rawMerges)).filter(Boolean);
  for (const mStr of uniqueMerges) {
    const parts = mStr.split(':');
    if (parts.length === 2) {
      const s = parseCellAddress(parts[0]);
      const e = parseCellAddress(parts[1]);
      if (s && e) {
        mergeList.push({
          top: Math.min(s.row, e.row),
          left: Math.min(s.col, e.col),
          bottom: Math.max(s.row, e.row),
          right: Math.max(s.col, e.col),
          colSpan: Math.abs(e.col - s.col) + 1,
          rowSpan: Math.abs(e.row - s.row) + 1,
          masterAddress: `${colIndexToLetter(Math.min(s.col, e.col))}${Math.min(s.row, e.row)}`
        });
      }
    }
  }

  // 5. Determine sheet boundaries (columns and rows)
  let maxColIndex = 8; // At least H
  let maxRowIndex = 28; // At least 28 rows

  if (worksheet.dimensions) {
    try {
      const dims = worksheet.dimensions as any;
      if (typeof dims.bottom === 'number' && typeof dims.right === 'number') {
        maxColIndex = Math.max(maxColIndex, dims.right);
        maxRowIndex = Math.max(maxRowIndex, dims.bottom);
      } else {
        const dimStr = String(dims?.range || dims);
        const dMatch = dimStr.match(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/i);
        if (dMatch) {
          const bottomEnd = parseCellAddress(dMatch[2]);
          if (bottomEnd) {
            maxColIndex = Math.max(maxColIndex, bottomEnd.col);
            maxRowIndex = Math.max(maxRowIndex, bottomEnd.row);
          }
        }
      }
    } catch (_) {}
  }

  for (const f of fields) {
    for (const addr of [f.cell, f.cellSlot2, f.cellSlot3, f.cellSlot4]) {
      if (addr) {
        const parsed = parseCellAddress(addr.trim());
        if (parsed) {
          maxColIndex = Math.max(maxColIndex, parsed.col);
          maxRowIndex = Math.max(maxRowIndex, parsed.row);
        }
      }
    }
  }

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    maxRowIndex = Math.max(maxRowIndex, rowNumber);
    row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
      maxColIndex = Math.max(maxColIndex, colNumber);
    });
  });

  maxColIndex = Math.min(Math.max(maxColIndex, 8), 40); // Min H (8), Max 40 columns
  maxRowIndex = Math.min(Math.max(maxRowIndex, 24), 120); // Min 24 rows, Max 120 rows

  // Build columns definition with accurate Excel width to pixel conversion
  const defaultColWidth = (worksheet.properties && typeof (worksheet.properties as any).defaultColWidth === 'number' && (worksheet.properties as any).defaultColWidth > 0)
    ? (worksheet.properties as any).defaultColWidth
    : 8.43;

  const columns: { colLetter: string; width: number }[] = [];
  for (let c = 1; c <= maxColIndex; c++) {
    const colLetter = colIndexToLetter(c);
    const colObj = worksheet.getColumn(c);
    
    // Read raw column width from Excel
    const rawWidth = (colObj && typeof colObj.width === 'number' && colObj.width > 0)
      ? colObj.width
      : defaultColWidth;

    // Excel standard character width to pixels: Math.round(chars * 8.0 + 5)
    // Allows faithful thin margins (e.g. 2 chars = 21px) and wide cells (e.g. 50 chars = 405px)
    const basePixelWidth = Math.max(18, Math.round(rawWidth * 8.0 + 5));
    const pixelWidth = customColWidths?.[colLetter] ?? basePixelWidth;
    columns.push({ colLetter, width: pixelWidth });
  }

  // 6. Build rows & cell matrices
  const defaultRowHeightPt = (worksheet.properties && typeof (worksheet.properties as any).defaultRowHeight === 'number' && (worksheet.properties as any).defaultRowHeight > 0)
    ? (worksheet.properties as any).defaultRowHeight
    : 15;

  const rows: { rowNumber: number; height?: number; cells: RenderedCellData[] }[] = [];
  let cellCount = 0;

  for (let r = 1; r <= maxRowIndex; r++) {
    const rowCells: RenderedCellData[] = [];
    const excelRow = worksheet.getRow(r);
    const rawHeightPt = (excelRow && typeof excelRow.height === 'number' && excelRow.height > 0)
      ? excelRow.height
      : defaultRowHeightPt;
    // 1 pt = 1.3333 px at 96 DPI
    const rowHeight = Math.max(18, Math.round(rawHeightPt * 1.333));

    for (let c = 1; c <= maxColIndex; c++) {
      const colLetter = colIndexToLetter(c);
      const addr = `${colLetter}${r}`;
      const cell = worksheet.getCell(addr);
      cellCount++;

      // Check merge status
      let isMergedChild = false;
      let colSpan: number | undefined = undefined;
      let rowSpan: number | undefined = undefined;

      const mergeInfo = mergeList.find(m => c >= m.left && c <= m.right && r >= m.top && r <= m.bottom);
      if (mergeInfo) {
        if (addr === mergeInfo.masterAddress) {
          colSpan = mergeInfo.colSpan;
          rowSpan = mergeInfo.rowSpan;
        } else {
          isMergedChild = true;
        }
      }

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
      if (fill && fill.fgColor) {
        const argb = String(fill.fgColor.argb || fill.fgColor.theme || '');
        if (argb.length === 8) {
          bgColor = `#${argb.slice(2)}`;
        } else if (argb.length === 6) {
          bgColor = `#${argb}`;
        }
      }

      let fontColor: string | undefined;
      if (cell.font && cell.font.color) {
        const cArgb = String(cell.font.color.argb || '');
        if (cArgb.length === 8) {
          fontColor = `#${cArgb.slice(2)}`;
        }
      }

      const isBold = Boolean(cell.font && cell.font.bold);
      const fontSize = cell.font && cell.font.size ? cell.font.size : 10;
      const fontFamily = cell.font && cell.font.name ? cell.font.name : undefined;
      const align = (cell.alignment && cell.alignment.horizontal as any) || (typeof cell.value === 'number' ? 'right' : 'left');
      const verticalAlign = (cell.alignment && cell.alignment.vertical as any) || 'middle';
      const wrapText = Boolean(cell.alignment && cell.alignment.wrapText);
      
      const border = cell.border;
      const borderTopStyle = formatExcelBorder(border?.top);
      const borderBottomStyle = formatExcelBorder(border?.bottom);
      const borderLeftStyle = formatExcelBorder(border?.left);
      const borderRightStyle = formatExcelBorder(border?.right);
      const hasBorder = Boolean(borderTopStyle || borderBottomStyle || borderLeftStyle || borderRightStyle);
      const borderTop = Boolean(borderTopStyle);
      const borderBottom = Boolean(borderBottomStyle);
      const borderLeft = Boolean(borderLeftStyle);
      const borderRight = Boolean(borderRightStyle);

      // Field mapping tag
      const mapped = fieldMappingMap[addr];

      rowCells.push({
        address: addr,
        col: colLetter,
        row: r,
        value: displayVal,
        isBold,
        fontSize,
        fontFamily,
        fontColor,
        align,
        verticalAlign,
        bgColor,
        wrapText,
        borderTopStyle,
        borderBottomStyle,
        borderLeftStyle,
        borderRightStyle,
        hasBorder,
        borderTop,
        borderBottom,
        borderLeft,
        borderRight,
        isMergedChild,
        colSpan,
        rowSpan,
        isMapped: Boolean(mapped),
        mappedFieldId: mapped?.id,
        mappedFieldLabel: mapped?.label
      });
    }

    rows.push({
      rowNumber: r,
      height: rowHeight,
      cells: rowCells
    });
  }

  const benchmarkMs = Math.round((performance.now() - startTime) * 10) / 10;

  return {
    sheetName: worksheet.name,
    availableSheets,
    columns,
    rows,
    totalCells: cellCount,
    benchmarkMs
  };
}

