#!/usr/bin/env bash
set -e

# Setup PATH
export PATH="$PATH:$(go env GOPATH)/bin:/Users/feritetem/homebrew/bin:/opt/homebrew/bin:/usr/local/bin"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "==> 7-Zip macOS Uygulaması Derleniyor..."

# 1. Generate JS module bindings
echo "==> Wails JS bağlayıcıları güncelleniyor..."
wails generate module

# 2. Compile Go binary with Wails
echo "==> Uygulama ikili dosyası derleniyor..."
wails build -nopackage

# 3. Assemble .app bundle structure
echo "==> macOS .app paketi hazırlanıyor..."
APP_BUNDLE="build/bin/7-Zip.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy binary into app bundle
cp "build/bin/7-Zip" "$APP_BUNDLE/Contents/MacOS/7-Zip"
chmod +x "$APP_BUNDLE/Contents/MacOS/7-Zip"

# Ensure icon and Info.plist exist
if [ -f "build/bin/iconfile.icns" ]; then
    cp "build/bin/iconfile.icns" "$APP_BUNDLE/Contents/Resources/iconfile.icns"
elif [ -f "build/appicon.png" ]; then
    cp "build/appicon.png" "$APP_BUNDLE/Contents/Resources/iconfile.png"
fi

# 4. Clean macOS extended attributes & codesign
echo "==> Genişletilmiş öznitelikler temizleniyor ve kod imzalanıyor..."
xattr -cr "$APP_BUNDLE" || true
codesign --force --deep --sign - "$APP_BUNDLE"

echo "==> Başarılı! 7-Zip macOS uygulaması hazır:"
echo "    -> $PROJECT_ROOT/$APP_BUNDLE"
