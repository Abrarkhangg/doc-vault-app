/**
 * Custom Document Vault - Main Application Engine
 */

class DocumentVaultApp {
  constructor() {
    this.folders = JSON.parse(localStorage.getItem('docvault_folders')) || [
      { id: 'all', name: 'All Letters', icon: 'fa-box-archive' },
      { id: 'official', name: 'Official Notices', icon: 'fa-building-columns' },
      { id: 'finance', name: 'Invoices & Finance', icon: 'fa-receipt' },
      { id: 'contracts', name: 'Lease & Contracts', icon: 'fa-file-signature' },
      { id: 'hr', name: 'HR & Staffing', icon: 'fa-users' }
    ];

    this.documents = JSON.parse(localStorage.getItem('docvault_documents')) || [];
    this.activeFolder = 'all';
    this.activeTypeFilter = 'all';
    this.searchQuery = '';
    this.sortOrder = 'date-desc';
    this.viewMode = 'grid';

    // Viewer modal transform state
    this.viewerZoom = 1;
    this.viewerRotation = 0;
    this.activeViewerDoc = null;

    this.init();
  }

  init() {
    // Inject demo data if first run
    if (this.documents.length === 0) {
      this.injectDemoData();
    }

    this.setupEventListeners();
    this.checkSecurityLock();
    this.renderFolders();
    this.renderDocuments();
    this.updateStats();
    this.updateSyncBadge();
  }

  injectDemoData() {
    const demoDocs = [
      {
        id: 'doc_demo_1',
        title: 'Ministry Office Allocation Notice 2026',
        letterDate: '2026-06-15',
        createdAt: '2026-06-16T10:30:00.000Z',
        folderId: 'official',
        tags: ['Government', 'Notice', 'Urgent'],
        notes: 'Ref No: GOVT/OFF/2026/894. Office floor 4 assignment.',
        fileType: 'pdf',
        fileName: 'Ministry_Notice_2026.pdf',
        fileSize: 450000,
        fileData: this.createSamplePdfDataUri()
      },
      {
        id: 'doc_demo_2',
        title: 'Building Lease Extension Agreement',
        letterDate: '2026-03-01',
        createdAt: '2026-03-02T14:15:00.000Z',
        folderId: 'contracts',
        tags: ['Lease', 'Legal', 'Commercial'],
        notes: 'Signed 3-year extension with Plaza Landlords.',
        fileType: 'image',
        fileName: 'Lease_Agreement_Page1.png',
        fileSize: 320000,
        fileData: this.createSampleImageSvgDataUri('LEASE AGREEMENT 2026')
      },
      {
        id: 'doc_demo_3',
        title: 'Q2 Office Supplies & Furniture Invoice',
        letterDate: '2026-07-20',
        createdAt: '2026-07-21T09:00:00.000Z',
        folderId: 'finance',
        tags: ['Invoice', 'Vendor', 'Paid'],
        notes: 'Invoice #INV-9942 - Total PKR 145,000.',
        fileType: 'image',
        fileName: 'Vendor_Invoice_Q2.jpg',
        fileSize: 280000,
        fileData: this.createSampleImageSvgDataUri('OFFICE INVOICE #9942')
      }
    ];

    this.documents = demoDocs;
    this.saveToStorage();
  }

  saveToStorage() {
    localStorage.setItem('docvault_folders', JSON.stringify(this.folders));
    localStorage.setItem('docvault_documents', JSON.stringify(this.documents));
  }

  checkSecurityLock() {
    const pin = localStorage.getItem('docvault_pin');
    const lockScreen = document.getElementById('lock-screen');
    if (pin) {
      lockScreen.style.display = 'flex';
    } else {
      lockScreen.style.display = 'none';
    }
  }

  setupEventListeners() {
    // PIN Unlock
    document.getElementById('unlock-btn').addEventListener('click', () => this.handleUnlock());
    document.getElementById('pin-input').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.handleUnlock();
    });

    // Sidebar Folder Click
    document.getElementById('folder-list').addEventListener('click', (e) => {
      const item = e.target.closest('.folder-item');
      if (item) {
        this.activeFolder = item.dataset.folderId;
        this.renderFolders();
        this.renderDocuments();
      }
    });

    // Add Folder Button
    document.getElementById('btn-add-folder').addEventListener('click', () => {
      this.openModal('folder-modal');
    });
    document.getElementById('folder-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('folder-name-input');
      if (input.value.trim()) {
        const newFolder = {
          id: 'folder_' + Date.now(),
          name: input.value.trim(),
          icon: 'fa-folder'
        };
        this.folders.push(newFolder);
        this.saveToStorage();
        this.renderFolders();
        this.updateFolderSelectDropdown();
        this.closeModal('folder-modal');
        input.value = '';
      }
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
    const fileInfo = document.getElementById('selected-file-info');

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
      if (!localStorage.getItem('docvault_pin')) {
        alert('Please set up a 4-digit Security PIN first in Settings.');
        this.openModal('settings-modal');
      } else {
        document.getElementById('lock-screen').style.display = 'flex';
      }
    });

    // Settings Modal
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('gh-token').value = window.githubSync.token;
      document.getElementById('gh-repo').value = window.githubSync.repo;
      document.getElementById('new-pin').value = localStorage.getItem('docvault_pin') || '';
      this.openModal('settings-modal');
    });

    // GitHub Connection Test
    document.getElementById('btn-test-gh').addEventListener('click', async () => {
      const token = document.getElementById('gh-token').value;
      const repo = document.getElementById('gh-repo').value;
      window.githubSync.saveCredentials(token, repo);

      const resDiv = document.getElementById('gh-test-result');
      resDiv.style.display = 'block';
      resDiv.innerHTML = '<span style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Testing connection to GitHub...</span>';

      const res = await window.githubSync.testConnection();
      if (res.success) {
        resDiv.innerHTML = `<span style="color: var(--accent-teal);"><i class="fa-solid fa-check-circle"></i> Connected to ${res.name} (${res.isPrivate ? 'Private Repo' : 'Public Repo'})</span>`;
        this.updateSyncBadge();
      } else {
        resDiv.innerHTML = `<span style="color: var(--accent-rose);"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${res.message}</span>`;
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
      } else if (pinVal === '') {
        localStorage.removeItem('docvault_pin');
        alert('PIN Lock disabled.');
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

    // Viewer Download & Print
    document.getElementById('btn-viewer-download').addEventListener('click', () => {
      if (this.activeViewerDoc) {
        const a = document.createElement('a');
        a.href = this.activeViewerDoc.fileData;
        a.download = this.activeViewerDoc.fileName;
        a.click();
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

  handleUnlock() {
    const input = document.getElementById('pin-input');
    const savedPin = localStorage.getItem('docvault_pin');
    if (input.value === savedPin) {
      document.getElementById('lock-screen').style.display = 'none';
      document.getElementById('pin-error').style.display = 'none';
      input.value = '';
    } else {
      document.getElementById('pin-error').style.display = 'block';
    }
  }

  handleFileSelected(file) {
    const infoDiv = document.getElementById('selected-file-info');
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = `<i class="fa-solid fa-file"></i> Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    // Auto-fill title if empty
    const titleInput = document.getElementById('doc-title');
    if (!titleInput.value) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      titleInput.value = cleanName;
    }
  }

  async handleSaveDocument() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files[0] && !this.editingDocId) {
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

      // If GitHub configured, upload in background
      if (window.githubSync.isConfigured()) {
        try {
          const ghPath = `letters/${newDoc.id}_${newDoc.fileName}`;
          await window.githubSync.uploadFile(ghPath, fileData, `Add letter: ${newDoc.title}`);
          newDoc.ghPath = ghPath;
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
    };

    reader.readAsDataURL(file);
  }

  renderFolders() {
    const folderListEl = document.getElementById('folder-list');
    folderListEl.innerHTML = '';

    this.folders.forEach(folder => {
      const count = folder.id === 'all' 
        ? this.documents.length 
        : this.documents.filter(d => d.folderId === folder.id).length;

      const li = document.createElement('li');
      li.className = `folder-item ${this.activeFolder === folder.id ? 'active' : ''}`;
      li.dataset.folderId = folder.id;
      li.innerHTML = `
        <div class="folder-info">
          <i class="fa-solid ${folder.icon}"></i>
          <span>${folder.name}</span>
        </div>
        <span class="folder-count">${count}</span>
      `;
      folderListEl.appendChild(li);
    });
  }

  updateFolderSelectDropdown() {
    const select = document.getElementById('doc-folder');
    select.innerHTML = '';
    this.folders.filter(f => f.id !== 'all').forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      select.appendChild(opt);
    });
  }

  getFilteredDocuments() {
    return this.documents.filter(doc => {
      // Folder filter
      if (this.activeFolder !== 'all' && doc.folderId !== this.activeFolder) {
        return false;
      }
      // Type filter
      if (this.activeTypeFilter !== 'all' && doc.fileType !== this.activeTypeFilter) {
        return false;
      }
      // Search query
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
          <button class="btn-icon-sm btn-download" title="Download"><i class="fa-solid fa-download"></i></button>
          <button class="btn-icon-sm btn-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;

    card.querySelector('.btn-view').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openViewer(doc);
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
          <div style="font-weight: 600; color: var(--text-main);">${doc.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); display: flex; gap: 1rem; margin-top: 2px;">
            <span><i class="fa-regular fa-calendar"></i> ${doc.letterDate}</span>
            <span>${doc.fileName}</span>
            <span>${(doc.fileSize / 1024).toFixed(0)} KB</span>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation();">
        <button class="btn-icon-sm btn-view"><i class="fa-solid fa-eye"></i></button>
        <button class="btn-icon-sm btn-download"><i class="fa-solid fa-download"></i></button>
        <button class="btn-icon-sm btn-delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    row.querySelector('.btn-view').addEventListener('click', () => this.openViewer(doc));
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

  deleteDocument(id) {
    if (confirm('Are you sure you want to delete this office letter?')) {
      this.documents = this.documents.filter(d => d.id !== id);
      this.saveToStorage();
      this.renderDocuments();
      this.updateStats();
      this.renderFolders();
    }
  }

  updateStats() {
    document.getElementById('stat-total').textContent = this.documents.length;
    document.getElementById('stat-folders').textContent = this.folders.length - 1; // minus All
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
    // A lightweight valid sample PDF data URI
    return 'data:application/pdf;base64,JVBERi0xLjQKJSDi48jNCiAxIDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+CmVuZG9iaiAyIDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzMgMCBSXT4+CmVuZG9iaiAzIDAgb2JqCjw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqIDQgMCBvYmoKPDwvTGVuZ3RoIDU0Pj5zdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKE9GRklDSUFMIExFVFRFUiBERU1PIFBERikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp0cmFpbGVyCjw8L1Jvb3QgMSAwIFI+PgolJUVPRg==';
  }

  createSampleImageSvgDataUri(title) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <rect x="40" y="40" width="720" height="920" fill="#0f172a" stroke="#6366f1" stroke-width="2" rx="10"/>
      <text x="400" y="120" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">OFFICIAL DOCUMENT SCAN</text>
      <line x1="80" y1="160" x2="720" y2="160" stroke="#334155" stroke-width="2"/>
      <text x="400" y="240" font-family="Arial, sans-serif" font-size="22" fill="#818cf8" text-anchor="middle">${title}</text>
      <text x="100" y="320" font-family="Arial, sans-serif" font-size="16" fill="#94a3b8">Date: August 24, 2026</text>
      <text x="100" y="360" font-family="Arial, sans-serif" font-size="16" fill="#94a3b8">Ref No: GOVT-DOC/2026/SEC-99</text>
      <rect x="100" y="420" width="600" height="300" fill="#1e293b" rx="8"/>
      <text x="120" y="460" font-family="Arial, sans-serif" font-size="14" fill="#cbd5e1">[ Scanned Copy of Office Letter ]</text>
      <text x="120" y="500" font-family="Arial, sans-serif" font-size="14" fill="#94a3b8">This document is verified and archived in the custom Document Vault.</text>
      <circle cx="620" cy="800" r="50" fill="none" stroke="#2dd4bf" stroke-width="4"/>
      <text x="620" y="805" font-family="Arial, sans-serif" font-size="14" fill="#2dd4bf" text-anchor="middle">VERIFIED</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new DocumentVaultApp();
});
