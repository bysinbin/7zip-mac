package engine

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestEngineLifecycle(t *testing.T) {
	binPath, err := GetBinaryPath()
	if err != nil {
		t.Fatalf("GetBinaryPath failed: %v", err)
	}
	t.Logf("Using binary at: %s", binPath)

	tempDir, err := os.MkdirTemp("", "7zip-test-*")
	if err != nil {
		t.Fatalf("os.MkdirTemp failed: %v", err)
	}
	defer os.RemoveAll(tempDir)

	file1 := filepath.Join(tempDir, "file1.txt")
	file2 := filepath.Join(tempDir, "file2.txt")
	if err := os.WriteFile(file1, []byte("Content of file 1"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file2, []byte("Content of file 2 with more bytes"), 0644); err != nil {
		t.Fatal(err)
	}

	archivePath := filepath.Join(tempDir, "test.7z")
	eng := NewEngine()

	// 1. Test Compress
	err = eng.Compress(context.Background(), CompressOptions{
		InputPaths: []string{file1, file2},
		ArchivePath: archivePath,
		Format:      "7z",
		Level:       5,
		Method:      "LZMA2",
	}, func(u ProgressUpdate) {
		t.Logf("Compress progress: %d%% (%s)", u.Percent, u.Message)
	})
	if err != nil {
		t.Fatalf("Compress failed: %v", err)
	}

	// 2. Test List
	info, err := eng.List(archivePath, "")
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if info.TotalFiles != 2 {
		t.Fatalf("Expected 2 files, got %d", info.TotalFiles)
	}
	t.Logf("Listed archive: %d files, total size %d bytes", info.TotalFiles, info.TotalUncompressedSize)

	// 3. Test TestArchive
	testRes, err := eng.Test(context.Background(), archivePath, "")
	if err != nil {
		t.Fatalf("TestArchive failed: %v", err)
	}
	if !testRes.Success {
		t.Fatalf("TestArchive reported failure: %s", testRes.Message)
	}

	// 4. Test Extract
	extractDir := filepath.Join(tempDir, "extracted")
	err = eng.Extract(context.Background(), ExtractOptions{
		ArchivePath: archivePath,
		OutputDir:   extractDir,
	}, func(u ProgressUpdate) {
		t.Logf("Extract progress: %d%% (%s)", u.Percent, u.Message)
	})
	if err != nil {
		t.Fatalf("Extract failed: %v", err)
	}

	// Verify extracted files
	ext1 := filepath.Join(extractDir, "file1.txt")
	content, err := os.ReadFile(ext1)
	if err != nil {
		t.Fatalf("Failed to read extracted file1: %v", err)
	}
	if string(content) != "Content of file 1" {
		t.Fatalf("Content mismatch: %s", string(content))
	}
	t.Log("Engine lifecycle test passed successfully!")
}
