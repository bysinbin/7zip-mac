package engine

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	ErrPasswordRequired = errors.New("PASSWORD_REQUIRED")
	ErrWrongPassword    = errors.New("WRONG_PASSWORD")
	ErrArchiveCorrupted = errors.New("ARCHIVE_CORRUPTED")
)

var (
	progressRegex = regexp.MustCompile(`^\s*(\d+)%\s*(?:\d+)?\s*(?:\+\s*(.+))?`)
)

// Engine wraps the 7zz CLI executor
type Engine struct {
	mu sync.Mutex
}

// NewEngine creates a new Engine instance
func NewEngine() *Engine {
	return &Engine{}
}

// List inspects an archive and returns its detailed structure
func (e *Engine) List(archivePath string, password string) (*ArchiveInfo, error) {
	binPath, err := GetBinaryPath()
	if err != nil {
		return nil, fmt.Errorf("7zz binary unavailable: %w", err)
	}

	args := []string{"l", "-slt", "-y"}
	if password != "" {
		args = append(args, "-p"+password)
	} else {
		// Non-interactive fallback
		args = append(args, "-p")
	}
	args = append(args, archivePath)

	cmd := exec.Command(binPath, args...)
	outputBytes, err := cmd.CombinedOutput()
	outputStr := string(outputBytes)

	if strings.Contains(outputStr, "Cannot open encrypted archive") ||
		strings.Contains(outputStr, "Wrong password") ||
		strings.Contains(outputStr, "Headers Error") {
		if password == "" {
			return nil, ErrPasswordRequired
		}
		return nil, ErrWrongPassword
	}

	if err != nil && !strings.Contains(outputStr, "Listing archive:") {
		return nil, fmt.Errorf("failed to read archive: %s (%w)", strings.TrimSpace(outputStr), err)
	}

	info, err := ParseListOutput(outputStr, archivePath)
	if err != nil {
		return nil, err
	}

	return info, nil
}

// Extract extracts files from an archive to the specified target directory
func (e *Engine) Extract(ctx context.Context, opts ExtractOptions, onProgress func(ProgressUpdate)) error {
	binPath, err := GetBinaryPath()
	if err != nil {
		return fmt.Errorf("7zz binary unavailable: %w", err)
	}

	args := []string{"x", opts.ArchivePath, "-o" + opts.OutputDir, "-y", "-bsp1", "-bb1"}

	if opts.Password != "" {
		args = append(args, "-p"+opts.Password)
	} else {
		args = append(args, "-p")
	}

	switch opts.OverwriteMode {
	case "skip":
		args = append(args, "-aos")
	case "rename":
		args = append(args, "-aou")
	default: // overwrite
		args = append(args, "-aoa")
	}

	if len(opts.SelectedFiles) > 0 {
		args = append(args, opts.SelectedFiles...)
	}

	cmd := exec.CommandContext(ctx, binPath, args...)

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("cannot start extraction: %w", err)
	}

	if onProgress != nil {
		onProgress(ProgressUpdate{
			Operation: "extract",
			Percent:   0,
			Status:    "running",
			Message:   "Starting extraction...",
		})
	}

	var errorLines []string
	var errMu sync.Mutex

	// Monitor stderr
	go func() {
		scanner := bufio.NewScanner(stderrPipe)
		for scanner.Scan() {
			line := scanner.Text()
			errMu.Lock()
			errorLines = append(errorLines, line)
			errMu.Unlock()
		}
	}()

	// Monitor stdout for progress
	reader := bufio.NewReader(stdoutPipe)
	for {
		line, err := reader.ReadString('\r')
		if len(line) > 0 {
			line = strings.TrimSpace(line)
			if matches := progressRegex.FindStringSubmatch(line); len(matches) > 1 {
				percent, _ := strconv.Atoi(matches[1])
				currentFile := ""
				if len(matches) > 2 {
					currentFile = strings.TrimSpace(matches[2])
				}
				if onProgress != nil {
					onProgress(ProgressUpdate{
						Operation:   "extract",
						Percent:     percent,
						CurrentFile: currentFile,
						Status:      "running",
						Message:     fmt.Sprintf("Extracting %d%%", percent),
					})
				}
			}
		}
		if err != nil {
			break
		}
	}

	waitErr := cmd.Wait()

	errMu.Lock()
	errCombined := strings.Join(errorLines, "\n")
	errMu.Unlock()

	if strings.Contains(errCombined, "Wrong password") || strings.Contains(errCombined, "Data Error in encrypted file") {
		if opts.Password == "" {
			return ErrPasswordRequired
		}
		return ErrWrongPassword
	}

	if waitErr != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if errCombined != "" {
			return fmt.Errorf("extraction error: %s", errCombined)
		}
		return waitErr
	}

	if onProgress != nil {
		onProgress(ProgressUpdate{
			Operation: "extract",
			Percent:   100,
			Status:    "completed",
			Message:   "Extraction completed successfully!",
		})
	}

	return nil
}

// Compress creates an archive from input files
func (e *Engine) Compress(ctx context.Context, opts CompressOptions, onProgress func(ProgressUpdate)) error {
	binPath, err := GetBinaryPath()
	if err != nil {
		return fmt.Errorf("7zz binary unavailable: %w", err)
	}

	args := []string{"a", opts.ArchivePath}

	if opts.Format != "" {
		args = append(args, "-t"+opts.Format)
	}

	if opts.Level >= 0 && opts.Level <= 9 {
		args = append(args, fmt.Sprintf("-mx=%d", opts.Level))
	}

	if opts.Method != "" {
		args = append(args, "-m0="+opts.Method)
	}

	if opts.Password != "" {
		args = append(args, "-p"+opts.Password)
		if opts.EncryptHeader && (opts.Format == "7z" || strings.HasSuffix(strings.ToLower(opts.ArchivePath), ".7z")) {
			args = append(args, "-mhe=on")
		}
	}

	if opts.VolumeSize != "" {
		args = append(args, "-v"+opts.VolumeSize)
	}

	if opts.Threads > 0 {
		args = append(args, fmt.Sprintf("-mmt=%d", opts.Threads))
	}

	args = append(args, "-y", "-bsp1", "-bb1")
	args = append(args, opts.InputPaths...)

	cmd := exec.CommandContext(ctx, binPath, args...)

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("cannot start compression: %w", err)
	}

	if onProgress != nil {
		onProgress(ProgressUpdate{
			Operation: "compress",
			Percent:   0,
			Status:    "running",
			Message:   "Starting compression...",
		})
	}

	var errorLines []string
	var errMu sync.Mutex

	go func() {
		scanner := bufio.NewScanner(stderrPipe)
		for scanner.Scan() {
			line := scanner.Text()
			errMu.Lock()
			errorLines = append(errorLines, line)
			errMu.Unlock()
		}
	}()

	reader := bufio.NewReader(stdoutPipe)
	for {
		line, err := reader.ReadString('\r')
		if len(line) > 0 {
			line = strings.TrimSpace(line)
			if matches := progressRegex.FindStringSubmatch(line); len(matches) > 1 {
				percent, _ := strconv.Atoi(matches[1])
				currentFile := ""
				if len(matches) > 2 {
					currentFile = strings.TrimSpace(matches[2])
				}
				if onProgress != nil {
					onProgress(ProgressUpdate{
						Operation:   "compress",
						Percent:     percent,
						CurrentFile: currentFile,
						Status:      "running",
						Message:     fmt.Sprintf("Compressing %d%%", percent),
					})
				}
			}
		}
		if err != nil {
			break
		}
	}

	waitErr := cmd.Wait()

	errMu.Lock()
	errCombined := strings.Join(errorLines, "\n")
	errMu.Unlock()

	if waitErr != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if errCombined != "" {
			return fmt.Errorf("compression error: %s", errCombined)
		}
		return waitErr
	}

	if onProgress != nil {
		onProgress(ProgressUpdate{
			Operation: "compress",
			Percent:   100,
			Status:    "completed",
			Message:   "Archive created successfully!",
		})
	}

	return nil
}

// Test verifies the integrity of an archive
func (e *Engine) Test(ctx context.Context, archivePath string, password string) (*TestResult, error) {
	binPath, err := GetBinaryPath()
	if err != nil {
		return nil, fmt.Errorf("7zz binary unavailable: %w", err)
	}

	start := time.Now()
	args := []string{"t", archivePath, "-y"}
	if password != "" {
		args = append(args, "-p"+password)
	} else {
		args = append(args, "-p")
	}

	cmd := exec.CommandContext(ctx, binPath, args...)
	out, err := cmd.CombinedOutput()
	outStr := string(out)
	duration := time.Since(start).Round(time.Millisecond).String()

	if strings.Contains(outStr, "Wrong password") || strings.Contains(outStr, "Data Error in encrypted file") {
		return &TestResult{
			Success:  false,
			Errors:   []string{"Wrong password or password required."},
			Message:  "Decryption failed.",
			Duration: duration,
		}, ErrWrongPassword
	}

	if err != nil || strings.Contains(outStr, "Errors:") || strings.Contains(outStr, "Sub items Errors:") {
		var errs []string
		lines := strings.Split(outStr, "\n")
		for _, l := range lines {
			if strings.Contains(l, "ERROR:") || strings.Contains(l, "Errors:") {
				errs = append(errs, strings.TrimSpace(l))
			}
		}
		return &TestResult{
			Success:  false,
			Errors:   errs,
			Message:  "Archive has errors or is corrupted.",
			Duration: duration,
		}, nil
	}

	return &TestResult{
		Success:  true,
		Message:  "Everything is Ok! Archive integrity verified.",
		Duration: duration,
	}, nil
}
