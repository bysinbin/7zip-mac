import * as App from './wailsjs/go/main/App.js';
import * as runtime from './wailsjs/runtime/runtime.js';

// Application State
const state = {
    currentTab: 'extract',
    currentArchive: null,
    currentPath: '',
    selectedEntries: new Set(),
    filterQuery: '',
    sortColumn: 'name',
    sortAsc: true,
    
    // Compression state
    compressFiles: [], // array of strings (file/folder paths)
    compressFormat: '7z',
    compressLevel: 5,
    compressSavePath: '',

    // Pending operation / password
    pendingArchivePath: '',
    lastExtractionDir: '',
    isOperationActive: false
};

// ================= INITIALIZATION =================
window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    initWailsEvents();
    loadRecentHistory();
    checkFinderStatus();
});

async function checkFinderStatus() {
    const label = document.getElementById('finder-status-label');
    if (!label) return;
    try {
        const installed = await App.CheckFinderActionsInstalled();
        if (installed) {
            label.textContent = 'Finder: Aktif ✓';
            label.parentElement.title = 'Finder sağ tık eylemleri devrede. Tıklayarak kaldırabilirsiniz.';
        } else {
            label.textContent = 'Finder Menüsü';
            label.parentElement.title = 'Finder sağ tık menüsüne 7-Zip eylemlerini kurmak için tıklayın.';
        }
    } catch (e) {
        console.error(e);
    }
}

window.handleToggleFinderActions = async function() {
    try {
        const installed = await App.CheckFinderActionsInstalled();
        if (installed) {
            const res = await App.UninstallFinderActions();
            showToast(res, 'info');
        } else {
            const res = await App.InstallFinderActions();
            showToast(res, 'success');
        }
        await checkFinderStatus();
    } catch (err) {
        showToast('Finder eylem hatası: ' + err, 'danger');
    }
};

function initEventListeners() {
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
            e.preventDefault();
            handleSelectArchiveFile();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            switchTab('compress');
        } else if (e.key === 'Escape') {
            closePasswordModal(false);
            if (!state.isOperationActive) {
                closeProgressModal();
                closeTestModal();
            }
        }
    });

    // HTML5 Drag and drop fallback
    const extractDropzone = document.getElementById('extract-empty');
    if (extractDropzone) {
        setupDragZone(extractDropzone, (files) => {
            if (files.length > 0 && files[0].path) {
                openArchiveByPath(files[0].path);
            }
        });
    }

    const compressDropzone = document.getElementById('compress-drop-area');
    if (compressDropzone) {
        setupDragZone(compressDropzone, (files) => {
            const paths = [];
            for (let i = 0; i < files.length; i++) {
                if (files[i].path) paths.push(files[i].path);
            }
            if (paths.length > 0) {
                addFilesToCompress(paths);
            }
        });
    }
}

function setupDragZone(element, callback) {
    ['dragenter', 'dragover'].forEach(eventName => {
        element.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        element.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-active');
        }, false);
    });

    element.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) {
            callback(e.dataTransfer.files);
        }
    }, false);
}

function initWailsEvents() {
    // Native Wails file drop
    runtime.EventsOn('file:dropped', (paths) => {
        if (!paths || paths.length === 0) return;
        
        // If an archive file is dropped in extract view or when no archive is open
        const first = paths[0];
        const isArchive = /\.(7z|zip|rar|tar|gz|tgz|bz2|tbz2|xz|txz|iso|dmg|cab|zst|jar|apk)$/i.test(first);
        
        if (state.currentTab === 'compress') {
            addFilesToCompress(paths);
        } else if (isArchive) {
            switchTab('extract');
            openArchiveByPath(first);
        } else {
            // Switch to compress and add them
            switchTab('compress');
            addFilesToCompress(paths);
        }
    });

    // Native macOS Finder "Open With" file open event
    runtime.EventsOn('file:opened', (path) => {
        if (path) {
            switchTab('extract');
            openArchiveByPath(path);
        }
    });

    // Extraction progress events
    runtime.EventsOn('extract:progress', (data) => {
        updateProgressUI(data.percent, data.currentFile || 'Çıkarılıyor...', false);
    });

    runtime.EventsOn('extract:complete', (outputDir) => {
        state.isOperationActive = false;
        state.lastExtractionDir = outputDir;
        updateProgressUI(100, 'Tamamlandı!', true);
        showToast('Arşiv başarıyla çıkarıldı!', 'success');
    });

    runtime.EventsOn('extract:error', (err) => {
        state.isOperationActive = false;
        closeProgressModal();
        if (err === 'PASSWORD_REQUIRED' || err === 'WRONG_PASSWORD') {
            promptPassword(state.currentArchive ? state.currentArchive.path : state.pendingArchivePath, (pass) => {
                handleExtractAllWithPassword(pass);
            });
        } else {
            showToast('Hata: ' + err, 'danger');
        }
    });

    // Compression progress events
    runtime.EventsOn('compress:progress', (data) => {
        updateProgressUI(data.percent, data.currentFile || 'Sıkıştırılıyor...', false);
    });

    runtime.EventsOn('compress:complete', (archivePath) => {
        state.isOperationActive = false;
        state.lastExtractionDir = archivePath;
        updateProgressUI(100, 'Arşiv başarıyla oluşturuldu!', true);
        showToast('Arşiv başarıyla oluşturuldu!', 'success');
        loadRecentHistory();
    });

    runtime.EventsOn('compress:error', (err) => {
        state.isOperationActive = false;
        closeProgressModal();
        showToast('Sıkıştırma hatası: ' + err, 'danger');
    });
}

// ================= TAB NAVIGATION =================
window.switchTab = function(tabName) {
    state.currentTab = tabName;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

    const tabBtn = document.getElementById(`tab-${tabName}-btn`);
    const viewPanel = document.getElementById(`view-${tabName}`);
    if (tabBtn) tabBtn.classList.add('active');
    if (viewPanel) viewPanel.classList.add('active');

    if (tabName === 'history') {
        loadRecentHistory();
    }
};

// ================= TAB 1: ARCHIVE BROWSER & EXTRACT =================

window.handleSelectArchiveFile = async function() {
    try {
        const path = await App.SelectArchiveFile();
        if (path) {
            openArchiveByPath(path);
        }
    } catch (err) {
        showToast('Dosya seçilemedi: ' + err, 'danger');
    }
};

async function openArchiveByPath(path, password = '') {
    state.pendingArchivePath = path;
    try {
        showToast('Arşiv taranıyor...', 'info');
        const info = await App.OpenArchive(path, password);
        state.currentArchive = info;
        state.currentPath = '';
        state.selectedEntries.clear();
        state.filterQuery = '';

        renderArchiveLoaded();
        showToast(`"${info.fileName}" açıldı (${info.totalFiles} dosya)`, 'success');
    } catch (err) {
        const errStr = String(err);
        if (errStr.includes('PASSWORD_REQUIRED') || errStr.includes('WRONG_PASSWORD')) {
            promptPassword(path, (enteredPassword) => {
                openArchiveByPath(path, enteredPassword);
            }, errStr.includes('WRONG_PASSWORD'));
        } else {
            showToast('Arşiv açılamadı: ' + err, 'danger');
        }
    }
}

function renderArchiveLoaded() {
    const emptyState = document.getElementById('extract-empty');
    const loadedState = document.getElementById('extract-loaded');
    if (!emptyState || !loadedState) return;

    emptyState.classList.add('hidden');
    loadedState.classList.remove('hidden');

    const info = state.currentArchive;
    document.getElementById('arch-name').textContent = info.fileName;
    document.getElementById('arch-name').title = info.path;
    document.getElementById('arch-type-badge').textContent = (info.type || '7Z').toUpperCase();
    
    // Method badge
    const methodBadge = document.getElementById('arch-method-badge');
    methodBadge.textContent = info.method ? info.method.split(' ')[0] : 'Standart';

    // Encrypted badge
    const encBadge = document.getElementById('arch-encrypted-badge');
    if (info.isEncrypted) {
        encBadge.classList.remove('hidden');
    } else {
        encBadge.classList.add('hidden');
    }

    // Stats
    document.getElementById('arch-stats-files').textContent = `${info.totalFiles} dosya${info.totalFolders > 0 ? `, ${info.totalFolders} klasör` : ''}`;
    document.getElementById('arch-stats-size').textContent = formatBytes(info.totalUncompressedSize);
    document.getElementById('arch-stats-packed').textContent = `Sıkıştırılmış: ${formatBytes(info.physicalSize || info.totalPackedSize)}`;

    // Ratio
    const ratioBadge = document.getElementById('arch-stats-ratio');
    if (info.totalUncompressedSize > 0 && info.totalPackedSize > 0) {
        const savings = Math.max(0, Math.round((1 - (info.totalPackedSize / info.totalUncompressedSize)) * 100));
        ratioBadge.textContent = `%${savings} tasarruf`;
    } else {
        ratioBadge.textContent = '';
    }

    renderBreadcrumbs();
    renderArchiveTable();
}

window.handleCloseArchive = function() {
    state.currentArchive = null;
    state.currentPath = '';
    state.selectedEntries.clear();

    const emptyState = document.getElementById('extract-empty');
    const loadedState = document.getElementById('extract-loaded');
    if (emptyState) emptyState.classList.remove('hidden');
    if (loadedState) loadedState.classList.add('hidden');
};

window.navigateToPath = function(targetPath) {
    state.currentPath = targetPath;
    state.selectedEntries.clear();
    updateExtractSelectedButton();
    renderBreadcrumbs();
    renderArchiveTable();
};

function renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs-container');
    if (!container) return;

    let html = `
        <button class="breadcrumb-item ${state.currentPath === '' ? 'active' : ''}" onclick="navigateToPath('')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            </svg>
            <span>Kök</span>
        </button>
    `;

    if (state.currentPath) {
        const segments = state.currentPath.split('/');
        let accum = '';
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (!seg) continue;
            accum = accum ? accum + '/' + seg : seg;
            const isLast = (i === segments.length - 1);
            html += `
                <span class="breadcrumb-sep">/</span>
                <button class="breadcrumb-item ${isLast ? 'active' : ''}" onclick="navigateToPath('${accum}')">
                    <span>${escapeHtml(seg)}</span>
                </button>
            `;
        }
    }

    container.innerHTML = html;
}

function getItemsInCurrentPath() {
    if (!state.currentArchive || !state.currentArchive.entries) return [];

    const query = state.filterQuery.toLowerCase().trim();
    const curPath = state.currentPath;

    // If there is an active search query, search across all entries
    if (query) {
        return state.currentArchive.entries.filter(e => {
            return e.name.toLowerCase().includes(query) || e.path.toLowerCase().includes(query);
        });
    }

    // Otherwise show immediate children in currentPath (and synthesize virtual folders)
    const items = [];
    const seenFolders = new Set();

    for (const entry of state.currentArchive.entries) {
        // Direct child
        if (entry.parent === curPath) {
            items.push(entry);
            if (entry.folder) {
                seenFolders.add(entry.name);
            }
        } else if (curPath === '' && entry.parent.length > 0) {
            // Top-level virtual folder
            const topFolder = entry.parent.split('/')[0];
            if (!seenFolders.has(topFolder)) {
                seenFolders.add(topFolder);
                items.push({
                    name: topFolder,
                    path: topFolder,
                    parent: '',
                    folder: true,
                    size: 0,
                    packedSize: 0,
                    modified: entry.modified,
                    attributes: 'D....',
                    crc: '',
                    encrypted: false,
                    extension: ''
                });
            }
        } else if (curPath !== '' && entry.parent.startsWith(curPath + '/')) {
            // Nested virtual folder
            const sub = entry.parent.substring(curPath.length + 1);
            const nextFolder = sub.split('/')[0];
            if (!seenFolders.has(nextFolder)) {
                seenFolders.add(nextFolder);
                items.push({
                    name: nextFolder,
                    path: curPath + '/' + nextFolder,
                    parent: curPath,
                    folder: true,
                    size: 0,
                    packedSize: 0,
                    modified: entry.modified,
                    attributes: 'D....',
                    crc: '',
                    encrypted: false,
                    extension: ''
                });
            }
        }
    }

    // Sort items
    items.sort((a, b) => {
        // Folders first
        if (a.folder !== b.folder) {
            return a.folder ? -1 : 1;
        }

        let diff = 0;
        switch (state.sortColumn) {
            case 'name':
                diff = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
                break;
            case 'size':
                diff = a.size - b.size;
                break;
            case 'packed':
                diff = a.packedSize - b.packedSize;
                break;
            case 'date':
                diff = (a.modified || '').localeCompare(b.modified || '');
                break;
            default:
                diff = a.name.localeCompare(b.name);
        }
        return state.sortAsc ? diff : -diff;
    });

    return items;
}

function renderArchiveTable() {
    const tbody = document.getElementById('archive-tbody');
    const counter = document.getElementById('items-counter-label');
    if (!tbody) return;

    const items = getItemsInCurrentPath();
    if (counter) counter.textContent = `${items.length} öge`;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-list-notice">Bu klasörde görüntülenecek öge yok</td></tr>`;
        return;
    }

    let rowsHtml = '';
    for (const item of items) {
        const isSelected = state.selectedEntries.has(item.path);
        const iconSvg = getFileIconSvg(item.name, item.folder);

        rowsHtml += `
            <tr class="${isSelected ? 'selected' : ''}" onclick="toggleRowSelect('${escapeHtml(item.path)}', event)">
                <td class="col-check" onclick="event.stopPropagation()">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleEntrySelection('${escapeHtml(item.path)}', this.checked)"/>
                </td>
                <td class="col-name" ${item.folder ? `ondblclick="navigateToPath('${escapeHtml(item.path)}')"` : ''}>
                    <div class="file-cell-name">
                        <span class="file-icon ${item.folder ? 'folder-icon' : 'doc-icon'}">${iconSvg}</span>
                        <span class="file-name-text">${escapeHtml(item.name)}</span>
                        ${item.encrypted ? `<span class="badge badge-warning" title="AES Şifreli">🔒</span>` : ''}
                    </div>
                </td>
                <td class="col-size">${item.folder ? '--' : formatBytes(item.size)}</td>
                <td class="col-packed">${item.folder ? '--' : formatBytes(item.packedSize)}</td>
                <td class="col-date">${escapeHtml(item.modified || '--')}</td>
                <td class="col-attr">${escapeHtml(item.attributes || '--')}</td>
                <td class="col-crc">${escapeHtml(item.crc || '--')}</td>
                <td class="col-action" onclick="event.stopPropagation()">
                    <button class="btn btn-ghost btn-sm btn-icon" onclick="handleExtractSingle('${escapeHtml(item.path)}')" title="Bu ögeyi çıkar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = rowsHtml;
}

window.toggleRowSelect = function(path, event) {
    if (state.selectedEntries.has(path)) {
        state.selectedEntries.delete(path);
    } else {
        state.selectedEntries.add(path);
    }
    updateExtractSelectedButton();
    renderArchiveTable();
};

window.toggleEntrySelection = function(path, checked) {
    if (checked) {
        state.selectedEntries.add(path);
    } else {
        state.selectedEntries.delete(path);
    }
    updateExtractSelectedButton();
    renderArchiveTable();
};

window.toggleSelectAll = function(checked) {
    const items = getItemsInCurrentPath();
    if (checked) {
        items.forEach(i => state.selectedEntries.add(i.path));
    } else {
        state.selectedEntries.clear();
    }
    updateExtractSelectedButton();
    renderArchiveTable();
};

function updateExtractSelectedButton() {
    const btn = document.getElementById('btn-extract-selected');
    const label = document.getElementById('label-extract-selected');
    if (!btn || !label) return;

    const count = state.selectedEntries.size;
    if (count > 0) {
        btn.disabled = false;
        label.textContent = `Seçilenleri Çıkar (${count})`;
    } else {
        btn.disabled = true;
        label.textContent = 'Seçilenleri Çıkar';
    }
}

window.sortArchiveBy = function(column) {
    if (state.sortColumn === column) {
        state.sortAsc = !state.sortAsc;
    } else {
        state.sortColumn = column;
        state.sortAsc = true;
    }
    renderArchiveTable();
};

window.handleFilterInput = function(val) {
    state.filterQuery = val;
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
        if (val) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    renderArchiveTable();
};

window.clearFilter = function() {
    const input = document.getElementById('archive-filter-input');
    if (input) input.value = '';
    handleFilterInput('');
};

// ================= EXTRACTION ACTIONS =================

window.handleExtractAll = async function() {
    if (!state.currentArchive) return;
    try {
        const outDir = await App.SelectOutputDirectory('');
        if (!outDir) return;

        openProgressModal('Arşiv Çıkarılıyor...', state.currentArchive.fileName);
        state.isOperationActive = true;

        await App.ExtractArchive({
            archivePath: state.currentArchive.path,
            outputDir: outDir,
            password: '',
            selectedFiles: [],
            overwriteMode: 'overwrite'
        });
    } catch (err) {
        showToast('Çıkarma başlatılamadı: ' + err, 'danger');
    }
};

window.handleExtractSelected = async function() {
    if (!state.currentArchive || state.selectedEntries.size === 0) return;
    try {
        const outDir = await App.SelectOutputDirectory('');
        if (!outDir) return;

        openProgressModal('Seçilenler Çıkarılıyor...', `${state.selectedEntries.size} dosya`);
        state.isOperationActive = true;

        await App.ExtractArchive({
            archivePath: state.currentArchive.path,
            outputDir: outDir,
            password: '',
            selectedFiles: Array.from(state.selectedEntries),
            overwriteMode: 'overwrite'
        });
    } catch (err) {
        showToast('Çıkarma hatası: ' + err, 'danger');
    }
};

window.handleExtractSingle = async function(filePath) {
    if (!state.currentArchive) return;
    try {
        const outDir = await App.SelectOutputDirectory('');
        if (!outDir) return;

        openProgressModal('Dosya Çıkarılıyor...', filePath);
        state.isOperationActive = true;

        await App.ExtractArchive({
            archivePath: state.currentArchive.path,
            outputDir: outDir,
            password: '',
            selectedFiles: [filePath],
            overwriteMode: 'overwrite'
        });
    } catch (err) {
        showToast('Çıkarma hatası: ' + err, 'danger');
    }
};

async function handleExtractAllWithPassword(password) {
    try {
        const outDir = await App.SelectOutputDirectory('');
        if (!outDir) return;

        openProgressModal('Şifreli Arşiv Çıkarılıyor...', state.currentArchive.fileName);
        state.isOperationActive = true;

        await App.ExtractArchive({
            archivePath: state.currentArchive.path,
            outputDir: outDir,
            password: password,
            selectedFiles: [],
            overwriteMode: 'overwrite'
        });
    } catch (err) {
        showToast('Çıkarma hatası: ' + err, 'danger');
    }
}

window.handleTestArchive = async function() {
    if (!state.currentArchive) return;
    try {
        showToast('Bütünlük testi başlatılıyor...', 'info');
        const res = await App.TestArchive(state.currentArchive.path, '');
        openTestModal(res);
    } catch (err) {
        showToast('Test hatası: ' + err, 'danger');
    }
};

window.handleRevealInFinder = async function() {
    if (!state.currentArchive) return;
    try {
        await App.RevealInFinder(state.currentArchive.path);
    } catch (err) {
        showToast('Finder açılamadı: ' + err, 'danger');
    }
};

// ================= TAB 2: COMPRESS / NEW ARCHIVE =================

window.handleAddFilesToCompress = async function() {
    try {
        const paths = await App.SelectFilesToCompress();
        if (paths && paths.length > 0) {
            addFilesToCompress(paths);
        }
    } catch (err) {
        showToast('Dosyalar seçilemedi: ' + err, 'danger');
    }
};

window.handleAddFolderToCompress = async function() {
    try {
        const path = await App.SelectFolderToCompress();
        if (path) {
            addFilesToCompress([path]);
        }
    } catch (err) {
        showToast('Klasör seçilemedi: ' + err, 'danger');
    }
};

function addFilesToCompress(paths) {
    for (const p of paths) {
        if (!state.compressFiles.includes(p)) {
            state.compressFiles.push(p);
        }
    }

    // Auto set save path if not set
    if (!state.compressSavePath && state.compressFiles.length > 0) {
        const first = state.compressFiles[0];
        const dir = first.substring(0, first.lastIndexOf('/'));
        const name = first.substring(first.lastIndexOf('/') + 1);
        state.compressSavePath = `${dir}/${name}.${state.compressFormat}`;
        const input = document.getElementById('compress-output-path');
        if (input) input.value = state.compressSavePath;
    }

    renderCompressFilesList();
    showToast(`${paths.length} öge eklendi`, 'info');
}

window.removeCompressItem = function(index) {
    state.compressFiles.splice(index, 1);
    renderCompressFilesList();
};

window.clearCompressFiles = function() {
    state.compressFiles = [];
    state.compressSavePath = '';
    const input = document.getElementById('compress-output-path');
    if (input) input.value = '';
    renderCompressFilesList();
};

function renderCompressFilesList() {
    const list = document.getElementById('compress-items-list');
    const badge = document.getElementById('compress-files-badge');
    const clearBtn = document.getElementById('btn-clear-compress');
    const totalLabel = document.getElementById('compress-total-size-label');
    if (!list) return;

    badge.textContent = `${state.compressFiles.length} Öge`;
    clearBtn.disabled = state.compressFiles.length === 0;

    if (state.compressFiles.length === 0) {
        list.innerHTML = `<li class="empty-list-notice">Henüz dosya eklenmedi</li>`;
        if (totalLabel) totalLabel.textContent = 'Toplam: 0 B';
        return;
    }

    let html = '';
    for (let i = 0; i < state.compressFiles.length; i++) {
        const path = state.compressFiles[i];
        const name = path.substring(path.lastIndexOf('/') + 1);
        html += `
            <li class="compress-item">
                <div class="compress-item-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <div>
                        <div class="compress-item-name">${escapeHtml(name)}</div>
                        <div class="compress-item-path" title="${escapeHtml(path)}">${escapeHtml(path)}</div>
                    </div>
                </div>
                <button class="btn btn-ghost btn-sm btn-icon text-danger" onclick="removeCompressItem(${i})" title="Kaldır">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </li>
        `;
    }
    list.innerHTML = html;
    if (totalLabel) totalLabel.textContent = `${state.compressFiles.length} dosya/klasör seçildi`;
}

window.handleFormatChange = function(format) {
    state.compressFormat = format;
    document.querySelectorAll('.format-chip').forEach(c => c.classList.remove('active'));
    const input = document.querySelector(`input[name="archive-format"][value="${format}"]`);
    if (input && input.parentElement) input.parentElement.classList.add('active');

    // Header encryption toggle only works for .7z format
    const encHeaderRow = document.getElementById('encrypt-header-row');
    if (encHeaderRow) {
        if (format === '7z') encHeaderRow.classList.remove('hidden');
        else encHeaderRow.classList.add('hidden');
    }

    // Update extension in output path
    if (state.compressSavePath) {
        state.compressSavePath = state.compressSavePath.replace(/\.(7z|zip|tar\.gz|tar\.xz|tar\.bz2|tar)$/i, '') + '.' + format;
        const outInput = document.getElementById('compress-output-path');
        if (outInput) outInput.value = state.compressSavePath;
    }
};

window.setCompressionLevel = function(level, btn) {
    state.compressLevel = level;
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const descLabel = document.getElementById('level-desc-label');
    const descriptions = {
        0: 'Depola (Sıkıştırmasız, en yüksek hız)',
        1: 'Hızlı (Düşük CPU, hızlı arşivleme)',
        5: 'Normal (Dengeli hız ve dosya boyutu)',
        7: 'Maksimum (Yüksek sıkıştırma)',
        9: 'Ultra (En yüksek LZMA2 sıkıştırma)'
    };
    if (descLabel) descLabel.textContent = descriptions[level] || 'Normal';
};

window.handleChooseSaveLocation = async function() {
    try {
        let defName = 'archive';
        if (state.compressFiles.length > 0) {
            const first = state.compressFiles[0];
            defName = first.substring(first.lastIndexOf('/') + 1);
        }
        const path = await App.SelectSaveArchivePath(defName, state.compressFormat);
        if (path) {
            state.compressSavePath = path;
            const input = document.getElementById('compress-output-path');
            if (input) input.value = path;
        }
    } catch (err) {
        showToast('Konum seçilemedi: ' + err, 'danger');
    }
};

window.handleStartCompression = async function() {
    if (state.compressFiles.length === 0) {
        showToast('Lütfen sıkıştırılacak en az bir dosya veya klasör ekleyin.', 'warning');
        return;
    }

    if (!state.compressSavePath) {
        await handleChooseSaveLocation();
        if (!state.compressSavePath) return;
    }

    const password = document.getElementById('compress-password').value || '';
    const encryptHeader = document.getElementById('encrypt-header-check').checked;
    const splitVolume = document.getElementById('compress-split-volume').value || '';
    const threads = parseInt(document.getElementById('compress-threads').value, 10) || 0;

    const fileName = state.compressSavePath.substring(state.compressSavePath.lastIndexOf('/') + 1);
    openProgressModal('Arşiv Oluşturuluyor...', fileName);
    state.isOperationActive = true;

    try {
        await App.CompressArchive({
            inputPaths: state.compressFiles,
            archivePath: state.compressSavePath,
            format: state.compressFormat,
            level: state.compressLevel,
            method: 'LZMA2',
            password: password,
            encryptHeader: encryptHeader,
            volumeSize: splitVolume,
            threads: threads
        });
    } catch (err) {
        showToast('Arşiv oluşturulamadı: ' + err, 'danger');
    }
};

// ================= TAB 3: RECENT HISTORY =================

async function loadRecentHistory() {
    const list = document.getElementById('history-items-list');
    if (!list) return;

    try {
        const recents = await App.GetRecentArchives();
        if (!recents || recents.length === 0) {
            list.innerHTML = `<li class="empty-list-notice">Geçmişte arşiv bulunmuyor</li>`;
            return;
        }

        let html = '';
        for (const itemPath of recents) {
            const fileName = itemPath.substring(itemPath.lastIndexOf('/') + 1);
            const ext = fileName.includes('.') ? fileName.split('.').pop().toUpperCase() : '7Z';
            html += `
                <li class="history-item">
                    <div class="history-item-left">
                        <div class="history-badge">${ext}</div>
                        <div class="history-item-details">
                            <div class="history-item-name">${escapeHtml(fileName)}</div>
                            <div class="history-item-path" title="${escapeHtml(itemPath)}">${escapeHtml(itemPath)}</div>
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn btn-secondary btn-sm" onclick="openArchiveFromHistory('${escapeHtml(itemPath)}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span>Aç</span>
                        </button>
                        <button class="btn btn-ghost btn-sm btn-icon" onclick="revealPathInFinder('${escapeHtml(itemPath)}')" title="Finder'da Göster">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                        </button>
                    </div>
                </li>
            `;
        }
        list.innerHTML = html;
    } catch (err) {
        console.error('History load error:', err);
    }
}

window.openArchiveFromHistory = function(path) {
    switchTab('extract');
    openArchiveByPath(path);
};

window.revealPathInFinder = async function(path) {
    try {
        await App.RevealInFinder(path);
    } catch (err) {
        showToast('Finder açılamadı: ' + err, 'danger');
    }
};

window.handleClearHistory = async function() {
    try {
        await App.ClearRecentArchives();
        loadRecentHistory();
        showToast('Geçmiş temizlendi', 'info');
    } catch (err) {
        showToast('Geçmiş temizlenemedi: ' + err, 'danger');
    }
};

// ================= MODALS & PROGRESS =================

function openProgressModal(title, subtitle) {
    const dialog = document.getElementById('modal-progress');
    const bar = document.getElementById('progress-bar-fill');
    const percentLabel = document.getElementById('progress-percentage-label');
    const fileLabel = document.getElementById('progress-file-label');
    const spinner = document.getElementById('progress-spinner-icon');
    const successIcon = document.getElementById('progress-success-icon');
    const cancelBtn = document.getElementById('btn-cancel-progress');
    const openFolderBtn = document.getElementById('btn-open-target-folder');
    const doneBtn = document.getElementById('btn-done-progress');

    document.getElementById('progress-title').textContent = title;
    document.getElementById('progress-subtitle').textContent = subtitle;

    bar.style.width = '0%';
    percentLabel.textContent = '0%';
    fileLabel.textContent = 'Hazırlanıyor...';

    spinner.classList.remove('hidden');
    successIcon.classList.add('hidden');
    cancelBtn.classList.remove('hidden');
    openFolderBtn.classList.add('hidden');
    doneBtn.classList.add('hidden');

    dialog.showModal();
}

function updateProgressUI(percent, fileName, isDone) {
    const bar = document.getElementById('progress-bar-fill');
    const percentLabel = document.getElementById('progress-percentage-label');
    const fileLabel = document.getElementById('progress-file-label');
    const spinner = document.getElementById('progress-spinner-icon');
    const successIcon = document.getElementById('progress-success-icon');
    const cancelBtn = document.getElementById('btn-cancel-progress');
    const openFolderBtn = document.getElementById('btn-open-target-folder');
    const doneBtn = document.getElementById('btn-done-progress');

    if (bar) bar.style.width = `${percent}%`;
    if (percentLabel) percentLabel.textContent = `${percent}%`;
    if (fileLabel && fileName) fileLabel.textContent = fileName;

    if (isDone) {
        if (spinner) spinner.classList.add('hidden');
        if (successIcon) successIcon.classList.remove('hidden');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        if (openFolderBtn) openFolderBtn.classList.remove('hidden');
        if (doneBtn) doneBtn.classList.remove('hidden');
        document.getElementById('progress-title').textContent = 'İşlem Başarıyla Tamamlandı';
    }
}

window.closeProgressModal = function() {
    const dialog = document.getElementById('modal-progress');
    if (dialog && dialog.open) dialog.close();
};

window.handleCancelOperation = async function() {
    try {
        await App.CancelOperation();
        closeProgressModal();
        showToast('İşlem iptal edildi.', 'warning');
    } catch (err) {
        console.error(err);
    }
};

window.handleOpenTargetFolder = async function() {
    if (state.lastExtractionDir) {
        try {
            await App.RevealInFinder(state.lastExtractionDir);
        } catch (e) {
            await App.OpenFolder(state.lastExtractionDir);
        }
    }
};

// Password Modal
let passwordCallback = null;
function promptPassword(archivePath, callback, isWrong = false) {
    passwordCallback = callback;
    const dialog = document.getElementById('modal-password');
    const input = document.getElementById('modal-password-input');
    const errMsg = document.getElementById('password-error-msg');
    
    input.value = '';
    if (isWrong) errMsg.classList.remove('hidden');
    else errMsg.classList.add('hidden');

    dialog.showModal();
    input.focus();
}

window.submitPasswordModal = function() {
    const dialog = document.getElementById('modal-password');
    const input = document.getElementById('modal-password-input');
    const val = input.value;
    dialog.close();
    if (passwordCallback) {
        passwordCallback(val);
    }
};

window.closePasswordModal = function() {
    const dialog = document.getElementById('modal-password');
    if (dialog && dialog.open) dialog.close();
    passwordCallback = null;
};

// Test Modal
function openTestModal(result) {
    const dialog = document.getElementById('modal-test');
    const title = document.getElementById('test-result-title');
    const desc = document.getElementById('test-result-desc');
    const icon = document.getElementById('test-result-icon');
    const errBox = document.getElementById('test-errors-box');

    if (result.success) {
        title.textContent = 'Arşiv Sağlam ve Doğrulandı';
        desc.textContent = `${result.message} (${result.duration})`;
        icon.className = 'dialog-icon-circle success-circle';
        icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        errBox.classList.add('hidden');
    } else {
        title.textContent = 'Arşivde Hata Bulundu!';
        desc.textContent = result.message;
        icon.className = 'dialog-icon-circle text-danger';
        icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        if (result.errors && result.errors.length > 0) {
            errBox.innerHTML = result.errors.map(e => `<div>• ${escapeHtml(e)}</div>`).join('');
            errBox.classList.remove('hidden');
        }
    }

    dialog.showModal();
}

window.closeTestModal = function() {
    const dialog = document.getElementById('modal-test');
    if (dialog && dialog.open) dialog.close();
};

window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
        input.type = 'password';
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
};

// ================= UTILITIES =================

function formatBytes(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getFileIconSvg(name, isFolder) {
    if (isFolder) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    }
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (['7z', 'zip', 'rar', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext)) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    }
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    }
    if (['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    }
    if (['pdf'].includes(ext)) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>`;
    }
    if (['go', 'js', 'ts', 'py', 'c', 'cpp', 'rs', 'html', 'css', 'json', 'sh', 'swift'].includes(ext)) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
    }
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    if (type === 'success') {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'danger') {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else if (type === 'warning') {
        icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    }

    toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}
