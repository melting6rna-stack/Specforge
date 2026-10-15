export interface ChangeLog {
  id: string;
  itemId: string;
  timestamp: string;
  author: string;
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
}

export interface EquipmentItem {
  id: string;
  projectId: string;
  tagNo: string; // 機器番号・タグ (e.g. V-101, P-01)
  name: string; // 機器名 (必須)
  quantity: number; // 数量 (必須)
  unit: string; // 単位 (台, 個, 基, 本)
  diameter: string; // 口径 (必須, e.g. 50A, 100A, φ25)
  material: string; // 材質 (必須, e.g. SUS304, SCS13, SS400)
  deliveryDate: string; // 納期 (必須, YYYY-MM-DD)
  categoryId: string; // カテゴリID
  deliveryLocation?: string; // 納入場所
  notes?: string; // 備考・特記事項
  customParams?: Record<string, string>; // 追加仕様項目
  history: ChangeLog[];
  createdAt: string;
  updatedAt: string;
}

export interface SpecTemplate {
  id: string;
  name: string;
  code: string;
  description: string;
  targetCategoryName?: string;
  // Specific headers/columns expected
  columns: string[];
  inspectionStandard: string;
  warrantyPeriod: string;
  deliveryTerms: string;
  notesTemplate: string;
  sourceType: 'preset' | 'custom_excel';
  originalFileName?: string;
  updatedAt: string;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  code: string;
  clientName: string;
  description: string;
  createdAt: string;
}
