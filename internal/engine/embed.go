package engine

import (
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

//go:embed bin/7zz
var embedded7zz []byte

var (
	binaryPath string
	initOnce   sync.Once
	initErr    error
)

// GetBinaryPath returns the absolute path to the ready-to-run 7zz executable.
// If the binary hasn't been extracted yet, it extracts the embedded universal binary
// to ~/Library/Application Support/7zip-mac/bin/7zz and sets execute permissions.
func GetBinaryPath() (string, error) {
	initOnce.Do(func() {
		// 1. First, check if 7zz is available on the system PATH or Homebrew
		homebrewCandidates := []string{
			"/Users/feritetem/homebrew/bin/7zz",
			"/opt/homebrew/bin/7zz",
			"/usr/local/bin/7zz",
		}
		for _, candidate := range homebrewCandidates {
			if fi, err := os.Stat(candidate); err == nil && !fi.IsDir() && fi.Mode()&0111 != 0 {
				binaryPath = candidate
				return
			}
		}

		// 2. Otherwise extract and use embedded 7zz universal binary
		if len(embedded7zz) == 0 {
			initErr = fmt.Errorf("embedded 7zz binary is empty")
			return
		}

		homeDir, err := os.UserHomeDir()
		if err != nil {
			initErr = fmt.Errorf("could not determine user home directory: %w", err)
			return
		}

		targetDir := filepath.Join(homeDir, "Library", "Application Support", "7zip-mac", "bin")
		if err := os.MkdirAll(targetDir, 0755); err != nil {
			initErr = fmt.Errorf("could not create app support directory: %w", err)
			return
		}

		targetFile := filepath.Join(targetDir, "7zz")

		// Check if existing extracted file matches size
		if fi, err := os.Stat(targetFile); err == nil {
			if fi.Size() == int64(len(embedded7zz)) {
				_ = os.Chmod(targetFile, 0755)
				binaryPath = targetFile
				return
			}
		}

		// Write extracted binary
		tmpFile := targetFile + ".tmp"
		if err := os.WriteFile(tmpFile, embedded7zz, 0755); err != nil {
			initErr = fmt.Errorf("failed to write 7zz binary: %w", err)
			return
		}

		if err := os.Rename(tmpFile, targetFile); err != nil {
			initErr = fmt.Errorf("failed to finalize 7zz binary: %w", err)
			return
		}

		_ = os.Chmod(targetFile, 0755)
		binaryPath = targetFile
	})

	return binaryPath, initErr
}
