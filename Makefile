.PHONY: all build run dev test clean

all: build

# 7-Zip macOS Uygulamasını Derle
build:
	@./scripts/build_app.sh

# Uygulamayı Çalıştır
run:
	@open /Applications/7-Zip.app 2>/dev/null || open build/bin/7-Zip.app

# /Applications Klasörüne Kur
install: build
	@cp -R build/bin/7-Zip.app /Applications/7-Zip.app
	@/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f /Applications/7-Zip.app
	@python3 scripts/generate_workflows.py
	@echo "==> 7-Zip başarıyla /Applications klasörüne kuruldu ve Finder entegrasyonu güncellendi!"


# Canlı Geliştirme Modu (Live Reload)
dev:
	@export PATH="$$PATH:$$(go env GOPATH)/bin:/Users/feritetem/homebrew/bin:/opt/homebrew/bin"; wails dev

# Birim Testlerini Çalıştır
test:
	@go test -v ./...

# Finder Sağ Tık (Hızlı Eylemler) Entegrasyonunu Yükle
install-finder-actions:
	@python3 scripts/generate_workflows.py

# Finder Sağ Tık Entegrasyonunu Kaldır
uninstall-finder-actions:
	@python3 scripts/generate_workflows.py uninstall

# Derleme Artıklarını Temizle
clean:
	@rm -rf build/bin
	@go clean

