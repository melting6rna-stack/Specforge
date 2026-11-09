export interface ChangeLog {
  id: string;
  itemId: string;
  timestamp: string;
  author: string;
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  reason?: string;
}

export interface Category {
  id: string;
  projectId?: string; // 案件ごとのカテゴリ管理
  name: string;
  color?: string;
}

export interface EquipmentSpecParam {
  id: string;
  name: string; // 仕様の項目 (例: 口径, 出力, 流量, 揚程, 材質, 耐圧, 電圧, 塗装等)
  value: string; // 実際の数値 (例: 50, 7.5, 100, SUS304, エポキシ樹脂塗装)
  unit: string; // 単位 (例: A, kW, m³/h, m, MPa, V等)
}

export interface EquipmentItem {
  id: string;
  projectId: string;
  tagNo: string; // 機器番号・タグ (例: EQ-001, V-101, P-01)
  name: string; // 機器名 (必須)
  quantity: number; // 数量 (必須)
  unit: string; // 数量の単位 (台, 個, 基, 本)
  diameter?: string; // 口径 (下位互換)
  material?: string; // 材質 (下位互換)
  deliveryDate: string; // 納入時期 (必須, 例: 2026-05-15, 2026年5月下旬)
  categoryId: string; // カテゴリID
  deliveryLocation?: string; // 納入場所
  notes?: string; // 特記事項・指示事項
  specs?: EquipmentSpecParam[]; // 機器仕様リスト (項目追加で1つずつ定義)
  customParams?: Record<string, string>; // 追加仕様項目
  history?: ChangeLog[];
  createdAt: string;
  updatedAt: string;
  // Tokki specification schema properties (schema_version 1.0 & 1.1)
  action?: '更新' | '新設' | '撤去' | '移設' | '既設利用' | '仮設' | 'その他';
  purpose?: string | null;
  coating?: {
    specification: string | null;
    color: string | null;
    target_part: string | null;
    note: string | null;
  };
  materials?: Array<{ part: string; value: string | null; condition: string | null; note: string | null }>;
  accessories?: Array<{ name: string; quantity: number | null; unit: string | null; note: string | null }>;
  requirements?: Array<{ type: string; text: string }>;
  remarks?: string[];
  source?: {
    page_start: number | null;
    page_end: number | null;
    section: string | null;
    original_text: string | null;
  };
  edit?: {
    status: '未確認' | '要確認' | '確認済';
    modified: boolean;
    modified_at: string | null;
  };
  unclassified?: Array<{ text: string; page: number | null; reason: string | null }>;
  rawTokki?: any;
}

export interface CellMappingField {
  id: string;
  label: string; // 表示名 (例: 特記事項, 検査基準, 機器番号...)
  cell: string; // セル番地 (例: E30, C3, B28...)
  fieldKey: string; // データのキー (title, docNo, notes, inspectionStandard, diameter...)
  description?: string;
}

export interface SpecFieldMapping {
  id: string;
  label: string; // 画面表示名 (例: 工事名称, 水圧試験要否, 提出書類...)
  cell: string; // セル座標 (例: C4, F10, E30)
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date';
  group?: 'basic' | 'spec' | 'check' | 'notes' | string; // グループ分類
  options?: string[]; // プルダウン選択肢 (type === 'select')
  checkboxConfig?: {
    checkedValue: string; // チェックON時のExcel書き込み値 (例: '☑ 要', '要', '有', '○')
    uncheckedValue: string; // チェックOFF時のExcel書き込み値 (例: '☐ 不要', '不要', '無', '-')
    labelTrue?: string; // UI上の表示 (例: '要 / 実施する')
    labelFalse?: string; // UI上の表示 (例: '不要 / 該当なし')
  };
  defaultValue?: string | boolean;
  placeholder?: string;
  description?: string;
}

export interface TableColumnMapping {
  startRow: number; // 明細の書き込み開始行番号 (例: 12)
  targetSheetName?: string; // 対象シート名 (省略時は第1シート)
  tagNoCol?: string; // 機器番号列 (例: B)
  nameCol: string; // 機器名列 (例: C)
  diameterCol?: string; // 口径列 (例: D)
  materialCol?: string; // 材質列 (例: E)
  quantityCol: string; // 数量列 (例: F)
  deliveryDateCol: string; // 納期列 (例: G)
  notesCol?: string; // 備考・特記事項列 (例: H)
}

export interface SpecTemplate {
  id: string;
  name: string;
  code: string;
  description: string;
  targetCategoryName?: string;
  columns: string[];
  inspectionStandard: string;
  warrantyPeriod: string;
  deliveryTerms: string;
  notesTemplate: string;
  sourceType: 'preset' | 'custom_excel';
  originalFileName?: string;
  masterFileName?: string;
  // Raw template binary stored as Base64 so original layout/styling is 100% preserved
  rawWorkbookBase64?: string;
  masterWorkbookBase64?: string;
  // Modern form fields with cell mapping, dropdown options, and checkbox config
  fields?: SpecFieldMapping[];
  // Specific single-cell mappings (legacy fallback)
  cellMappings?: CellMappingField[];
  // Table row mapping for list of equipments
  tableMapping?: TableColumnMapping;
  updatedAt: string;
}

export interface SpecMappingAssetFile {
  version: '1.0';
  schemaType: 'specforge-mapping-asset';
  exportedAt: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  description: string;
  targetCategoryName?: string;
  fields: SpecFieldMapping[];
  tableMapping?: TableColumnMapping;
  masterFileName?: string;
  masterWorkbookBase64?: string;
}

export interface ProjectWorkspace {
  id: string;
  orderNo?: string; // オーダーNo. (例: 202500444)
  name: string; // 案件名・工事名称 (共通入力, 例: 〇〇市水道工事)
  code: string; // 案件コード (共通入力, 例: 20345-001)
  codePart1?: string; // 案件コード 前半 (例: 20345)
  codePart2?: string; // 案件コード 後半 (例: 001)
  clientName: string; // 客先名・発注者 (例: 〇〇市水道局)
  clientNumber?: string; // 客先番号 (例: 【ABC】-【12345】)
  clientNumberPart1?: string; // 客先番号 前半 (記号)
  clientNumberPart2?: string; // 客先番号 後半 (番号)
  location?: string; // 工事場所・設置場所
  department?: string; // 担当部署・発行元
  description: string;
  createdAt: string;
  linkedJsonFileName?: string; // 紐づけられているJSONファイル名 (例: "PlantSpec_2026.json")
  linkedJsonLastSync?: string; // 最終読書同期日時
  isLinkError?: boolean; // 紐づけ元ファイルが見つからない等のエラー状態
  linkErrorMessage?: string; // エラーメッセージ
  schemaType?: 'tokki-equipment' | 'specforge-v2' | 'generic'; // スキーマ種別
  rawDocument?: any; // 特記仕様書スキーマの document オブジェクト
}
