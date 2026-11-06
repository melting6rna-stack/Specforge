@echo off
chcp 65001 > nul
title SpecForge - 仕様書作成＆機器管理システム

echo ========================================================
echo   SpecForge - ローカル起動スクリプト (オフライン対応)
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js を検出しました。ローカルサーバーを起動します...
    if exist "dist\index.html" (
        echo ビルド済み dist フォルダからプレビュー起動中...
        start http://localhost:4173
        npx vite preview --port 4173
    ) else (
        echo 開発サーバーを起動中...
        start http://localhost:3000
        npm run dev
    )
    goto end
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python を検出しました。dist フォルダをサーバー起動します...
    start http://localhost:8000
    python -m http.server 8000 --directory dist
    goto end
)

echo.
echo 【お知らせ】
echo ローカルPCでZIPを開いて直接 index.html をダブルクリックすると、
echo ブラウザのセキュリティ制限(CORSポリシー/fileプロトコル制限)により真っ白になります。
echo.
echo 以下のいずれかの方法でご利用いただけます：
echo.
echo 【最も簡単な方法 (インストール不要)】
echo 1. Webブラウザ(ChromeまたはEdge)で本アプリのURLを開きます。
echo 2. アドレスバー右側の「インストール」アイコン(パソコンと矢印のマーク)をクリックします。
echo 3. デスクトップに「SpecForge」アプリがインストールされ、以降はネットを切断しても完全オフラインで起動できます。
echo.
echo 【ZIPから動かす場合】
echo 1. Node.js (https://nodejs.org/ja) をインストールしてください。
echo 2. このフォルダで「起動する.bat」を再度ダブルクリックしてください。
echo.
pause

:end
