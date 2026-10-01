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

# Derleme Artıklarını Temizle
clean:
	@rm -rf build/bin
	@go clean
