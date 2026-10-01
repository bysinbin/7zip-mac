#!/usr/bin/env python3
import os
import sys
import plistlib
import subprocess
import shutil

SERVICES_DIR = os.path.expanduser("~/Library/Services")

WORKFLOWS = [
    {
        "name": "7-Zip ile Buraya Çıkar.workflow",
        "script": '''#!/bin/bash
BIN="$HOME/Library/Application Support/7zip-mac/bin/7zz"
if [ ! -x "$BIN" ]; then
    BIN="/Users/feritetem/Desktop/7zip-mac/internal/engine/bin/7zz"
fi
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
'''
    },
    {
        "name": "7-Zip ile Sıkıştır (.7z).workflow",
        "script": '''#!/bin/bash
BIN="$HOME/Library/Application Support/7zip-mac/bin/7zz"
if [ ! -x "$BIN" ]; then
    BIN="/Users/feritetem/Desktop/7zip-mac/internal/engine/bin/7zz"
fi
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
'''
    },
    {
        "name": "7-Zip ile Sıkıştır (.zip).workflow",
        "script": '''#!/bin/bash
BIN="$HOME/Library/Application Support/7zip-mac/bin/7zz"
if [ ! -x "$BIN" ]; then
    BIN="/Users/feritetem/Desktop/7zip-mac/internal/engine/bin/7zz"
fi
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
'''
    },
    {
        "name": "7-Zip ile Aç.workflow",
        "script": '''#!/bin/bash
APP="/Applications/7-Zip.app"
if [ ! -d "$APP" ]; then
    APP="/Users/feritetem/Desktop/7zip-mac/build/bin/7-Zip.app"
fi

for f in "$@"; do
    open -a "$APP" "$f"
done
'''
    }
]

def make_wflow(script_content):
    return {
        "AMApplicationBuild": "523",
        "AMApplicationVersion": "2.10",
        "AMDocumentVersion": "2",
        "actions": [
            {
                "action": {
                    "ActionBundlePath": "/System/Library/Automator/Run Shell Script.action",
                    "ActionName": "Run Shell Script",
                    "ActionParameters": {
                        "COMMAND_STRING": script_content,
                        "CheckedForUserDefaultShell": True,
                        "inputMethod": 1,
                        "shell": "/bin/bash",
                        "source": ""
                    },
                    "BundleIdentifier": "com.apple.RunShellScript",
                    "CFBundleVersion": "2.0.3",
                    "CanShowSelectedItemsWhenRun": False,
                    "CanShowWhenRun": True,
                    "Category": ["AMCategoryUtilities"],
                    "Class Name": "RunShellScriptAction",
                    "InputUUID": "F0F4E858-6E85-4E7B-B590-7F87667C8120",
                    "Keywords": ["Shell", "Script", "Command", "Run", "Unix"],
                    "OutputUUID": "E94BE2C0-569C-485F-8F0E-9C80D7BCE44B",
                    "UUID": "17F7CC98-C48C-47E0-8041-3F634B54BFF6",
                    "arguments": {
                        "0": {"default value": 0, "name": "inputMethod", "required": "0", "type": "0", "value": 1},
                        "1": {"default value": "", "name": "source", "required": "0", "type": "0"},
                        "2": {"default value": False, "name": "CheckedForUserDefaultShell", "required": "0", "type": "0", "value": True},
                        "3": {"default value": "", "name": "COMMAND_STRING", "required": "0", "type": "0", "value": script_content},
                        "4": {"default value": "/bin/sh", "name": "shell", "required": "0", "type": "0", "value": "/bin/bash"}
                    },
                    "isViewVisible": 1,
                    "location": "309.000000:305.000000"
                },
                "isViewVisible": 1
            }
        ],
        "connectors": {},
        "workflowMetaData": {
            "applicationBundleIDsByPath": {},
            "applicationPaths": [],
            "inputTypeIdentifier": "com.apple.Automator.fileSystemObject",
            "outputTypeIdentifier": "com.apple.Automator.nothing",
            "presentationMode": 15,
            "processesInput": False,
            "serviceApplicationBundleID": "com.apple.finder",
            "serviceApplicationPath": "/System/Library/CoreServices/Finder.app",
            "serviceInputTypeIdentifier": "com.apple.Automator.fileSystemObject",
            "serviceOutputTypeIdentifier": "com.apple.Automator.nothing",
            "serviceProcessesInput": False,
            "systemImageName": "NSTouchBarArchiveExtract",
            "useAutomaticInputType": False,
            "workflowTypeIdentifier": "com.apple.Automator.servicesMenu"
        }
    }

def install():
    os.makedirs(SERVICES_DIR, exist_ok=True)
    for wf in WORKFLOWS:
        wf_path = os.path.join(SERVICES_DIR, wf["name"])
        contents_path = os.path.join(wf_path, "Contents")
        os.makedirs(contents_path, exist_ok=True)

        wflow_file = os.path.join(contents_path, "document.wflow")
        wflow_data = make_wflow(wf["script"])
        with open(wflow_file, "wb") as f:
            plistlib.dump(wflow_data, f)

        # Write Info.plist
        info_file = os.path.join(contents_path, "Info.plist")
        info_data = {
            "CFBundleDevelopmentRegion": "English",
            "CFBundleIdentifier": f"com.bysinbin.7zip.{wf['name']}",
            "CFBundleInfoDictionaryVersion": "6.0",
            "CFBundleName": wf["name"].replace(".workflow", ""),
            "CFBundlePackageType": "BNDL",
            "CFBundleShortVersionString": "1.0",
            "CFBundleVersion": "1",
            "NSServices": [
                {
                    "NSMenuItem": {
                        "default": wf["name"].replace(".workflow", "")
                    },
                    "NSMessage": "runWorkflowAsService",
                    "NSPortName": wf["name"].replace(".workflow", ""),
                    "NSSendFileTypes": ["public.item"],
                    "NSSendTypes": ["NSFilenamesPboardType"]
                }
            ]
        }
        with open(info_file, "wb") as f:
            plistlib.dump(info_data, f)
        print(f"✓ Yüklendi: {wf['name']}")

    # Refresh macOS LaunchServices & Finder services
    lsregister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
    if os.path.exists(lsregister):
        app_path = os.path.abspath("build/bin/7-Zip.app")
        if os.path.exists(app_path):
            subprocess.run([lsregister, "-f", app_path], capture_output=True)
    
    # Reload services cache
    pbs = "/System/Library/CoreServices/pbs"
    if os.path.exists(pbs):
        subprocess.run([pbs, "-update"], capture_output=True)

    print("==> Finder Servisleri ve Hızlı Eylemler başarıyla güncellendi!")

def uninstall():
    for wf in WORKFLOWS:
        wf_path = os.path.join(SERVICES_DIR, wf["name"])
        if os.path.exists(wf_path):
            shutil.rmtree(wf_path)
            print(f"✓ Kaldırıldı: {wf['name']}")
    print("==> Finder Servisleri kaldırıldı.")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "uninstall":
        uninstall()
    else:
        install()
