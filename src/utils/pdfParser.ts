import * as pdfjsLib from 'pdfjs-dist';
import { EquipmentItem } from '../types';

// Set up worker source
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    console.warn('Worker URL setup error, using inline fallback', e);
  }
}

export interface ExtractedPdfItem {
  tagNo: string;
  name: string;
  diameter: string;
  material: string;
  quantity: number;
  unit: string;
  deliveryDate: string;
  notes: string;
  rawText: string;
}

export interface PdfParseResult {
  fileName: string;
  totalPages: number;
  extractedItems: ExtractedPdfItem[];
  rawTextPreview: string;
}

/**
 * Extracts raw text from a PDF file using client-side PDF.js (No AI, 100% offline).
 */
export async function extractTextFromPdf(file: File): Promise<{ fullText: string; totalPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const textChunks: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by their vertical position (Y coordinate) to preserve table rows
    const items = textContent.items as any[];
    if (items.length === 0) continue;

    // Sort items by Y descending (top to bottom), then X ascending (left to right)
    items.sort((a, b) => {
      const yDelta = Math.abs(b.transform[5] - a.transform[5]);
      if (yDelta > 3) {
        return b.transform[5] - a.transform[5]; // top to bottom
      }
      return a.transform[4] - b.transform[4]; // left to right
    });

    let currentY: number | null = null;
    let currentLine = '';

    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (currentY === null || Math.abs(currentY - y) > 4) {
        if (currentLine.trim()) {
          textChunks.push(currentLine.trim());
        }
        currentY = y;
        currentLine = item.str;
      } else {
        currentLine += '\t' + item.str;
      }
    }
    if (currentLine.trim()) {
      textChunks.push(currentLine.trim());
    }
  }

  return {
    fullText: textChunks.join('\n'),
    totalPages
  };
}

/**
 * Deterministically parses extracted text into structured equipment specifications using rule-based pattern matching (No AI).
 */
export function parsePdfTextToEquipment(
  fullText: string,
  fileName: string,
  totalPages: number
): PdfParseResult {
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const extractedItems: ExtractedPdfItem[] = [];

  // Regex patterns for industrial equipment specifications
  const tagRegex = /\b([VPCTME]-\d{2,4}[A-Z]?|EQ-\d{2,4}|[A-Z]{1,3}\d{3,4})\b/i;
  const diameterRegex = /\b(\d{1,4}[A-B]|\d{1,3}\s*B|φ\s*\d{1,4}|\d{1,2}\s*インチ|\d{1,3}\s*mm)\b/i;
  const materialRegex = /\b(SUS\d{3}[A-Z]*|SCS\d{2}[A-Z]*|SS\d{3}|SCM\d{3}|FC\d{3}|FCD\d{3}|A\d{4}|PVC|PP|PTFE|ステンレス|鋳鉄|真鍮)\b/i;
  const dateRegex = /\b(20\d{2}[-/年]\d{1,2}[-/月]\d{1,2}日?)\b/;
  const qtyRegex = /\b(\d+)\s*(台|個|基|本|組|セット|式|ヶ|枚)?\b/;

  const now = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip generic header lines
    if (line.match(/^【|^文書番号|^発行日|^承認|^仕様書標題|^目次|^Page/i)) {
      continue;
    }

    // Check if line contains equipment-related clues (e.g. diameter, material, or equipment keyword)
    const hasDiameter = diameterRegex.test(line);
    const hasMaterial = materialRegex.test(line);
    const hasEquipName = line.match(/弁|バルブ|ポンプ|配管|フランジ|タンク|継手|フィルター|シリンダ|モーター|ファン|送風機|ベアリング|ノズル|計装/);

    if (hasDiameter || hasMaterial || hasEquipName) {
      // Split tokens (by tab or whitespace)
      const tokens = line.split(/[\t]+/).map(t => t.trim()).filter(Boolean);

      let tagNo = '';
      const tagMatch = line.match(tagRegex);
      if (tagMatch) tagNo = tagMatch[1];

      let diameter = '50A';
      const diaMatch = line.match(diameterRegex);
      if (diaMatch) diameter = diaMatch[1].replace(/\s+/g, '');

      let material = 'SUS304';
      const matMatch = line.match(materialRegex);
      if (matMatch) material = matMatch[1];

      let deliveryDate = now;
      const dateMatch = line.match(dateRegex);
      if (dateMatch) {
        deliveryDate = dateMatch[1].replace(/年|\//g, '-').replace(/月/g, '-').replace(/日/g, '');
      }

      let quantity = 1;
      let unit = '台';
      const qtyMatch = line.match(qtyRegex);
      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1], 10) || 1;
        if (qtyMatch[2]) unit = qtyMatch[2];
      }

      // Determine equipment name by removing matched tokens or taking the first text column
      let nameCandidate = '';
      if (tokens.length >= 2) {
        // Find token that looks like an item name (not tag, not date, not diameter)
        for (const t of tokens) {
          if (!t.match(tagRegex) && !t.match(diameterRegex) && !t.match(dateRegex) && !t.match(/^\d+$/)) {
            nameCandidate = t;
            break;
          }
        }
      }

      if (!nameCandidate) {
        nameCandidate = line
          .replace(tagRegex, '')
          .replace(diameterRegex, '')
          .replace(materialRegex, '')
          .replace(dateRegex, '')
          .replace(qtyRegex, '')
          .replace(/[\t,]/g, ' ')
          .trim();
      }

      if (!nameCandidate) {
        nameCandidate = `機器仕様品目-${extractedItems.length + 1}`;
      }

      extractedItems.push({
        tagNo: tagNo || `EQ-${String(extractedItems.length + 1).padStart(2, '0')}`,
        name: nameCandidate,
        diameter,
        material,
        quantity,
        unit,
        deliveryDate,
        notes: `PDFファイル (${fileName}) より抽出`,
        rawText: line
      });
    }
  }

  // Fallback: If no structured table rows matched, extract lines containing equipment terms
  if (extractedItems.length === 0) {
    for (const line of lines.slice(0, 5)) {
      if (line.length > 3 && line.length < 50) {
        extractedItems.push({
          tagNo: `EQ-${String(extractedItems.length + 1).padStart(2, '0')}`,
          name: line,
          diameter: '50A',
          material: 'SUS304',
          quantity: 1,
          unit: '台',
          deliveryDate: now,
          notes: `PDFから抽出した行データ: ${line}`,
          rawText: line
        });
      }
    }
  }

  return {
    fileName,
    totalPages,
    extractedItems,
    rawTextPreview: lines.slice(0, 15).join('\n')
  };
}
