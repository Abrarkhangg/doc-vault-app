/**
 * Custom Document Vault - Main Application Engine (ShoaibVault GitHub Cloud Edition)
 */

class DocumentVaultApp {
  constructor() {
    this.folders = JSON.parse(localStorage.getItem('docvault_folders')) || [
      { id: 'official', name: 'Official Notices', icon: 'fa-building-columns' },
      { id: 'finance', name: 'Invoices & Finance', icon: 'fa-receipt' },
      { id: 'contracts', name: 'Lease & Contracts', icon: 'fa-file-signature' },
      { id: 'hr', name: 'HR & Staffing', icon: 'fa-users' }
    ];

    this.documents = JSON.parse(localStorage.getItem('docvault_documents')) || [];
    this.activeFolder = 'dashboard_overview';
    this.activeTypeFilter = 'all';
    this.dateFrom = '';
    this.dateTo = '';
    this.searchQuery = '';
    this.sortOrder = 'date-desc';
    this.viewMode = 'grid';

    // Viewer & Delete state
    this.viewerZoom = 1;
    this.viewerRotation = 0;
    this.activeViewerDoc = null;
    this.pendingDeleteFolderId = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkSecurityLock();
  }

  saveToStorage() {
    localStorage.setItem('docvault_folders', JSON.stringify(this.folders));
    localStorage.setItem('docvault_documents', JSON.stringify(this.documents));
  }

  checkSecurityLock() {
    const pin = localStorage.getItem('docvault_pin');
    const lockScreen = document.getElementById('lock-screen');
    const mainApp = document.getElementById('app');
    const lockTitle = document.getElementById('lock-title');
    const lockSubtitle = document.getElementById('lock-subtitle');
    const unlockBtn = document.getElementById('unlock-btn');

    // Strict Lockout: App stays hidden until PIN is verified
    mainApp.style.display = 'none';
    lockScreen.style.display = 'flex';

    if (pin) {
      lockTitle.textContent = 'ShoaibVault';
      lockSubtitle.textContent = 'Enter your 4-digit PIN to access office letters';
      unlockBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Unlock Vault';
    } else {
      lockTitle.textContent = 'Set Master PIN';
      lockSubtitle.textContent = 'Create a 4-digit Security PIN to protect your ShoaibVault';
      unlockBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Set Master PIN';
    }
  }

  async handleUnlock() {
    const input = document.getElementById('pin-input');
    const savedPin = localStorage.getItem('docvault_pin');
    const errDiv = document.getElementById('pin-error');
    const unlockBtn = document.getElementById('unlock-btn');
    const pinVal = input.value.trim();

    if (savedPin) {
      if (pinVal === savedPin) {
        errDiv.style.display = 'none';
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing from GitHub Cloud...';

        // Load live letters from GitHub Private Repository
        if (window.githubSync.isConfigured()) {
          try {
            const remoteData = await window.githubSync.fetchMetadata();
            if (remoteData && Array.isArray(remoteData.documents)) {
              this.documents = remoteData.documents;
              if (Array.isArray(remoteData.folders) && remoteData.folders.length > 0) {
                this.folders = remoteData.folders;
              }
              this.saveToStorage();
            }
          } catch (e) {
            console.warn('GitHub fetch error on startup:', e);
          }
        }

        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        unlockBtn.disabled = false;
        unlockBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Unlock Vault';
        input.value = '';
        
        // Render UI with clean GitHub cloud data
        this.renderFolders();
        this.renderView();
        this.updateStats();
        this.updateSyncBadge();
      } else {
        errDiv.textContent = 'Invalid PIN code. Try again.';
        errDiv.style.display = 'block';
      }
    } else {
      if (pinVal.length === 4 && /^\d+$/.test(pinVal)) {
        localStorage.setItem('docvault_pin', pinVal);
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        errDiv.style.display = 'none';
        input.value = '';

        this.renderFolders();
        this.renderView();
        this.updateStats();
        this.updateSyncBadge();
        this.showToast('Master PIN set & Vault unlocked!');
      } else {
        errDiv.textContent = 'PIN code must be 4 digits.';
        errDiv.style.display = 'block';
      }
    }
  }

  setupEventListeners() {
    // PIN Unlock
    document.getElementById('unlock-btn').addEventListener('click', () => this.handleUnlock());
    document.getElementById('pin-input').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.handleUnlock();
    });

    // Dashboard Overview Tab Click
    document.getElementById('nav-dashboard').addEventListener('click', () => {
      this.activeFolder = 'dashboard_overview';
      this.renderFolders();
      this.renderView();
    });

    // Sidebar Folder List Click & Delete Action
    document.getElementById('folder-list').addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-folder-icon');
      if (deleteBtn) {
        e.stopPropagation();
        const folderId = deleteBtn.dataset.folderId;
        this.triggerFolderDelete(folderId);
        return;
      }

      const item = e.target.closest('.folder-item');
      if (item) {
        this.activeFolder = item.dataset.folderId;
        this.renderFolders();
        this.renderView();
      }
    });

    // Folder Header Bar Delete Button
    document.getElementById('btn-delete-current-folder').addEventListener('click', () => {
      if (this.activeFolder && this.activeFolder !== 'dashboard_overview') {
        this.triggerFolderDelete(this.activeFolder);
      }
    });

    // Delete Folder Confirmation Form Submit with PIN Security Check
    document.getElementById('delete-folder-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleConfirmDeleteFolder();
    });

    // Add Folder Button with Duplicate Name Check
    document.getElementById('btn-add-folder').addEventListener('click', () => {
      this.openModal('folder-modal');
    });
    document.getElementById('folder-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('folder-name-input');
      const folderName = input.value.trim();
      
      if (folderName) {
        const exists = this.folders.some(f => f.name.toLowerCase() === folderName.toLowerCase());
        if (exists) {
          alert(`A folder named "${folderName}" already exists! Please use a different name.`);
          return;
        }

        const newFolder = {
          id: 'folder_' + Date.now(),
          name: folderName,
          icon: 'fa-folder'
        };
        this.folders.push(newFolder);
        this.saveToStorage();

        if (window.githubSync.isConfigured()) {
          try {
            await window.githubSync.syncMetadata(this.documents, this.folders);
          } catch (err) {
            console.warn('GitHub folder sync error:', err);
          }
        }

        this.renderFolders();
        this.updateFolderSelectDropdown();
        this.closeModal('folder-modal');
        input.value = '';
        this.showToast(`Folder "${folderName}" created & synced!`);
      }
    });

    // Custom Date Range Filters (From Date & To Date)
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    const clearDatesBtn = document.getElementById('btn-clear-dates');

    const handleDateChange = () => {
      this.dateFrom = dateFromInput.value;
      this.dateTo = dateToInput.value;
      const hasDateFilter = Boolean(this.dateFrom || this.dateTo);
      clearDatesBtn.style.display = hasDateFilter ? 'flex' : 'none';
      this.renderDocuments();
    };

    dateFromInput.addEventListener('change', handleDateChange);
    dateToInput.addEventListener('change', handleDateChange);

    clearDatesBtn.addEventListener('click', () => {
      dateFromInput.value = '';
      dateToInput.value = '';
      this.dateFrom = '';
      this.dateTo = '';
      clearDatesBtn.style.display = 'none';
      this.renderDocuments();
    });

    // Search Input
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      clearSearchBtn.classList.toggle('visible', Boolean(this.searchQuery));
      this.renderDocuments();
    });
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      clearSearchBtn.classList.remove('visible');
      this.renderDocuments();
    });

    // Type Filter Pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        this.activeTypeFilter = e.target.dataset.type;
        this.renderDocuments();
      });
    });

    // Sort Dropdown
    document.getElementById('sort-select').addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.renderDocuments();
    });

    // View Mode Toggle
    document.getElementById('view-grid-btn').addEventListener('click', () => {
      this.viewMode = 'grid';
      document.getElementById('view-grid-btn').classList.add('active');
      document.getElementById('view-list-btn').classList.remove('active');
      document.getElementById('documents-container').className = 'documents-grid';
      this.renderDocuments();
    });
    document.getElementById('view-list-btn').addEventListener('click', () => {
      this.viewMode = 'list';
      document.getElementById('view-list-btn').classList.add('active');
      document.getElementById('view-grid-btn').classList.remove('active');
      document.getElementById('documents-container').className = 'documents-list';
      this.renderDocuments();
    });

    // Modal Close Buttons
    document.querySelectorAll('.modal-close-btn, .close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) this.closeModal(modal.id);
      });
    });

    // Upload Triggers
    document.getElementById('btn-open-upload').addEventListener('click', () => {
      this.updateFolderSelectDropdown();
      document.getElementById('doc-date').valueAsDate = new Date();
      this.openModal('upload-modal');
    });
    document.getElementById('btn-empty-upload').addEventListener('click', () => {
      this.updateFolderSelectDropdown();
      document.getElementById('doc-date').valueAsDate = new Date();
      this.openModal('upload-modal');
    });

    // Dropzone & File Input
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        this.handleFileSelected(fileInput.files[0]);
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelected(e.target.files[0]);
      }
    });

    // Upload Form Submit
    document.getElementById('upload-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveDocument();
    });

    // Lock Button
    document.getElementById('btn-lock').addEventListener('click', () => {
      this.checkSecurityLock();
    });

    // Settings Modal
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('gh-token').value = window.githubSync.token;
      document.getElementById('gh-repo').value = window.githubSync.repo || 'Abrarkhangg/Officeletters';
      document.getElementById('new-pin').value = localStorage.getItem('docvault_pin') || '';
      this.openModal('settings-modal');
    });

    // Reset & Wipe All Demo Data Trigger
    document.getElementById('btn-wipe-data').addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete all letters? This will clean up your vault.')) {
        this.documents = [];
        this.saveToStorage();

        if (window.githubSync.isConfigured()) {
          try {
            await window.githubSync.syncMetadata(this.documents, this.folders);
          } catch (e) {
            console.warn('GitHub wipe sync error:', e);
          }
        }

        this.renderDocuments();
        this.updateStats();
        this.closeModal('settings-modal');
        this.showToast('All letters cleared.');
      }
    });

    // GitHub Connection Test & Remote Sync
    document.getElementById('btn-test-gh').addEventListener('click', async () => {
      const token = document.getElementById('gh-token').value;
      const repo = document.getElementById('gh-repo').value || 'Abrarkhangg/Officeletters';
      window.githubSync.saveCredentials(token, repo);

      const resDiv = document.getElementById('gh-test-result');
      resDiv.style.display = 'block';
      resDiv.innerHTML = '<span style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Testing connection to GitHub...</span>';

      const res = await window.githubSync.testConnection();
      if (res.success) {
        resDiv.innerHTML = `<span style="color: var(--accent-teal); font-weight:600;"><i class="fa-solid fa-check-circle"></i> Connected to ${res.name} (${res.isPrivate ? 'Private Repo' : 'Public Repo'})</span>`;
        this.updateSyncBadge();

        try {
          await window.githubSync.syncMetadata(this.documents, this.folders);
        } catch (err) {}
      } else {
        resDiv.innerHTML = `<span style="color: var(--accent-rose); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${res.message}</span>`;
      }
    });

    // GitHub Sync Trigger
    document.getElementById('btn-sync-gh').addEventListener('click', async () => {
      const btn = document.getElementById('btn-sync-gh');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
      try {
        await window.githubSync.syncMetadata(this.documents, this.folders);
        alert('Metadata & Document index successfully synced to GitHub!');
      } catch (err) {
        alert('Sync failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Sync Files Now';
      }
    });

    // Save PIN
    document.getElementById('btn-save-pin').addEventListener('click', () => {
      const pinVal = document.getElementById('new-pin').value.trim();
      if (pinVal.length === 4 && /^\d+$/.test(pinVal)) {
        localStorage.setItem('docvault_pin', pinVal);
        alert('Security PIN updated successfully.');
      } else {
        alert('PIN must be exactly 4 digits.');
      }
    });

    // Image Zoom / Rotate Toolbar Controls
    document.getElementById('btn-zoom-in').addEventListener('click', () => this.updateViewerTransform(0.25, 0));
    document.getElementById('btn-zoom-out').addEventListener('click', () => this.updateViewerTransform(-0.25, 0));
    document.getElementById('btn-rotate').addEventListener('click', () => this.updateViewerTransform(0, 90));
    document.getElementById('btn-reset-zoom').addEventListener('click', () => {
      this.viewerZoom = 1;
      this.viewerRotation = 0;
      this.applyViewerTransform();
    });

    // Viewer Download, Print & Copy
    document.getElementById('btn-viewer-download').addEventListener('click', () => {
      if (this.activeViewerDoc) {
        const a = document.createElement('a');
        a.href = this.activeViewerDoc.fileData;
        a.download = this.activeViewerDoc.fileName;
        a.click();
      }
    });

    document.getElementById('btn-viewer-copy').addEventListener('click', () => {
      if (this.activeViewerDoc) {
        this.copyDocumentToClipboard(this.activeViewerDoc);
      }
    });

    document.getElementById('btn-viewer-print').addEventListener('click', () => {
      if (this.activeViewerDoc) {
        const win = window.open('');
        if (this.activeViewerDoc.fileType === 'image') {
          win.document.write(`<img src="${this.activeViewerDoc.fileData}" style="max-width:100%;">`);
        } else {
          win.document.write(`<iframe src="${this.activeViewerDoc.fileData}" style="width:100%;height:100vh;border:none;"></iframe>`);
        }
        setTimeout(() => { win.print(); win.close(); }, 500);
      }
    });
  }

  handleFileSelected(file) {
    const infoDiv = document.getElementById('selected-file-info');
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = `<i class="fa-solid fa-file"></i> Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    const titleInput = document.getElementById('doc-title');
    if (!titleInput.value) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      titleInput.value = cleanName;
    }
  }

  async handleSaveDocument() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files[0]) {
      alert('Please select a PDF or Image file.');
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      const fileData = e.target.result;
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      
      const newDoc = {
        id: 'doc_' + Date.now(),
        title: document.getElementById('doc-title').value.trim(),
        folderId: document.getElementById('doc-folder').value,
        letterDate: document.getElementById('doc-date').value,
        createdAt: new Date().toISOString(),
        tags: document.getElementById('doc-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        notes: document.getElementById('doc-notes').value.trim(),
        fileType: isPdf ? 'pdf' : 'image',
        fileName: file.name,
        fileSize: file.size,
        fileData: fileData
      };

      this.documents.unshift(newDoc);
      this.saveToStorage();

      if (window.githubSync.isConfigured()) {
        try {
          const ghPath = `letters/${newDoc.id}_${newDoc.fileName}`;
          await window.githubSync.uploadFile(ghPath, fileData, `Add letter: ${newDoc.title}`);
          newDoc.ghPath = ghPath;
          await window.githubSync.syncMetadata(this.documents, this.folders);
          this.saveToStorage();
        } catch (err) {
          console.warn('GitHub background upload warning:', err);
        }
      }

      this.renderDocuments();
      this.updateStats();
      this.renderFolders();
      this.closeModal('upload-modal');
      document.getElementById('upload-form').reset();
      document.getElementById('selected-file-info').style.display = 'none';
      this.showToast('Letter saved & synced successfully!');
    };

    reader.readAsDataURL(file);
  }

  triggerFolderDelete(folderId) {
    const folder = this.folders.find(f => f.id === folderId);
    if (!folder) return;

    this.pendingDeleteFolderId = folderId;
    const fileCount = this.documents.filter(d => d.folderId === folderId).length;

    document.getElementById('del-folder-warning-title').textContent = `Delete Folder "${folder.name}"?`;
    document.getElementById('del-folder-file-count-msg').innerHTML = 
      `⚠️ <b>Security Warning:</b> This folder contains <b style="color: var(--accent-rose);">${fileCount} letter document(s)</b>. Deleting this folder will permanently delete the category AND all ${fileCount} letter file(s) inside it!`;
    
    const savedPin = localStorage.getItem('docvault_pin');
    const pinInput = document.getElementById('delete-folder-pin-input');
    const pinLabel = document.getElementById('del-pin-label');
    const pinHint = document.getElementById('del-pin-hint');
    document.getElementById('delete-folder-error').style.display = 'none';
    pinInput.value = '';

    if (savedPin) {
      pinLabel.textContent = 'Enter 4-Digit Security PIN to Authorize Deletion *';
      pinHint.textContent = 'Enter your 4-digit Vault PIN code to authorize permanent deletion';
    } else {
      pinLabel.textContent = 'Set 4-Digit Security PIN to Authorize Deletion *';
      pinHint.textContent = 'No PIN set yet. Enter a 4-digit PIN to set your security key and confirm deletion';
    }

    this.openModal('delete-folder-modal');
  }

  async handleConfirmDeleteFolder() {
    if (!this.pendingDeleteFolderId) return;

    const pinInput = document.getElementById('delete-folder-pin-input').value.trim();
    const savedPin = localStorage.getItem('docvault_pin');
    const errDiv = document.getElementById('delete-folder-error');

    if (savedPin) {
      if (pinInput !== savedPin) {
        errDiv.style.display = 'block';
        errDiv.textContent = 'Incorrect PIN code. Authorization denied.';
        return;
      }
    } else {
      if (pinInput.length === 4 && /^\d+$/.test(pinInput)) {
        localStorage.setItem('docvault_pin', pinInput);
      } else {
        errDiv.style.display = 'block';
        errDiv.textContent = 'PIN code must be exactly 4 digits.';
        return;
      }
    }

    const folderId = this.pendingDeleteFolderId;
    const folder = this.folders.find(f => f.id === folderId);
    const folderName = folder ? folder.name : 'Folder';

    this.folders = this.folders.filter(f => f.id !== folderId);
    this.documents = this.documents.filter(d => d.folderId !== folderId);

    if (this.activeFolder === folderId) {
      this.activeFolder = 'dashboard_overview';
    }

    this.saveToStorage();

    if (window.githubSync.isConfigured()) {
      try {
        await window.githubSync.syncMetadata(this.documents, this.folders);
      } catch (e) {
        console.warn('GitHub delete sync error:', e);
      }
    }

    this.renderFolders();
    this.renderView();
    this.updateStats();
    this.closeModal('delete-folder-modal');
    this.pendingDeleteFolderId = null;
    this.showToast(`Folder "${folderName}" and files permanently deleted.`);
  }

  renderFolders() {
    const dashItem = document.getElementById('nav-dashboard');
    if (this.activeFolder === 'dashboard_overview') {
      dashItem.classList.add('active');
    } else {
      dashItem.classList.remove('active');
    }

    const folderListEl = document.getElementById('folder-list');
    folderListEl.innerHTML = '';

    this.folders.forEach(folder => {
      const count = this.documents.filter(d => d.folderId === folder.id).length;

      const li = document.createElement('li');
      li.className = `folder-item ${this.activeFolder === folder.id ? 'active' : ''}`;
      li.dataset.folderId = folder.id;
      li.innerHTML = `
        <div class="folder-info">
          <i class="fa-solid ${folder.icon}"></i>
          <span>${folder.name}</span>
        </div>
        <div class="folder-right-actions">
          <span class="folder-count">${count}</span>
          <i class="fa-solid fa-trash delete-folder-icon" data-folder-id="${folder.id}" title="Delete Category"></i>
        </div>
      `;
      folderListEl.appendChild(li);
    });
  }

  renderView() {
    const statsSection = document.getElementById('stats-overview-section');
    const folderHeaderBar = document.getElementById('folder-header-bar');
    const folderNameEl = document.getElementById('current-folder-name');
    const folderCountEl = document.getElementById('current-folder-count');

    if (this.activeFolder === 'dashboard_overview') {
      statsSection.style.display = 'grid';
      folderHeaderBar.style.display = 'none';
    } else {
      statsSection.style.display = 'none';
      folderHeaderBar.style.display = 'flex';
      const folder = this.folders.find(f => f.id === this.activeFolder);
      const count = this.documents.filter(d => d.folderId === this.activeFolder).length;
      folderNameEl.textContent = folder ? folder.name : 'Category Folder';
      folderCountEl.textContent = `${count} document(s) in this folder`;
    }

    this.renderDocuments();
  }

  updateFolderSelectDropdown() {
    const select = document.getElementById('doc-folder');
    select.innerHTML = '';
    this.folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      select.appendChild(opt);
    });
  }

  getFilteredDocuments() {
    return this.documents.filter(doc => {
      if (this.activeFolder !== 'dashboard_overview' && doc.folderId !== this.activeFolder) {
        return false;
      }
      if (this.activeTypeFilter !== 'all' && doc.fileType !== this.activeTypeFilter) {
        return false;
      }
      if (this.dateFrom && doc.letterDate < this.dateFrom) {
        return false;
      }
      if (this.dateTo && doc.letterDate > this.dateTo) {
        return false;
      }
      if (this.searchQuery) {
        const inTitle = doc.title.toLowerCase().includes(this.searchQuery);
        const inNotes = doc.notes && doc.notes.toLowerCase().includes(this.searchQuery);
        const inTags = doc.tags.some(t => t.toLowerCase().includes(this.searchQuery));
        if (!inTitle && !inNotes && !inTags) return false;
      }
      return true;
    }).sort((a, b) => {
      if (this.sortOrder === 'date-desc') return new Date(b.letterDate) - new Date(a.letterDate);
      if (this.sortOrder === 'date-asc') return new Date(a.letterDate) - new Date(b.letterDate);
      if (this.sortOrder === 'name-asc') return a.title.localeCompare(b.title);
      if (this.sortOrder === 'name-desc') return b.title.localeCompare(a.title);
      if (this.sortOrder === 'created-desc') return new Date(b.createdAt) - new Date(a.createdAt);
      return 0;
    });
  }

  renderDocuments() {
    const container = document.getElementById('documents-container');
    const emptyState = document.getElementById('empty-state');
    const docs = this.getFilteredDocuments();

    if (docs.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    container.style.display = this.viewMode === 'grid' ? 'grid' : 'flex';
    emptyState.style.display = 'none';
    container.innerHTML = '';

    docs.forEach(doc => {
      if (this.viewMode === 'grid') {
        container.appendChild(this.createGridCard(doc));
      } else {
        container.appendChild(this.createListRow(doc));
      }
    });
  }

  createGridCard(doc) {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.innerHTML = `
      <div class="doc-preview">
        <span class="doc-badge">${doc.fileType.toUpperCase()}</span>
        ${doc.fileType === 'pdf' 
          ? `<i class="fa-solid fa-file-pdf pdf-icon-large"></i>` 
          : `<img src="${doc.fileData}" alt="${doc.title}">`}
      </div>
      <div class="doc-body">
        <div class="doc-title" title="${doc.title}">${doc.title}</div>
        <div class="doc-meta">
          <span><i class="fa-regular fa-calendar"></i> ${doc.letterDate}</span>
          <span>${(doc.fileSize / 1024).toFixed(0)} KB</span>
        </div>
        ${doc.tags.length > 0 ? `
          <div class="doc-tags">
            ${doc.tags.map(t => `<span class="tag-badge">#${t}</span>`).join('')}
          </div>
        ` : ''}
        <div class="doc-actions">
          <button class="btn-icon-sm btn-view" title="Preview Letter"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-icon-sm btn-copy" title="Copy to Clipboard"><i class="fa-regular fa-copy"></i></button>
          <button class="btn-icon-sm btn-download" title="Download"><i class="fa-solid fa-download"></i></button>
          <button class="btn-icon-sm btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;

    card.querySelector('.btn-view').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openViewer(doc);
    });
    card.querySelector('.btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyDocumentToClipboard(doc);
    });
    card.querySelector('.btn-download').addEventListener('click', (e) => {
      e.stopPropagation();
      const a = document.createElement('a');
      a.href = doc.fileData;
      a.download = doc.fileName;
      a.click();
    });
    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteDocument(doc.id);
    });
    card.addEventListener('click', () => this.openViewer(doc));

    return card;
  }

  createListRow(doc) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
      <div class="list-info">
        <div class="list-icon">
          <i class="fa-solid ${doc.fileType === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}" style="color: ${doc.fileType === 'pdf' ? 'var(--accent-rose)' : 'var(--accent-amber)'}"></i>
        </div>
        <div>
          <div style="font-weight: 700; color: var(--text-main);">${doc.title}</div>
          <div style="font-size: 0.78rem; color: var(--text-dim); display: flex; gap: 1rem; margin-top: 2px;">
            <span><i class="fa-regular fa-calendar"></i> ${doc.letterDate}</span>
            <span>${doc.fileName}</span>
            <span>${(doc.fileSize / 1024).toFixed(0)} KB</span>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation();">
        <button class="btn-icon-sm btn-view" title="Preview"><i class="fa-solid fa-eye"></i></button>
        <button class="btn-icon-sm btn-copy" title="Copy"><i class="fa-regular fa-copy"></i></button>
        <button class="btn-icon-sm btn-download" title="Download"><i class="fa-solid fa-download"></i></button>
        <button class="btn-icon-sm btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    row.querySelector('.btn-view').addEventListener('click', () => this.openViewer(doc));
    row.querySelector('.btn-copy').addEventListener('click', () => this.copyDocumentToClipboard(doc));
    row.querySelector('.btn-download').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = doc.fileData;
      a.download = doc.fileName;
      a.click();
    });
    row.querySelector('.btn-delete').addEventListener('click', () => this.deleteDocument(doc.id));
    row.addEventListener('click', () => this.openViewer(doc));

    return row;
  }

  async copyDocumentToClipboard(doc) {
    if (doc.fileType === 'image' && doc.fileData) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = doc.fileData;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width || 800;
        canvas.height = img.height || 1000;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
        if (navigator.clipboard && window.ClipboardItem && blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          this.showToast('Image copied to Clipboard! You can paste (Ctrl+V) anywhere.');
          return;
        }
      } catch (err) {
        console.warn('Canvas image blob copy failed, falling back to text copy:', err);
      }
    }

    try {
      const fullTextContent = `📋 [ShoaibVault Office Letter]
Title: ${doc.title}
Official Date: ${doc.letterDate}
File Name: ${doc.fileName}
${doc.notes ? 'Remarks: ' + doc.notes : ''}
${doc.tags.length > 0 ? 'Tags: #' + doc.tags.join(' #') : ''}`;

      await navigator.clipboard.writeText(fullTextContent);
      this.showToast('Letter details copied to Clipboard! Ready to paste (Ctrl+V).');
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = `Title: ${doc.title} (Date: ${doc.letterDate})`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('Letter info copied to clipboard!');
    }
  }

  showToast(msg) {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    if (toast && msgEl) {
      msgEl.textContent = msg;
      toast.style.display = 'flex';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3500);
    }
  }

  openViewer(doc) {
    this.activeViewerDoc = doc;
    this.viewerZoom = 1;
    this.viewerRotation = 0;

    document.getElementById('viewer-title').textContent = doc.title;
    document.getElementById('viewer-subtitle').textContent = `Official Date: ${doc.letterDate} | File: ${doc.fileName}`;

    const container = document.getElementById('viewer-container');
    const toolbar = document.getElementById('image-toolbar');

    if (doc.fileType === 'pdf') {
      toolbar.style.display = 'none';
      container.innerHTML = `<iframe src="${doc.fileData}" style="width:100%; height:100%; border:none;"></iframe>`;
    } else {
      toolbar.style.display = 'flex';
      container.innerHTML = `<img id="viewer-img" src="${doc.fileData}" alt="${doc.title}">`;
      this.applyViewerTransform();
    }

    this.openModal('viewer-modal');
  }

  updateViewerTransform(zoomDelta, rotateDelta) {
    this.viewerZoom = Math.max(0.5, Math.min(3, this.viewerZoom + zoomDelta));
    this.viewerRotation = (this.viewerRotation + rotateDelta) % 360;
    this.applyViewerTransform();
  }

  applyViewerTransform() {
    const img = document.getElementById('viewer-img');
    const zoomText = document.getElementById('zoom-level-text');
    if (img) {
      img.style.transform = `scale(${this.viewerZoom}) rotate(${this.viewerRotation}deg)`;
    }
    if (zoomText) {
      zoomText.textContent = `${Math.round(this.viewerZoom * 100)}%`;
    }
  }

  async deleteDocument(id) {
    if (confirm('Are you sure you want to permanently delete this office letter?')) {
      const doc = this.documents.find(d => d.id === id);
      const title = doc ? doc.title : 'Letter';

      this.documents = this.documents.filter(d => d.id !== id);
      this.saveToStorage();

      if (window.githubSync.isConfigured()) {
        try {
          await window.githubSync.syncMetadata(this.documents, this.folders);
        } catch (e) {
          console.warn('GitHub delete doc sync error:', e);
        }
      }

      this.renderDocuments();
      this.updateStats();
      this.renderFolders();
      this.showToast(`"${title}" permanently deleted from GitHub.`);
    }
  }

  updateStats() {
    document.getElementById('stat-total').textContent = this.documents.length;
    document.getElementById('stat-folders').textContent = this.folders.length;
    document.getElementById('stat-pdfs').textContent = this.documents.filter(d => d.fileType === 'pdf').length;
    document.getElementById('stat-images').textContent = this.documents.filter(d => d.fileType === 'image').length;
  }

  updateSyncBadge() {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-status-text');
    if (window.githubSync.isConfigured()) {
      dot.classList.add('connected');
      text.textContent = 'GitHub Synced';
    } else {
      dot.classList.remove('connected');
      text.textContent = 'Local Storage Only';
    }
  }

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  createSamplePdfDataUri() {
    return 'data:application/pdf;base64,JVBERi0xLjQKJSDi48jNCiAxIDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iaiAyIDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzMgMCBSXT4+CmVuZG9iaiAzIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqIDQgMCBvYmoKPDwvTGVuZ3RoIDU0Pj5zdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKE9GRklDSUFMIExFVFRFUiBERU1PIFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp0cmFpbGVyCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFI+PgolJUVPRg==';
  }

  createSampleImageSvgDataUri(title) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <rect x="40" y="40" width="720" height="920" fill="#f8fafc" stroke="#2563eb" stroke-width="2" rx="10"/>
      <text x="400" y="120" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#0f172a" text-anchor="middle">OFFICIAL DOCUMENT SCAN</text>
      <line x1="80" y1="160" x2="720" y2="160" stroke="#e2e8f0" stroke-width="2"/>
      <text x="400" y="240" font-family="Arial, sans-serif" font-size="22" fill="#2563eb" text-anchor="middle">${title}</text>
      <text x="100" y="320" font-family="Arial, sans-serif" font-size="16" fill="#475569">Date: August 24, 2026</text>
      <text x="100" y="360" font-family="Arial, sans-serif" font-size="16" fill="#475569">Ref No: GOVT-DOC/2026/SEC-99</text>
      <rect x="100" y="420" width="600" height="300" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" rx="8"/>
      <text x="120" y="460" font-family="Arial, sans-serif" font-size="14" fill="#0f172a">[ Scanned Copy of Office Letter ]</text>
      <text x="120" y="500" font-family="Arial, sans-serif" font-size="14" fill="#475569">This document is verified and archived in ShoaibVault.</text>
      <circle cx="620" cy="800" r="50" fill="none" stroke="#0d9488" stroke-width="4"/>
      <text x="620" y="805" font-family="Arial, sans-serif" font-size="14" fill="#0d9488" text-anchor="middle">VERIFIED</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new DocumentVaultApp();
});
