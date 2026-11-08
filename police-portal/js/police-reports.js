/**
 * SheGuard Law Enforcement Portal - Incident Reports Management Controller
 * Architecture: FRONTEND 2 (Multi-Filter Case Registry & Export)
 */

import { policeApi } from './police-api.js';
import { policeAuth, PRE_AUTHORIZED_OFFICERS } from './police-auth.js';
import { showPoliceToast } from './police-guards.js';

export class PoliceReportsController {
  constructor() {
    this.reports = [];
    this.statusFilter = 'ALL';
    this.categoryFilter = 'ALL';
    this.priorityFilter = 'ALL';
    this.searchQuery = '';
    this.sortBy = 'DATE_DESC';
    this.currentPage = 1;
    this.pageSize = 10;
  }

  async init() {
    await this.loadReports();
    this.bindEvents();
  }

  async loadReports() {
    try {
      this.reports = await policeApi.getReports();
      this.render();
    } catch (err) {
      showPoliceToast('Failed to load incident reports: ' + err.message, 'danger');
    }
  }

  bindEvents() {
    // Status Filter
    const statusSelect = document.getElementById('reportStatusFilter');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    // Category Filter
    const catSelect = document.getElementById('reportCategoryFilter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.categoryFilter = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    // Priority Filter
    const prioSelect = document.getElementById('reportPriorityFilter');
    if (prioSelect) {
      prioSelect.addEventListener('change', (e) => {
        this.priorityFilter = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    // Search Box
    const searchInput = document.getElementById('reportSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.currentPage = 1;
        this.render();
      });
    }

    // Sort Select
    const sortSelect = document.getElementById('reportSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });
    }

    // Export CSV
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => this.exportCsv());
    }

    // Export JSON
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportJson());
    }
  }

  getFilteredReports() {
    let list = this.reports.filter(r => {
      const status = (r.status || '').toUpperCase();
      const cat = (r.category || '').toLowerCase();
      const prio = (r.priority || 'MEDIUM').toUpperCase();

      if (this.statusFilter !== 'ALL' && status !== this.statusFilter) return false;
      if (this.categoryFilter !== 'ALL' && cat !== this.categoryFilter.toLowerCase()) return false;
      if (this.priorityFilter !== 'ALL' && prio !== this.priorityFilter) return false;

      if (this.searchQuery) {
        const ref = (r.reference || '').toLowerCase();
        const desc = (r.description || '').toLowerCase();
        const loc = (r.location?.address || '').toLowerCase();
        const off = (r.assignedOfficerName || '').toLowerCase();
        if (!ref.includes(this.searchQuery) && !desc.includes(this.searchQuery) && !loc.includes(this.searchQuery) && !off.includes(this.searchQuery)) {
          return false;
        }
      }
      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (this.sortBy === 'DATE_DESC') return (b.createdAt || 0) - (a.createdAt || 0);
      if (this.sortBy === 'DATE_ASC') return (a.createdAt || 0) - (b.createdAt || 0);
      if (this.sortBy === 'PRIORITY') {
        const pOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (pOrder[b.priority || 'MEDIUM'] || 0) - (pOrder[a.priority || 'MEDIUM'] || 0);
      }
      return 0;
    });

    return list;
  }

  render() {
    const tbody = document.getElementById('reportsRegistryTbody');
    if (!tbody) return;

    const filtered = this.getFilteredReports();
    const totalPages = Math.ceil(filtered.length / this.pageSize) || 1;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paged = filtered.slice(startIndex, startIndex + this.pageSize);

    // Summary Counter
    const countEl = document.getElementById('reportsMatchingCount');
    if (countEl) countEl.textContent = `${filtered.length} matching incidents`;

    if (paged.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 3rem; color: var(--police-text-muted);">
            <div style="font-size: 28px; margin-bottom: 8px;">📋</div>
            No incident records match the active criteria in the law enforcement registry.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = paged.map(r => {
      const priorityClass = `badge-priority-${(r.priority || 'medium').toLowerCase()}`;
      const statusClass = `badge-${(r.status || 'submitted').toLowerCase().replace(/_/g, '-')}`;
      const loc = r.location?.address || (r.location?.latitude ? `${r.location.latitude.toFixed(3)}, ${r.location.longitude.toFixed(3)}` : 'Confidential');
      const hasEvidence = Boolean(r.evidenceUrl);

      return `
        <tr>
          <td>
            <a href="police-investigation.html?ref=${encodeURIComponent(r.reference)}" class="police-ref-id">
              ${this.escape(r.reference)}
            </a>
          </td>
          <td>
            <span class="police-badge ${priorityClass}">${this.escape(r.priority || 'MEDIUM')}</span>
          </td>
          <td style="color: #fff; font-weight: 500;">
            ${this.escape(this.formatCategory(r.category))}
          </td>
          <td style="max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escape(loc)}">
            📍 ${this.escape(loc)}
          </td>
          <td style="font-family: var(--font-mono); font-size: 11.5px;">
            ${this.escape(r.incidentDate || 'N/A')} ${this.escape(r.incidentTime || '')}
          </td>
          <td>
            <span class="police-badge ${statusClass}">${this.escape(this.formatStatus(r.status))}</span>
          </td>
          <td>
            ${hasEvidence ? '<span style="color: var(--police-cyan); font-size: 13px;" title="Evidence Attached">📎 Yes</span>' : '<span style="color: var(--police-text-muted);">None</span>'}
          </td>
          <td>
            <span style="color: var(--police-text-cyan); font-weight: 500;">
              ${this.escape(r.assignedOfficerName || 'Unassigned')}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <a href="police-investigation.html?ref=${encodeURIComponent(r.reference)}" class="police-btn police-btn-secondary police-btn-sm" title="Open Full Dossier">
                Inspect
              </a>
              <button class="police-btn police-btn-primary police-btn-sm assign-officer-btn" data-ref="${this.escape(r.reference)}">
                Assign
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach assign listeners
    tbody.querySelectorAll('.assign-officer-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openAssignModal(btn.dataset.ref));
    });

    // Pagination
    const pageIndicator = document.getElementById('reportsPageIndicator');
    if (pageIndicator) pageIndicator.textContent = `Page ${this.currentPage} of ${totalPages}`;

    const prevBtn = document.getElementById('reportsPrevBtn');
    const nextBtn = document.getElementById('reportsNextBtn');
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
      prevBtn.onclick = () => { if (this.currentPage > 1) { this.currentPage--; this.render(); } };
    }
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
      nextBtn.onclick = () => { if (this.currentPage < totalPages) { this.currentPage++; this.render(); } };
    }
  }

  openAssignModal(reference) {
    const modal = document.getElementById('assignOfficerModal');
    if (!modal) return;

    document.getElementById('assignModalRef').textContent = reference;

    const select = document.getElementById('assignOfficerSelect');
    if (select) {
      select.innerHTML = PRE_AUTHORIZED_OFFICERS.map(o => `
        <option value="${o.id}">${o.rank} - ${o.name} (${o.department})</option>
      `).join('');
    }

    modal.classList.add('open');

    const confirmBtn = document.getElementById('confirmAssignBtn');
    confirmBtn.onclick = async () => {
      const selectedId = select.value;
      const officer = PRE_AUTHORIZED_OFFICERS.find(o => o.id === selectedId) || PRE_AUTHORIZED_OFFICERS[0];
      const priority = document.getElementById('assignPrioritySelect').value;

      try {
        await policeApi.assignOfficer(reference, { ...officer, priority });
        showPoliceToast(`Case ${reference} assigned to ${officer.name}`, 'success');
        modal.classList.remove('open');
        await this.loadReports();
      } catch (e) {
        showPoliceToast('Assignment error: ' + e.message, 'danger');
      }
    };

    document.getElementById('closeAssignModalBtn').onclick = () => modal.classList.remove('open');
  }

  exportCsv() {
    const data = this.getFilteredReports();
    if (data.length === 0) {
      showPoliceToast('No records to export.', 'warning');
      return;
    }

    const headers = ['Reference', 'Priority', 'Category', 'IncidentDate', 'IncidentTime', 'Location', 'Status', 'AssignedOfficer', 'CreatedAt'];
    const rows = data.map(r => [
      `"${r.reference}"`,
      `"${r.priority || 'MEDIUM'}"`,
      `"${r.category}"`,
      `"${r.incidentDate || ''}"`,
      `"${r.incidentTime || ''}"`,
      `"${(r.location?.address || '').replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${r.assignedOfficerName || 'Unassigned'}"`,
      `"${new Date(r.createdAt || Date.now()).toISOString()}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sheguard_police_incidents_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showPoliceToast('Exported incidents CSV dossier successfully.', 'success');
  }

  exportJson() {
    const data = this.getFilteredReports();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sheguard_police_dossier_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showPoliceToast('Exported incidents JSON dossier successfully.', 'success');
  }

  formatCategory(cat) {
    const map = {
      harassment: 'Harassment / Eve Teasing',
      stalking: 'Stalking / Following',
      physical_assault: 'Physical Assault',
      threats: 'Threats / Intimidation',
      cyber_harassment: 'Cyber Harassment',
      unsafe_location: 'Unsafe Location',
      other: 'Other Incident'
    };
    return map[cat] || (cat ? cat.replace(/_/g, ' ') : 'General Safety');
  }

  formatStatus(status) {
    if (!status) return 'Submitted';
    return status.replace(/_/g, ' ');
  }

  escape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}
