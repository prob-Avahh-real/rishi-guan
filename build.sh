#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌑 日食观 · Native App Builder"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/Cellar/openjdk@17/17.0.19/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

if [[ ! -d node_modules ]]; then
  echo "📦 安装依赖..."
  npm install
fi

cp -f index.html www/index.html
node scripts/build-web.js

if [[ ! -d ios ]]; then
  echo "🍎 初始化 iOS 平台..."
  npx cap add ios 2>/dev/null || true
fi
if [[ ! -d android ]]; then
  echo "🤖 初始化 Android 平台..."
  npx cap add android
fi

npx cap sync

echo ""
echo "✅ 构建完成！"
echo "  🍎 iOS:  open ios/App/App.xcworkspace"
echo "  🤖 APK:  cd android && ./gradlew assembleDebug"
