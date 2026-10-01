package engine

import (
	"os"
	"os/exec"
	"path/filepath"
)

type WorkflowDef struct {
	Name   string
	Script string
}

func getWorkflows() []WorkflowDef {
	return []WorkflowDef{
		{
			Name: "7-Zip ile Buraya Çıkar.workflow",
			Script: `#!/bin/bash
BIN="$HOME/Library/Application Support/7zip-mac/bin/7zz"
if [ ! -x "$BIN" ]; then
    BIN="7zz"
fi

COUNT=0
for f in "$@"; do
    if [ -f "$f" ]; then
        DIR="$(dirname "$f")"
        OUT="$("$BIN" x "$f" -o"$DIR" -y -aoa 2>&1)"
        if echo "$OUT" | grep -qi "Wrong password"; then
            PASS=$(osascript -e 'Tell application "System Events" to display dialog "Arşiv şifresini girin:" default answer "" with hidden answer' -e 'text returned of result' 2>/dev/null)
            if [ -n "$PASS" ]; then
                "$BIN" x "$f" -o"$DIR" -p"$PASS" -y -aoa
            fi
        fi
        COUNT=$((COUNT + 1))
    fi
done

if [ "$COUNT" -gt 0 ]; then
    osascript -e "display notification \"$COUNT arşiv başarıyla çıkarıldı.\" with title \"7-Zip\" sound name \"Glass\"" 2>/dev/null || true
fi
`,
		},
		{
			Name: "7-Zip ile Sıkıştır (.7z).workflow",
			Script: `#!/bin/bash
BIN="$HOME/Library/Application Support/7zip-mac/bin/7zz"
if [ ! -x "$BIN" ]; then
    BIN="7zz"
fi

if [ "$#" -eq 0 ]; then
    exit 0
fi

FIRST="$1"
DIR="$(dirname "$FIRST")"
BASE="$(basename "$FIRST")"

if [ "$#" -eq 1 ]; then
    if [ -d "$FIRST" ]; then
        ARCHIVE="$DIR/$BASE.7z"
    else
        ARCHIVE="$DIR/${BASE%.*}.7z"
    fi
else
    ARCHIVE="$DIR/Arşiv.7z"
fi

"$BIN" a "$ARCHIVE" "$@" -y -mx=5
osascript -e "display notification \"$ARCHIVE oluşturuldu.\" with title \"7-Zip\" sound name \"Glass\"" 2>/dev/null || true
`,
		},
		{
			Name: "7-Zip ile Sıkıştır (.zip).workflow",
			Script: `#!/bin/bash
BIN="$HOME/Library/Application Support/7zip-mac/bin/7zz"
if [ ! -x "$BIN" ]; then
    BIN="7zz"
fi

if [ "$#" -eq 0 ]; then
    exit 0
fi

FIRST="$1"
DIR="$(dirname "$FIRST")"
BASE="$(basename "$FIRST")"

if [ "$#" -eq 1 ]; then
    if [ -d "$FIRST" ]; then
        ARCHIVE="$DIR/$BASE.zip"
    else
        ARCHIVE="$DIR/${BASE%.*}.zip"
    fi
else
    ARCHIVE="$DIR/Arşiv.zip"
fi

"$BIN" a -tzip "$ARCHIVE" "$@" -y -mx=5
osascript -e "display notification \"$ARCHIVE oluşturuldu.\" with title \"7-Zip\" sound name \"Glass\"" 2>/dev/null || true
`,
		},
		{
			Name: "7-Zip ile Aç.workflow",
			Script: `#!/bin/bash
APP="/Applications/7-Zip.app"
if [ ! -d "$APP" ]; then
    APP="$HOME/Desktop/7zip-mac/build/bin/7-Zip.app"
fi

for f in "$@"; do
    open -a "$APP" "$f"
done
`,
		},
	}
}

func generateWflowXML(script string) string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>523</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>` + escapeXML(script) + `</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>1</integer>
					<key>shell</key>
					<string>/bin/bash</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Category</key>
				<array>
					<string>AMCategoryUtilities</string>
				</array>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>F0F4E858-6E85-4E7B-B590-7F87667C8120</string>
				<key>Keywords</key>
				<array>
					<string>Shell</string>
					<string>Script</string>
					<string>Command</string>
					<string>Run</string>
					<string>Unix</string>
				</array>
				<key>OutputUUID</key>
				<string>E94BE2C0-569C-485F-8F0E-9C80D7BCE44B</string>
				<key>UUID</key>
				<string>17F7CC98-C48C-47E0-8041-3F634B54BFF6</string>
			</dict>
			<key>isViewVisible</key>
			<integer>1</integer>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>inputTypeIdentifier</key>
		<string>com.apple.Automator.fileSystemObject</string>
		<key>outputTypeIdentifier</key>
		<string>com.apple.Automator.nothing</string>
		<key>presentationMode</key>
		<integer>15</integer>
		<key>processesInput</key>
		<false/>
		<key>serviceApplicationBundleID</key>
		<string>com.apple.finder</string>
		<key>serviceApplicationPath</key>
		<string>/System/Library/CoreServices/Finder.app</string>
		<key>serviceInputTypeIdentifier</key>
		<string>com.apple.Automator.fileSystemObject</string>
		<key>serviceOutputTypeIdentifier</key>
		<string>com.apple.Automator.nothing</string>
		<key>serviceProcessesInput</key>
		<false/>
		<key>systemImageName</key>
		<string>NSTouchBarArchiveExtract</string>
		<key>useAutomaticInputType</key>
		<false/>
		<key>workflowTypeIdentifier</key>
		<string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>`
}

func generateInfoPlistXML(name string) string {
	cleanName := name
	if len(cleanName) > 9 && cleanName[len(cleanName)-9:] == ".workflow" {
		cleanName = cleanName[:len(cleanName)-9]
	}

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>English</string>
	<key>CFBundleIdentifier</key>
	<string>com.bysinbin.7zip.` + cleanName + `</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>` + cleanName + `</string>
	<key>CFBundlePackageType</key>
	<string>BNDL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>` + cleanName + `</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSPortName</key>
			<string>` + cleanName + `</string>
			<key>NSSendFileTypes</key>
			<array>
				<string>public.item</string>
			</array>
			<key>NSSendTypes</key>
			<array>
				<string>NSFilenamesPboardType</string>
			</array>
		</dict>
	</array>
</dict>
</plist>`
}

func escapeXML(s string) string {
	var out []rune
	for _, r := range s {
		switch r {
		case '&':
			out = append(out, []rune("&amp;")...)
		case '<':
			out = append(out, []rune("&lt;")...)
		case '>':
			out = append(out, []rune("&gt;")...)
		case '"':
			out = append(out, []rune("&quot;")...)
		case '\'':
			out = append(out, []rune("&apos;")...)
		default:
			out = append(out, r)
		}
	}
	return string(out)
}

// InstallFinderWorkflows installs all 4 Quick Actions into ~/Library/Services directly in Go
func InstallFinderWorkflows() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	servicesDir := filepath.Join(homeDir, "Library", "Services")
	if err := os.MkdirAll(servicesDir, 0755); err != nil {
		return err
	}

	for _, wf := range getWorkflows() {
		wfPath := filepath.Join(servicesDir, wf.Name)
		contentsPath := filepath.Join(wfPath, "Contents")
		if err := os.MkdirAll(contentsPath, 0755); err != nil {
			return err
		}

		wflowContent := generateWflowXML(wf.Script)
		if err := os.WriteFile(filepath.Join(contentsPath, "document.wflow"), []byte(wflowContent), 0644); err != nil {
			return err
		}

		infoContent := generateInfoPlistXML(wf.Name)
		if err := os.WriteFile(filepath.Join(contentsPath, "Info.plist"), []byte(infoContent), 0644); err != nil {
			return err
		}
	}

	// Register with LaunchServices
	lsregister := "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
	if _, err := os.Stat(lsregister); err == nil {
		_ = exec.Command(lsregister, "-f", "/Applications/7-Zip.app").Run()
	}

	// Refresh macOS services cache
	pbs := "/System/Library/CoreServices/pbs"
	if _, err := os.Stat(pbs); err == nil {
		_ = exec.Command(pbs, "-update").Run()
	}

	return nil
}

// UninstallFinderWorkflows removes all 7-Zip Quick Actions from ~/Library/Services
func UninstallFinderWorkflows() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	servicesDir := filepath.Join(homeDir, "Library", "Services")
	for _, wf := range getWorkflows() {
		wfPath := filepath.Join(servicesDir, wf.Name)
		_ = os.RemoveAll(wfPath)
	}

	pbs := "/System/Library/CoreServices/pbs"
	if _, err := os.Stat(pbs); err == nil {
		_ = exec.Command(pbs, "-update").Run()
	}

	return nil
}

// AreFinderWorkflowsInstalled checks if at least one workflow is present in ~/Library/Services
func AreFinderWorkflowsInstalled() bool {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	wfPath := filepath.Join(homeDir, "Library", "Services", "7-Zip ile Buraya Çıkar.workflow")
	_, err = os.Stat(wfPath)
	return err == nil
}
