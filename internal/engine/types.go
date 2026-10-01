package engine

// ArchiveEntry represents a single item inside an archive
type ArchiveEntry struct {
	Path        string `json:"path"`
	Name        string `json:"name"`
	Parent      string `json:"parent"`
	Folder      bool   `json:"folder"`
	Size        int64  `json:"size"`
	PackedSize  int64  `json:"packedSize"`
	Modified    string `json:"modified"`
	Attributes  string `json:"attributes"`
	CRC         string `json:"crc"`
	Encrypted   bool   `json:"encrypted"`
	Method      string `json:"method"`
	Extension   string `json:"extension"`
}

// ArchiveInfo represents complete metadata of an archive
type ArchiveInfo struct {
	Path                  string         `json:"path"`
	FileName              string         `json:"fileName"`
	Type                  string         `json:"type"`
	PhysicalSize          int64          `json:"physicalSize"`
	HeadersSize           int64          `json:"headersSize"`
	Method                string         `json:"method"`
	Solid                 bool           `json:"solid"`
	Blocks                int            `json:"blocks"`
	TotalFiles            int            `json:"totalFiles"`
	TotalFolders          int            `json:"totalFolders"`
	TotalUncompressedSize int64          `json:"totalUncompressedSize"`
	TotalPackedSize       int64          `json:"totalPackedSize"`
	IsEncrypted           bool           `json:"isEncrypted"`
	Entries               []ArchiveEntry `json:"entries"`
}

// ExtractOptions specifies options for unpacking an archive
type ExtractOptions struct {
	ArchivePath   string   `json:"archivePath"`
	OutputDir     string   `json:"outputDir"`
	Password      string   `json:"password"`
	SelectedFiles []string `json:"selectedFiles"`
	OverwriteMode string   `json:"overwriteMode"` // "overwrite", "skip", "rename"
}

// CompressOptions specifies options for creating an archive
type CompressOptions struct {
	InputPaths    []string `json:"inputPaths"`
	ArchivePath   string   `json:"archivePath"`
	Format        string   `json:"format"` // "7z", "zip", "tar", "gzip", "bzip2", "xz"
	Level         int      `json:"level"`  // 0, 1, 3, 5, 7, 9
	Method        string   `json:"method"` // "LZMA2", "LZMA", "Deflate", "BZip2", etc.
	Password      string   `json:"password"`
	EncryptHeader bool     `json:"encryptHeader"`
	VolumeSize    string   `json:"volumeSize"` // "10m", "100m", "700m", "4480m", ""
	Threads       int      `json:"threads"`    // 0 for default
}

// ProgressUpdate represents ongoing extraction/compression progress
type ProgressUpdate struct {
	Operation      string `json:"operation"` // "extract" or "compress"
	Percent        int    `json:"percent"`
	CurrentFile    string `json:"currentFile"`
	TotalFiles     int    `json:"totalFiles"`
	ProcessedFiles int    `json:"processedFiles"`
	Status         string `json:"status"` // "starting", "running", "completed", "error"
	Message        string `json:"message"`
}

// TestResult represents archive integrity test results
type TestResult struct {
	Success  bool     `json:"success"`
	Errors   []string `json:"errors"`
	Message  string   `json:"message"`
	Duration string   `json:"duration"`
}
