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
    return Boolean(this.token && this.token.startsWith('ghp_') && this.repo && this.repo.includes('/'));
  }

  saveCredentials(token, repo = 'Abrarkhangg/Officeletters', branch = 'main') {
    this.token = token.trim();
    this.repo = repo.trim();
    this.branch = branch.trim() || 'main';
    localStorage.setItem('docvault_gh_token', this.token);
    localStorage.setItem('docvault_gh_repo', this.repo);
    localStorage.setItem('docvault_gh_branch', this.branch);
  }

  async testConnection() {
    if (!this.isConfigured()) return { success: false, message: 'Token missing or invalid format.' };

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
        const err = await response.json();
        return { success: false, message: err.message || 'Access denied' };
      }
    } catch (e) {
      return { success: false, message: 'Network error or invalid repo endpoint.' };
    }
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

    const result = await res.json();
    return result.content.download_url || result.content.html_url;
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
        ghPath: doc.ghPath || `letters/${doc.id}_${doc.fileName}`
      }))
    };

    const jsonStr = JSON.stringify(indexData);
    const base64Index = btoa(unescape(encodeURIComponent(jsonStr)));
    await this.uploadFile('documents-index.json', base64Index, 'Update ShoaibVault letters index');
  }

  async fetchMetadata() {
    if (!this.isConfigured()) return null;
    const url = `https://api.github.com/repos/${this.repo}/contents/documents-index.json?ref=${this.branch}&t=${Date.now()}`;

    try {
      const res = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${this.token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!res.ok) return null;

      const fileData = await res.json();
      const content = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
      return JSON.parse(content);
    } catch (e) {
      console.warn('Failed to fetch remote metadata from GitHub:', e);
      return null;
    }
  }
}

window.githubSync = new GitHubSync();
