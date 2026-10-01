package engine

import (
	"bufio"
	"path/filepath"
	"strconv"
	"strings"
)

// ParseListOutput parses the output of `7zz l -slt` into an ArchiveInfo struct.
func ParseListOutput(output string, originalPath string) (*ArchiveInfo, error) {
	info := &ArchiveInfo{
		Path:     originalPath,
		FileName: filepath.Base(originalPath),
		Entries:  make([]ArchiveEntry, 0),
	}

	scanner := bufio.NewScanner(strings.NewReader(output))
	var isHeader = true
	var currentBlock = make(map[string]string)

	flushBlock := func() {
		if len(currentBlock) == 0 {
			return
		}

		path := currentBlock["Path"]
		if path == "" {
			currentBlock = make(map[string]string)
			return
		}

		// Don't treat archive path itself as an entry
		if path == originalPath || path == info.Path {
			currentBlock = make(map[string]string)
			return
		}

		isFolder := currentBlock["Folder"] == "+" || strings.HasSuffix(path, "/") || strings.HasSuffix(path, "\\")
		size, _ := strconv.ParseInt(currentBlock["Size"], 10, 64)
		packedSize, _ := strconv.ParseInt(currentBlock["Packed Size"], 10, 64)
		isEncrypted := currentBlock["Encrypted"] == "+"

		cleanPath := strings.TrimSuffix(strings.ReplaceAll(path, "\\", "/"), "/")
		name := filepath.Base(cleanPath)
		parent := filepath.Dir(cleanPath)
		if parent == "." {
			parent = ""
		}

		ext := ""
		if !isFolder {
			ext = strings.ToLower(filepath.Ext(name))
		}

		entry := ArchiveEntry{
			Path:       cleanPath,
			Name:       name,
			Parent:     parent,
			Folder:     isFolder,
			Size:       size,
			PackedSize: packedSize,
			Modified:   currentBlock["Modified"],
			Attributes: currentBlock["Attributes"],
			CRC:        currentBlock["CRC"],
			Encrypted:  isEncrypted,
			Method:     currentBlock["Method"],
			Extension:  ext,
		}

		info.Entries = append(info.Entries, entry)

		if isFolder {
			info.TotalFolders++
		} else {
			info.TotalFiles++
			info.TotalUncompressedSize += size
			info.TotalPackedSize += packedSize
		}

		if isEncrypted {
			info.IsEncrypted = true
		}

		currentBlock = make(map[string]string)
	}

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		if trimmed == "----------" {
			if isHeader {
				isHeader = false
				currentBlock = make(map[string]string)
				continue
			} else {
				flushBlock()
				continue
			}
		}

		if trimmed == "" {
			if !isHeader && len(currentBlock) > 0 {
				flushBlock()
			}
			continue
		}

		parts := strings.SplitN(line, " = ", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		if isHeader {
			switch key {
			case "Type":
				info.Type = val
			case "Physical Size":
				info.PhysicalSize, _ = strconv.ParseInt(val, 10, 64)
			case "Headers Size":
				info.HeadersSize, _ = strconv.ParseInt(val, 10, 64)
			case "Method":
				info.Method = val
				if strings.Contains(strings.ToUpper(val), "AES") {
					info.IsEncrypted = true
				}
			case "Solid":
				info.Solid = val == "+"
			case "Blocks":
				info.Blocks, _ = strconv.Atoi(val)
			}
		} else {
			currentBlock[key] = val
		}
	}

	// Flush any pending trailing block
	flushBlock()

	if info.PhysicalSize == 0 && info.TotalPackedSize > 0 {
		info.PhysicalSize = info.TotalPackedSize
	}

	return info, nil
}
