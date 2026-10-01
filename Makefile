.PHONY: all build run dev test clean

all: build

# 7-Zip macOS Uygulamasını Derle
build:
	@./scripts/build_app.sh

# Uygulamayı Çalıştır
run:
	@open build/bin/7-Zip.app

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

