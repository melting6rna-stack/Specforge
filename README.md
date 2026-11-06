<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# SpecForge (機器特記仕様書作成・管理システム)

プラント配管・機械機器・土木配水管工事向けの機器データベースおよび特記仕様書作成Web/PWAアプリケーションです。
完全オフライン動作（ローカルファースト）、ExcelJSによるマスター雛形セル流し込み出力に対応しています。

View your app in AI Studio: https://ai.studio/apps/96b3f109-ccd5-4d1e-ac35-05504e97caf2

---

## 🚀 主な機能
- **機器データベース一元管理**: 機器名、数量、口径・出力・材質等の仕様パラメータ、納入時期、特記事項の管理
- **案件ごとのカテゴリ分離 & ドラッグ＆ドロップ並び替え**: 案件別にカテゴリを完全独立管理、直感的なD&Dによるカテゴリ分類
- **特記仕様書スキーマ(v1.1)完全対応**: 塗装仕様（1項目化）、アクション、要求事項の自動パース
- **ExcelJSによるマスター雛形流し込み出力**: 罫線・フォント・行高さ等のレイアウトを崩さず、マスターExcelの指定セル番地（B2, C8, E30等）に値を正確に流し込み
- **マッピング定義アセット (.specmap.json)**: 仕様書ごとのセル番地・チェックボックス定義・プルダウン選択肢をJSONファイルとしてエクスポート＆インポート
- **PWA（Progressive Web App）対応**: デスクトップアプリとしてPCにインストール可能、オフライン完全対応

---

## 💻 ローカルでの起動方法 (Run Locally)

**前提条件:** Node.js (v18以上推奨)

1. **リポジトリのクローンまたはダウンロード:**
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd <REPO_NAME>
   ```

2. **依存パッケージのインストール:**
   ```bash
   npm install
   ```

3. **ローカル開発サーバーの起動:**
   ```bash
   npm run dev
   ```
   ブラウザで `http://localhost:3000` を開きます。

4. **本番用ビルド:**
   ```bash
   npm run build
   ```
   `dist/` フォルダに静的Webアプリとして出力されます。GitHub PagesやローカルWebサーバーで即座に公開可能です。
