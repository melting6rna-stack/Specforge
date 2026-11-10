# SpecForge システム設計仕様書 (System Architecture & Design Specification)

**システム名称**: SpecForge（プラント配管・機械設備 仕様書作成＆機器データベース管理システム）  
**バージョン**: Ver 2.0.0  
**作成日**: 2026年11月10日  
**対象環境**: Webブラウザ（Chrome, Edge, Safari） / デスクトップPWA（Windows, macOS）

---

## 1. システム概要と開発目的

### 1.1 開発背景と目的
プラント配管・産業機械調達における機器仕様書の作成業務では、以下のような課題が存在していました。
- 案件共通情報（案件名、案件コード、発注元、オーダーNo.）の複数機器仕様書への手動転記ミス
- 会社指定のExcel原本テンプレートの書式崩れ・結合セルの破損・フォント崩れ
- 機器仕様（口径、耐圧、流量、材質等）の設計変更履歴の散逸
- 複数機器を1枚の仕様書にまとめて調達する際のセル位置調整の手間

本システム（SpecForge）は、**「機器データベースの一元管理」** と **「Excel原本レイアウトの完全保持（Zero Layout Break）」** を両立し、Webブラウザおよびデスクトップ上でリアルタイムに仕様書の編集・プレビュー（PDF/Excel）・一括出力を行えるように開発された専用エンジニアリングシステムです。

### 1.2 コアバリュー
1. **Excel原本の完全保持**: アップロードした原本.xlsxのバイナリをBase64で保持し、ExcelJSによりセル番地へ直接値を注入。フォント、罫線、行高、列幅、会社ロゴ、結合セルを1ピクセルも崩さず出力。
2. **直感的な2モードプレビュー**: 
   - **PDF (仕様書帳票)**: A4印刷帳票をキャンバス上に実寸比率で直接描画。
   - **EXCEL (原本直接描画)**: ExcelJSのインメモリ解析によるスプレッドシート表示（数式バー・セル連動）。
3. **機器種別コード連動と新採番ルール**: 機器種別（アルファベット2文字）と案件コードから、`${案件コード}${機器種別}G-${機器番号}` を自動生成。
4. **最大4機器並列セルマッピング**: 1つの仕様書内に最大4種類（1種類目〜4種類目）の機器パラメータを並列マッピング・流し込み可能。
5. **完全な監査証跡（Audit Trail）**: 機器情報編集モーダル内に変更メモ欄と過去の変更履歴（変更前/変更後/理由/更新者/日時）を直結表示。

---

## 2. システム構成と技術スタック

### 2.1 テクノロジースタック
| レイヤー | 採用技術 | バージョン / 用途 |
| :--- | :--- | :--- |
| **フロントエンドUI** | React (TypeScript) + Vite | React 18, Strict Mode, Functional Components, Hooks |
| **スタイリング** | Tailwind CSS v4 | `@import "tailwindcss";`, レスポンシブ, 印刷スタイル |
| **アイコン** | Lucide React | `lucide-react` (直感的なエンジニアリングアイコン) |
| **Excel処理エンジン** | ExcelJS | `exceljs` (原本バイナリ読込・セル直接書込・グリッド抽出) |
| **PDF生成エンジン** | jsPDF + html2canvas | `jspdf`, `html2canvas` (DOM実寸キャプチャ・PDF出力) |
| **データ永続化** | LocalStorage + JSON File System | ブラウザローカル保存、JSON正本ファイル読書同期 |
| **PWA** | Service Worker + Web Manifest | オフライン稼働、デスクトップインストール対応 |

### 2.2 ディレクトリ構成
```
/
├── src/
│   ├── App.tsx                    # メインオーケストレーター（状態管理・タブ切替・永続化）
│   ├── main.tsx                   # エントリーポイント
│   ├── index.css                  # グローバルCSS (Tailwind v4)
│   ├── components/                # UIコンポーネント群
│   │   ├── Header.tsx             # ヘッダー（案件セレクタ・ナビゲーション・バッジ）
│   │   ├── OrderDatabaseTab.tsx   # 機器データベース管理タブ（一覧・一括編集・検索）
│   │   ├── SpecDashboardTab.tsx   # 仕様書リアルタイム生成＆プレビュータブ（PDF/Excel切替）
│   │   ├── TemplateAdminTab.tsx   # テンプレート・セル番地マッピング管理タブ
│   │   ├── ProjectSummaryTab.tsx  # 案件サマリー＆JSON管理タブ（2ペイン構成）
│   │   ├── ItemCreateModal.tsx    # 機器新規登録モーダル（機器種別2文字対応）
│   │   ├── ItemEditModal.tsx      # 機器編集モーダル（変更メモ・変更履歴直結）
│   │   ├── ChangeHistoryModal.tsx # 機器変更履歴全件モーダル
│   │   ├── ProjectDetailModal.tsx # 案件基本情報編集モーダル
│   │   ├── PwaInstallGuideModal.tsx # PWAインストール案内モーダル
│   │   └── UnsavedChangesModal.tsx# 未保存離脱警告モーダル
│   ├── types/
│   │   └── index.ts               # TypeScript型定義（データスキーマ）
│   ├── utils/
│   │   ├── exceljsEngine.ts       # ExcelJS原本読込・マッピング書込・グリッド抽出
│   │   └── pdfGenerator.ts        # DOMキャプチャ＆A4 PDF生成
│   └── data/
│       ├── defaultTemplates.ts    # 初期仕様書テンプレート定義（配管・バルブ等）
│       └── sampleOrders.ts        # 初期サンプル案件・機器データ
├── docs/                          # 仕様書・取扱説明書
│   ├── SYSTEM_DESIGN_SPECIFICATION.md # システム設計仕様書
│   └── USER_MANUAL.md             # 取扱説明書
└── public/                        # 静的アセット (manifest.json, icons, sample xlsx)
```

---

## 3. データモデル仕様 (Data Schema)

### 3.1 機器データモデル (`EquipmentItem`)
```typescript
export interface EquipmentItem {
  id: string;                     // 機器UUID (例: "eq-01")
  projectId: string;              // 所属案件ID (例: "prj-01")
  tagNo: string;                  // 機器番号・タグ (例: "V-101", "P-201")
  name: string;                   // 機器名称 (例: "ステンレス製電動ボール弁")
  equipmentType?: string;         // 機器種別 (英大文字2文字, 例: "VA", "PU", "TK", "HE")
  quantity: number;               // 数量
  unit: string;                   // 単位 (例: "台", "基", "個", "本")
  deliveryDate: string;           // 納入時期 (例: "2026-06-20", "令和8年3月末")
  categoryId: string;             // 所属カテゴリID
  diameter?: string;              // 口径 (例: "50A (2B)")
  material?: string;              // 材質 (例: "SCS13A", "SUS304")
  deliveryLocation?: string;      // 納入場所
  notes?: string;                 // 特記事項・指示事項
  specs?: EquipmentSpecParam[];   // 機器仕様パラメータ配列
  history?: ChangeLog[];          // 変更履歴ログ配列
  createdAt: string;              // 登録日時 (ISO文字列)
  updatedAt: string;              // 最終更新日時 (ISO文字列)
}
```

### 3.2 機器仕様パラメータモデル (`EquipmentSpecParam`)
```typescript
export interface EquipmentSpecParam {
  id: string;                     // パラメータUUID
  name: string;                   // 項目名 (例: "口径", "出力", "流量", "揚程", "耐圧", "塗装")
  value: string;                  // 設定値 (例: "50", "7.5", "100", "エポキシ樹脂塗装")
  unit: string;                   // 単位 (例: "A", "kW", "m³/h", "MPa", "-")
}
```

### 3.3 変更履歴モデル (`ChangeLog`)
```typescript
export interface ChangeLog {
  id: string;                     // ログUUID
  itemId: string;                 // 対象機器ID
  timestamp: string;              // 変更日時 (ISO形式)
  author: string;                 // 変更者氏名 (例: "設計部 担当", "品質管理部")
  field: string;                  // 変更フィールドキー (例: "material", "specs")
  fieldLabel: string;             // 画面表示名 (例: "材質", "機器種別", "仕様: 口径")
  oldValue: string;               // 変更前値
  newValue: string;               // 変更後値
  reason?: string;                // 変更理由・メモ (必須または任意入力)
}
```

### 3.4 案件ワークスペースモデル (`ProjectWorkspace`)
```typescript
export interface ProjectWorkspace {
  id: string;                     // 案件UUID (例: "prj-01")
  orderNo?: string;               // オーダーNo. (例: "202500444")
  name: string;                   // 案件名称・工事名 (例: "第1期 プラント配管・機械調達案件")
  code: string;                   // 案件コード完全形 (例: "PRJ-2026-01")
  codePart1?: string;             // 案件コード前半 (例: "PRJ-2026")
  codePart2?: string;             // 案件コード後半 (例: "01")
  clientName: string;             // 客先名・発注元 (例: "〇〇化学工業株式会社")
  location?: string;              // 工事場所・納入先
  department?: string;            // 発行元・設計部署 (例: "設計部 プラント第1Gr")
  description: string;            // 案件概要
  createdAt: string;              // 作成日時
  linkedJsonFileName?: string;    // 紐づけ正本JSONファイル名
  linkedJsonLastSync?: string;    // 最終同期日時
}
```

### 3.5 仕様書テンプレート＆セルマッピングモデル (`SpecTemplate`, `SpecFieldMapping`)
```typescript
export interface SpecFieldMapping {
  id: string;                     // フィールドUUID
  label: string;                  // 項目名 (例: "口径", "耐圧・漏れ検査", "塗装仕様")
  cell: string;                   // 1種類目（主仕様）のセル番地 (例: "C15")
  cellSlot2?: string;             // 2種類目のセル番地 (例: "D15")
  cellSlot3?: string;             // 3種類目のセル番地 (例: "E15")
  cellSlot4?: string;             // 4種類目のセル番地 (例: "F15")
  labelCell?: string;             // チェックボックス項目名・見出しのセル番地 (例: "B15")
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date'; // 入力タイプ
  group?: 'basic' | 'spec' | 'check' | 'notes';               // 分類グループ
  options?: string[];             // プルダウン選択肢配列
  checkboxConfig?: {
    checkedValue: string;         // チェックON時のExcel出力値 (例: "☑ 要", "要")
    uncheckedValue: string;       // チェックOFF時のExcel出力値 (例: "☐ 不要", "不要")
    labelTrue?: string;           // UI表示名
    labelFalse?: string;          // UI表示名
  };
  defaultValue?: string | boolean;
}

export interface SpecTemplate {
  id: string;
  name: string;                   // テンプレート名 (例: "配管・バルブ機器調達仕様書")
  code: string;                   // テンプレートコード (例: "TPL-VALVE-01")
  description: string;
  rawWorkbookBase64?: string;     // 原本Excelバイナリ (Base64)
  fields: SpecFieldMapping[];     // セル番地マッピング定義一覧
  tableMapping?: TableColumnMapping; // 複数行機器明細の列マッピング
}
```

---

## 4. 機能設計仕様

### 4.1 案件管理（プロジェクト・ワークスペース）機能
1. **2ペイン構成の案件一覧**:
   - 左ペイン: 現在選択されているアクティブ案件のコード、名称、客先名、機器点数、概要を表示。右下の「基本情報編集」ボタン押下時のみ編集モーダルを開く（カード本体クリックでの不要な画面遷移を抑止）。
   - 右ペイン: 登録済みの全案件リストを一覧表示。ワンクリックで作業対象案件を瞬時にスイッチ。
2. **案件コードの構造化**:
   - `codePart1`（年度・工事区分など）と `codePart2`（連番・枝番など）に分割入力対応。自動的に `${codePart1}-${codePart2}` として統合。
3. **客先番号の廃止**:
   - 要求仕様に基づき、新案件作成モーダルおよびサマリー表示部から客先番号入力欄を完全撤廃。
4. **JSON正本ファイル連動**:
   - 案件ごとにローカルJSONファイルを正本データベースとして紐づけ、バックアップ・復元が可能。

### 4.2 機器データベース管理機能
1. **機器種別（英大文字2文字）の導入**:
   - バルブ（`VA`）、ポンプ（`PU`）、タンク（`TK`）、熱交換器（`HE`）など、2文字の識別コードを機器ごとに定義。
   - 機器一覧テーブルにおいて、**「機器番号」列の左隣に「機器種別」列** を常時表示。
2. **一括編集（Batch Edit）機能**:
   - 複数機器をチェック選択後、一括操作バーから以下を実行可能:
     - **機器種別の一括変更**: 2文字のアルファベットを入力し、対象機器を一括更新。変更履歴に「機器種別の一括更新」として自動記録。
     - **納期の一括変更**: カレンダーまたは任意テキストを入力し、対象機器の納期を一括更新。
     - **カテゴリ一括移動 / 一括削除**。
3. **変更メモ＆直結変更履歴ログ**:
   - 機器情報編集モーダル（`ItemEditModal`）において、フォーム下部に「変更理由・作業メモ」入力欄を配置。
   - その直下に、その機器固有の「変更履歴ログ一覧」をタイムライン形式で常時表示。変更前後の値、変更者、日時、メモを即座に確認可能。

### 4.3 テンプレート・マッピング設定機能
1. **仕様項目名の重複排除プルダウン**:
   - セル番地マッピングの項目名登録時、手入力を廃止し、現在機器データベースに登録されている全機器の仕様項目名（口径、耐圧、流量、材質等）から重複を除外してプルダウン候補を自動生成。
2. **4スロット並列マッピング**:
   - 1つの仕様項目に対して、以下の4つのセル番地を並列設定可能:
     - 1種類目（主仕様）セル番地（例: `C15`）
     - 2種類目 セル番地（例: `D15`）
     - 3種類目 セル番地（例: `E15`）
     - 4種類目 セル番地（例: `F15`）
3. **チェックボックス専用マッピング**:
   - チェックボックス値を出力するセル番地と、項目名を出力するラベルセル番地を個別に指定可能。
   - ON時の文字列（例: `☑ 要`、`要`、`○`）とOFF時の文字列（例: `☐ 不要`、`不要`、`-`）を自由に設定可能。
4. **基本情報マッピング**:
   - 案件名、仕様書番号、発行日、客先名、工事場所等の案件共通項目を個別のセル番地にバインド。

### 4.4 仕様書リアルタイム生成・プレビュー機能
1. **仕様書番号の自動生成ルール**:
   - 計算式: **`${案件コード}${機器種別}G-${機器番号}`**
   - 例: 案件コード `PRJ-2026-01`、機器種別 `VA`、機器番号 `V-101` の場合:
     $$\text{仕様書番号} = \text{PRJ-2026-01VAG-V-101}$$
   - 案件コードと機器種別の間にハイフンを入れず、種別末尾に「G」を付与。
2. **対象機器の複数選択**:
   - 仕様書に含める機器を複数選択可能。
   - 選択された機器の中から「主仕様（1種類目）」をラジオボタンで選択。追加された機器は自動的に2種類目〜4種類目としてスロットに割り当て。
3. **タブ切り替え式プレビュー**:
   - **「📄 PDF (仕様書帳票)」タブ**:
     - 実寸A4（794px × 1123px）の帳票レイアウトをキャンバス中央にドロップシャドウ付きで直接描画。
     - ヘッダー、案件情報、適用要件（チェック項目）、対象機器明細テーブル（機器種別、機器番号、名称、仕様、材質、数量、納期）、特記事項、承認印欄（承認/審査/担当）を完備。
     - 「🔄 再読み込み」ボタン押下により、入力データやマッピングの変更を瞬時に画面反映。
   - **「📊 EXCEL (原本直接描画)」タブ**:
     - ExcelJSがメモリ内に展開したスプレッドシートを行番号・列文字（A, B, C...）付きで直接描画。
     - 数式バー（`fx`）と連動し、セルをクリックすると番地・値・バインド項目が表示され、直接編集可能。
4. **統合出力ボタン (`[ ⬇️ 出力 ▼ ]`)**:
   - 出力アクションを1つのドロップダウンボタンに集約。
     - **📄 PDF出力 (.pdf)**: 画面上に描画されているA4帳票を直接キャプチャし、jsPDFでベクターPDFファイルとしてダウンロード。
     - **📊 Excel出力 (.xlsx)**: ExcelJSにより原本テンプレートバイナリに各セル値・明細行を注入し、原本と全く同じフォーマットのExcelファイルをダウンロード。

---

## 5. セキュリティ・信頼性設計
1. **クライアント完結型アーキテクチャ**:
   - すべてのExcelJS処理、DOMキャプチャ、PDF生成はブラウザのインメモリ上で高速実行。機密性の高いプラント機器仕様情報や図面番号が外部サーバへ送信されるリスクをゼロ化。
2. **離脱時データ保護**:
   - 未保存の変更が存在する状態でブラウザタブを閉じようとした場合、`beforeunload` イベントおよび `UnsavedChangesModal` が発火し、意図しないデータ消失を防止。
3. **完全な履歴保持**:
   - 変更履歴ログはタイムスタンプとともに不変配列として保管され、不正な改ざんを防止。

---
*以上が SpecForge システム設計仕様書となります。*
