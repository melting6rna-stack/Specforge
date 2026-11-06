#!/bin/bash
echo "SpecForge - ローカル起動スクリプト"

if command -v node >/dev/null 2>&1; then
    echo "Node.js を検出しました。起動します..."
    if [ -d "dist" ]; then
        npx vite preview --port 4173 &
        sleep 1
        open http://localhost:4173 2>/dev/null || xdg-open http://localhost:4173 2>/dev/null
    else
        npm run dev
    fi
elif command -v python3 >/dev/null 2>&1; then
    echo "Python3 を検出しました。dist サーバーを起動します..."
    cd dist && python3 -m http.server 8000 &
    sleep 1
    open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000 2>/dev/null
else
    echo "Node.js または Python が必要です。"
fi
