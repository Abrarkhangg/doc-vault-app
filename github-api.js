/**
 * Custom Document Vault - GitHub Private Repository API Integration (ShoaibVault)
 * Optimized for Abrarkhangg/Officeletters GitHub Cloud Backend
 */

class GitHubSync {
  constructor() {
    this.repo = localStorage.getItem('docvault_gh_repo') || 'Abrarkhangg/Officeletters';
    this.branch = localStorage.getItem('docvault_gh_branch') || 'main';
    this.token = localStorage.getItem('docvault_gh_token') || '';
  }

  isConfigured() {
    // Accepts any valid GitHub PAT format (ghp_..., github_pat_..., etc.)
    return Boolean(this.token && this.token.length >= 15 && this.repo && this.repo.includes('/'));
  }

  saveCredentials(token, repo = 'Abrarkhangg/Officeletters', branch = 'main') {
    this.token = token ? token.trim() : '';
    this.repo = repo ? repo.trim() : 'Abrarkhangg/Officeletters';
    this.branch = branch ? branch.trim() : 'main';
    localStorage.setItem('docvault_gh_token', this.token);
    localStorage.setItem('docvault_gh_repo', this.repo);
    localStorage.setItem('docvault_gh_branch', this.branch);
  }

  async testConnection() {
    if (!this.isConfigured()) return { success: false, message: 'Please enter a valid GitHub Personal Access Token.' };

    try {
      const response = await fetch(`https://api.github.com/repos/${this.repo}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, isPrivate: data.private, name: data.full_name };
      } else {
        const err = await response.json().catch(() => ({}));
        if (response.status === 404) {
          return { success: false, message: '404 Not Found: Check repo name or make sure token has `repo` scope.' };
        } else if (response.status === 401) {
          return { success: false, message: '401 Unauthorized: Invalid or expired PAT token.' };
        }
        return { success: false, message: err.message || `HTTP Error ${response.status}` };
      }
    } catch (e) {
      return { success: false, message: 'Network connection failed.' };
    }
  }

  /**
   * Scans Abrarkhangg/Officeletters for all PDF and Image files
   */
  async fetchAllRepoFiles() {
    if (!this.isConfigured()) return [];

    const discoveredDocs = [];
    const processedPaths = new Set();

    const scanDirectory = async (dirPath = '') => {
      const url = `https://api.github.com/repos/${this.repo}/contents/${dirPath}?ref=${this.branch}&t=${Date.now()}`;
      try {
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache'
          }
        });
        if (!res.ok) return;

        const items = await res.json();
        if (!Array.isArray(items)) return;

        for (const item of items) {
          if (item.type === 'dir') {
            await scanDirectory(item.path);
          } else if (item.type === 'file') {
            const ext = item.name.split('.').pop().toLowerCase();
            if (['pdf', 'png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) {
              if (!processedPaths.has(item.path)) {
                processedPaths.add(item.path);

                let fileDataUrl = item.download_url;
                try {
                  const rawRes = await fetch(item.url, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                  });
                  if (rawRes.ok) {
                    const rawJson = await rawRes.json();
                    if (rawJson.content) {
                      const mime = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                      fileDataUrl = `data:${mime};base64,${rawJson.content.replace(/\s/g, '')}`;
                    }
                  }
                } catch (e) {
                  console.warn('Raw file content fetch fallback:', item.name);
                }

                const cleanTitle = item.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                discoveredDocs.push({
                  id: 'gh_' + (item.sha ? item.sha.substring(0, 12) : Date.now()),
                  title: cleanTitle,
                  letterDate: new Date().toISOString().split('T')[0],
                  createdAt: new Date().toISOString(),
                  folderId: 'official',
                  tags: ['GitHub', ext.toUpperCase()],
                  notes: `File in repository: ${item.path}`,
                  fileType: ext === 'pdf' ? 'pdf' : 'image',
                  fileName: item.name,
                  fileSize: item.size || 150000,
                  fileData: fileDataUrl,
                  ghPath: item.path,
                  sha: item.sha
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Directory scan error:', dirPath, e);
      }
    };

    await scanDirectory('');
    return discoveredDocs;
  }

  async uploadFile(path, base64Content, commitMessage = 'Add office letter document') {
    if (!this.isConfigured()) throw new Error('GitHub PAT Token not configured');

    const cleanBase64 = base64Content.includes(',') ? base64Content.split(',')[1] : base64Content;
    const url = `https://api.github.com/repos/${this.repo}/contents/${encodeURIComponent(path)}`;

    let sha = null;
    try {
      const getRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }
    } catch (e) {}

    const payload = {
      message: commitMessage,
      content: cleanBase64,
      branch: this.branch
    };
    if (sha) payload.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Failed to upload to GitHub');
    }

    return await res.json();
  }

  async deleteFileFromGitHub(path, sha, commitMessage = 'Delete office letter') {
    if (!this.isConfigured()) return false;

    const url = `https://api.github.com/repos/${this.repo}/contents/${encodeURIComponent(path)}`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: commitMessage,
          sha: sha,
          branch: this.branch
        })
      });
      return res.ok;
    } catch (e) {
      console.warn('Failed to delete file from GitHub:', path, e);
      return false;
    }
  }

  async syncMetadata(documentsList, foldersList) {
    if (!this.isConfigured()) return;
    const indexData = {
      updatedAt: new Date().toISOString(),
      folders: foldersList,
      documents: documentsList.map(doc => ({
        id: doc.id,
        title: doc.title,
        letterDate: doc.letterDate,
        createdAt: doc.createdAt,
        folderId: doc.folderId,
        tags: doc.tags,
        notes: doc.notes || '',
        fileType: doc.fileType,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileData: doc.fileData,
        ghPath: doc.ghPath || `letters/${doc.id}_${doc.fileName}`,
        sha: doc.sha || ''
      }))
    };

    const jsonStr = JSON.stringify(indexData);
    const base64Index = btoa(unescape(encodeURIComponent(jsonStr)));
    await this.uploadFile('documents-index.json', base64Index, 'Update ShoaibVault letters index');
  }

  async fetchMetadata() {
    if (!this.isConfigured()) return null;
    
    const url = `https://api.github.com/repos/${this.repo}/contents/documents-index.json?ref=${this.branch}&t=${Date.now()}`;
    let jsonDocs = null;
    let jsonFolders = null;

    try {
      const res = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const fileData = await res.json();
        const content = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
        const parsed = JSON.parse(content);
        jsonDocs = parsed.documents;
        jsonFolders = parsed.folders;
      }
    } catch (e) {}

    const repoFiles = await this.fetchAllRepoFiles();

    if (jsonDocs && Array.isArray(jsonDocs)) {
      const mergedMap = new Map();
      jsonDocs.forEach(d => mergedMap.set(d.fileName, d));
      repoFiles.forEach(rf => {
        if (!mergedMap.has(rf.fileName)) {
          mergedMap.set(rf.fileName, rf);
        }
      });
      return {
        documents: Array.from(mergedMap.values()),
        folders: jsonFolders
      };
    }

    return {
      documents: repoFiles,
      folders: null
    };
  }
}

window.githubSync = new GitHubSync();
