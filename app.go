package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strings"
	"sync"

	"sevenzip/internal/engine"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct manages application state and interactions
type App struct {
	ctx            context.Context
	engine         *engine.Engine
	recentMu       sync.Mutex
	recentArchives []string
	cancelMu       sync.Mutex
	currentCancel  context.CancelFunc
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		engine:         engine.NewEngine(),
		recentArchives: make([]string, 0),
	}
}

// startup is called at application startup
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Load recent archives from disk
	a.loadRecentArchives()

	// Ensure 7zz binary is ready in background
	go func() {
		_, _ = engine.GetBinaryPath()
	}()

	// Register native file drop listener
	wailsruntime.OnFileDrop(ctx, func(x, y int, paths []string) {
		if len(paths) > 0 {
			wailsruntime.EventsEmit(ctx, "file:dropped", paths)
		}
	})
}

// SelectArchiveFile prompts user to select an existing archive file
func (a *App) SelectArchiveFile() (string, error) {
	homeDir, _ := os.UserHomeDir()
	path, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Arşiv Dosyası Seç",
		DefaultDirectory: homeDir,
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: "Desteklenen Arşivler (*.7z, *.zip, *.rar, *.tar...)",
				Pattern:     "*.7z;*.zip;*.rar;*.tar;*.gz;*.tgz;*.bz2;*.tbz2;*.xz;*.txz;*.iso;*.dmg;*.cab;*.zst;*.jar;*.apk;*.wim",
			},
			{
				DisplayName: "7-Zip Arşivleri (*.7z)",
				Pattern:     "*.7z",
			},
			{
				DisplayName: "Zip Arşivleri (*.zip)",
				Pattern:     "*.zip",
			},
			{
				DisplayName: "Tüm Dosyalar (*.*)",
				Pattern:     "*.*",
			},
		},
	})
	return path, err
}

// SelectFilesToCompress prompts user to select one or multiple files to compress
func (a *App) SelectFilesToCompress() ([]string, error) {
	homeDir, _ := os.UserHomeDir()
	paths, err := wailsruntime.OpenMultipleFilesDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Sıkıştırılacak Dosyaları Seç",
		DefaultDirectory: homeDir,
	})
	return paths, err
}

// SelectFolderToCompress prompts user to select a single folder to compress
func (a *App) SelectFolderToCompress() (string, error) {
	homeDir, _ := os.UserHomeDir()
	path, err := wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Sıkıştırılacak Klasörü Seç",
		DefaultDirectory: homeDir,
	})
	return path, err
}

// SelectSaveArchivePath prompts user for save destination of a new archive
func (a *App) SelectSaveArchivePath(defaultName, format string) (string, error) {
	homeDir, _ := os.UserHomeDir()
	if defaultName == "" {
		defaultName = "archive"
	}
	if format == "" {
		format = "7z"
	}
	defaultFilename := defaultName
	if !strings.HasSuffix(strings.ToLower(defaultFilename), "."+strings.ToLower(format)) {
		defaultFilename = defaultFilename + "." + format
	}

	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:            "Arşivin Kaydedileceği Yeri Seç",
		DefaultDirectory: filepath.Join(homeDir, "Desktop"),
		DefaultFilename:  defaultFilename,
		Filters: []wailsruntime.FileFilter{
			{
				DisplayName: strings.ToUpper(format) + " Arşivi (*." + format + ")",
				Pattern:     "*." + format,
			},
			{
				DisplayName: "Tüm Dosyalar (*.*)",
				Pattern:     "*.*",
			},
		},
	})
	return path, err
}

// SelectOutputDirectory prompts user to select a folder for extraction
func (a *App) SelectOutputDirectory(defaultPath string) (string, error) {
	if defaultPath == "" {
		homeDir, _ := os.UserHomeDir()
		defaultPath = filepath.Join(homeDir, "Downloads")
	}
	path, err := wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:            "Çıkarma Klasörünü Seç",
		DefaultDirectory: defaultPath,
	})
	return path, err
}

// OpenArchive reads and returns the metadata and contents of an archive
func (a *App) OpenArchive(archivePath string, password string) (*engine.ArchiveInfo, error) {
	info, err := a.engine.List(archivePath, password)
	if err != nil {
		if err == engine.ErrPasswordRequired {
			return nil, fmt.Errorf("PASSWORD_REQUIRED")
		}
		if err == engine.ErrWrongPassword {
			return nil, fmt.Errorf("WRONG_PASSWORD")
		}
		return nil, err
	}

	a.addRecentArchive(archivePath)
	return info, nil
}

// ExtractArchive unpacks an archive with progress reporting
func (a *App) ExtractArchive(opts engine.ExtractOptions) error {
	ctx, cancel := context.WithCancel(context.Background())
	a.setCancelFunc(cancel)
	defer a.clearCancelFunc()

	err := a.engine.Extract(ctx, opts, func(update engine.ProgressUpdate) {
		wailsruntime.EventsEmit(a.ctx, "extract:progress", update)
	})

	if err != nil {
		if err == engine.ErrPasswordRequired {
			wailsruntime.EventsEmit(a.ctx, "extract:error", "PASSWORD_REQUIRED")
			return fmt.Errorf("PASSWORD_REQUIRED")
		}
		if err == engine.ErrWrongPassword {
			wailsruntime.EventsEmit(a.ctx, "extract:error", "WRONG_PASSWORD")
			return fmt.Errorf("WRONG_PASSWORD")
		}
		wailsruntime.EventsEmit(a.ctx, "extract:error", err.Error())
		return err
	}

	wailsruntime.EventsEmit(a.ctx, "extract:complete", opts.OutputDir)
	return nil
}

// CompressArchive creates a new archive with progress reporting
func (a *App) CompressArchive(opts engine.CompressOptions) error {
	ctx, cancel := context.WithCancel(context.Background())
	a.setCancelFunc(cancel)
	defer a.clearCancelFunc()

	err := a.engine.Compress(ctx, opts, func(update engine.ProgressUpdate) {
		wailsruntime.EventsEmit(a.ctx, "compress:progress", update)
	})

	if err != nil {
		wailsruntime.EventsEmit(a.ctx, "compress:error", err.Error())
		return err
	}

	wailsruntime.EventsEmit(a.ctx, "compress:complete", opts.ArchivePath)
	a.addRecentArchive(opts.ArchivePath)
	return nil
}

// TestArchive tests the integrity of an archive
func (a *App) TestArchive(archivePath string, password string) (*engine.TestResult, error) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	result, err := a.engine.Test(ctx, archivePath, password)
	if err != nil {
		if err == engine.ErrWrongPassword {
			return nil, fmt.Errorf("WRONG_PASSWORD")
		}
		return nil, err
	}
	return result, nil
}

// CancelOperation cancels any active extraction or compression operation
func (a *App) CancelOperation() {
	a.cancelMu.Lock()
	defer a.cancelMu.Unlock()
	if a.currentCancel != nil {
		a.currentCancel()
		a.currentCancel = nil
	}
}

func (a *App) setCancelFunc(cancel context.CancelFunc) {
	a.cancelMu.Lock()
	defer a.cancelMu.Unlock()
	a.currentCancel = cancel
}

func (a *App) clearCancelFunc() {
	a.cancelMu.Lock()
	defer a.cancelMu.Unlock()
	a.currentCancel = nil
}

// RevealInFinder highlights the file or folder in macOS Finder
func (a *App) RevealInFinder(path string) error {
	return exec.Command("open", "-R", path).Run()
}

// OpenFolder opens the directory in macOS Finder
func (a *App) OpenFolder(path string) error {
	return exec.Command("open", path).Run()
}

// GetRecentArchives returns the list of recently opened/created archives
func (a *App) GetRecentArchives() []string {
	a.recentMu.Lock()
	defer a.recentMu.Unlock()
	res := make([]string, len(a.recentArchives))
	copy(res, a.recentArchives)
	return res
}

// ClearRecentArchives clears the history
func (a *App) ClearRecentArchives() {
	a.recentMu.Lock()
	a.recentArchives = make([]string, 0)
	a.recentMu.Unlock()
	a.saveRecentArchives()
}

func (a *App) addRecentArchive(path string) {
	a.recentMu.Lock()
	defer a.recentMu.Unlock()

	var updated []string
	updated = append(updated, path)
	for _, p := range a.recentArchives {
		if p != path && len(updated) < 15 {
			updated = append(updated, p)
		}
	}
	a.recentArchives = updated
	go a.saveRecentArchives()
}

func (a *App) getHistoryFilePath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, "Library", "Application Support", "7zip-mac", "recent.json")
}

func (a *App) loadRecentArchives() {
	historyPath := a.getHistoryFilePath()
	data, err := os.ReadFile(historyPath)
	if err != nil {
		return
	}
	var loaded []string
	if err := json.Unmarshal(data, &loaded); err == nil {
		a.recentMu.Lock()
		a.recentArchives = loaded
		a.recentMu.Unlock()
	}
}

func (a *App) saveRecentArchives() {
	historyPath := a.getHistoryFilePath()
	_ = os.MkdirAll(filepath.Dir(historyPath), 0755)

	a.recentMu.Lock()
	data, err := json.Marshal(a.recentArchives)
	a.recentMu.Unlock()

	if err == nil {
		_ = os.WriteFile(historyPath, data, 0644)
	}
}

// GetSystemInfo returns system environment details
func (a *App) GetSystemInfo() map[string]interface{} {
	binPath, _ := engine.GetBinaryPath()
	homeDir, _ := os.UserHomeDir()
	return map[string]interface{}{
		"os":        goruntime.GOOS,
		"arch":      goruntime.GOARCH,
		"goVersion": goruntime.Version(),
		"cores":     goruntime.NumCPU(),
		"homeDir":   homeDir,
		"binPath":   binPath,
	}
}

// InstallFinderActions installs Finder Quick Actions workflows into ~/Library/Services
func (a *App) InstallFinderActions() (string, error) {
	cmd := exec.Command("python3", "scripts/generate_workflows.py")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to install Finder actions: %s (%w)", string(out), err)
	}
	return "Finder sağ tık eylemleri başarıyla kuruldu!", nil
}

// UninstallFinderActions removes Finder Quick Actions workflows from ~/Library/Services
func (a *App) UninstallFinderActions() (string, error) {
	cmd := exec.Command("python3", "scripts/generate_workflows.py", "uninstall")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to uninstall Finder actions: %s (%w)", string(out), err)
	}
	return "Finder sağ tık eylemleri kaldırıldı.", nil
}

// CheckFinderActionsInstalled checks whether 7-Zip workflows are currently installed
func (a *App) CheckFinderActionsInstalled() bool {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	wfPath := filepath.Join(homeDir, "Library", "Services", "7-Zip ile Buraya Çıkar.workflow")
	_, err = os.Stat(wfPath)
	return err == nil
}

