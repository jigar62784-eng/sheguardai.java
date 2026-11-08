/**
 * SheGuard Law Enforcement Portal - Police Command Center Dashboard
 * Architecture: FRONTEND 2 (Live Incident Statistics, Review Queue & Fast Dispatch)
 */

import { policeApi } from './police-api.js';
import { policeAuth } from './police-auth.js';
import { showPoliceToast } from './police-guards.js';

export class PoliceDashboardController {
  constructor() {
    this.reports = [];
    this.emergencyAlerts = [];
    this.activeFilter = 'ALL';
    this.searchQuery = '';
    this.currentPage = 1;
    this.pageSize = 6;
  }

  async init() {
    await Promise.allSettled([
      this.loadDashboardMetrics(),
      this.loadRecentIncidents(),
      this.loadActiveEmergencyFeed()
    ]);

    this.bindEvents();
  }

  bindEvents() {
    // Filter tabs
    document.querySelectorAll('.police-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.police-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter || 'ALL';
        this.currentPage = 1;
        this.renderTable();
      });
    });

    // Search input
    const searchInput = document.getElementById('dashboardSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.currentPage = 1;
        this.renderTable();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('dashboardRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span>⏳ Syncing...</span>';
        await this.init();
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<span>🔄 Refresh Data</span>';
        showPoliceToast('Command center synchronized with Cloud Firestore.', 'info');
      });
    }
  }

  async loadDashboardMetrics() {
    try {
      this.reports = await policeApi.getReports();
      this.emergencyAlerts = await policeApi.getEmergencyAlerts();

      const total = this.reports.length;
      const newReports = this.reports.filter(r => (r.status || '').toUpperCase() === 'SUBMITTED').length;
      const pending = this.reports.filter(r => (r.status || '').toUpperCase().includes('PENDING')).length;
      const investigating = this.reports.filter(r => (r.status || '').toUpperCase() === 'UNDER_INVESTIGATION' || (r.status || '').toUpperCase() === 'ASSIGNED').length;
      const verified = this.reports.filter(r => (r.status || '').toUpperCase() === 'VERIFIED').length;
      const resolved = this.reports.filter(r => (r.status || '').toUpperCase() === 'RESOLVED').length;
      const activeSos = this.emergencyAlerts.filter(a => a.status === 'SENT' || a.status === 'ACTIVE' || a.status === 'PENDING').length;

      this.updateCounter('metricTotalIncidents', total);
      this.updateCounter('metricNewReports', newReports);
      this.updateCounter('metricPendingVerification', pending);
      this.updateCounter('metricUnderInvestigation', investigating);
      this.updateCounter('metricVerifiedCases', verified);
      this.updateCounter('metricResolvedCases', resolved);
      this.updateCounter('metricActiveSos', activeSos);
    } catch (e) {
      console.warn('[Police Dashboard] Metric load warning:', e);
    }
  }

  updateCounter(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = value;
  }

  async loadRecentIncidents() {
    this.renderTable();
  }

  getFilteredReports() {
    return this.reports.filter(r => {
      const status = (r.status || '').toUpperCase();
      const priority = (r.priority || 'MEDIUM').toUpperCase();

      // Tab filter
      if (this.activeFilter === 'NEW' && status !== 'SUBMITTED') return false;
      if (this.activeFilter === 'INVESTIGATING' && status !== 'UNDER_INVESTIGATION' && status !== 'ASSIGNED') return false;
      if (this.activeFilter === 'VERIFIED' && status !== 'VERIFIED') return false;
      if (this.activeFilter === 'HIGH_PRIORITY' && priority !== 'HIGH' && priority !== 'CRITICAL') return false;

      // Text search
      if (this.searchQuery) {
        const refMatch = (r.reference || '').toLowerCase().includes(this.searchQuery);
        const catMatch = (r.category || '').toLowerCase().includes(this.searchQuery);
        const locMatch = (r.location?.address || '').toLowerCase().includes(this.searchQuery);
        const offMatch = (r.assignedOfficerName || '').toLowerCase().includes(this.searchQuery);
        if (!refMatch && !catMatch && !locMatch && !offMatch) return false;
      }

      return true;
    });
  }

  renderTable() {
    const tbody = document.getElementById('dashboardIncidentsTbody');
    if (!tbody) return;

    const filtered = this.getFilteredReports();
    const totalPages = Math.ceil(filtered.length / this.pageSize) || 1;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const paged = filtered.slice(startIndex, startIndex + this.pageSize);

    if (paged.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--police-text-muted);">
            <div style="font-size: 24px; margin-bottom: 8px;">📂</div>
            No police incident records matching the selected command filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = paged.map(r => {
      const priorityClass = `badge-priority-${(r.priority || 'medium').toLowerCase()}`;
      const statusClass = `badge-${(r.status || 'submitted').toLowerCase().replace(/_/g, '-')}`;
      const locationText = r.location?.address || (r.location?.latitude ? `${r.location.latitude.toFixed(3)}, ${r.location.longitude.toFixed(3)}` : 'Location Confidential');
      const categoryLabel = this.formatCategory(r.category);

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
          <td style="font-weight: 500; color: #fff;">
            ${this.escape(categoryLabel)}
          </td>
          <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escape(locationText)}">
            📍 ${this.escape(locationText)}
          </td>
          <td>
            <span style="font-family: var(--font-mono); font-size: 11.5px;">${this.escape(r.incidentDate || 'N/A')}</span>
          </td>
          <td>
            <span class="police-badge ${statusClass}">${this.formatStatus(r.status)}</span>
          </td>
          <td>
            <span style="color: var(--police-text-cyan); font-weight: 500;">
              ${this.escape(r.assignedOfficerName || 'Unassigned')}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px;">
              <a href="police-investigation.html?ref=${encodeURIComponent(r.reference)}" class="police-btn police-btn-secondary police-btn-sm" title="Investigate Dossier">
                <span>Dossier</span>
              </a>
              <button class="police-btn police-btn-primary police-btn-sm quick-status-btn" data-ref="${this.escape(r.reference)}" data-status="${this.escape(r.status || 'SUBMITTED')}">
                <span>Status</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach quick status listeners
    tbody.querySelectorAll('.quick-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openQuickStatusModal(btn.dataset.ref, btn.dataset.status);
      });
    });

    // Update pagination controls
    const pageIndicator = document.getElementById('dashboardPageIndicator');
    if (pageIndicator) {
      pageIndicator.textContent = `Page ${this.currentPage} of ${totalPages} (${filtered.length} total)`;
    }

    const prevBtn = document.getElementById('dashboardPrevPageBtn');
    const nextBtn = document.getElementById('dashboardNextPageBtn');
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
      prevBtn.onclick = () => { if (this.currentPage > 1) { this.currentPage--; this.renderTable(); } };
    }
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
      nextBtn.onclick = () => { if (this.currentPage < totalPages) { this.currentPage++; this.renderTable(); } };
    }
  }

  async loadActiveEmergencyFeed() {
    const feed = document.getElementById('dashboardEmergencyFeed');
    if (!feed) return;

    const active = this.emergencyAlerts.filter(a => a.status === 'SENT' || a.status === 'ACTIVE' || a.status === 'PENDING').slice(0, 3);

    if (active.length === 0) {
      feed.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--police-text-muted); font-size: 13px;">
          <div style="font-size: 24px; color: var(--police-emerald); margin-bottom: 6px;">🛡️</div>
          Zero active SOS emergencies reported across patrol zones.
        </div>
      `;
      return;
    }

    feed.innerHTML = active.map(alert => `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 14px;">🚨</span>
            <strong style="color: #F87171; font-family: var(--font-mono);">${this.escape(alert.alertReference || alert.id)}</strong>
            <span class="police-badge badge-priority-critical">SOS DISTRESS</span>
          </div>
          <div style="font-size: 11.5px; color: var(--police-text-secondary);">
            📍 ${alert.location?.address || `${alert.location?.latitude?.toFixed(4)}, ${alert.location?.longitude?.toFixed(4)}`}
          </div>
        </div>
        <a href="police-emergency.html" class="police-btn police-btn-danger police-btn-sm">
          Respond &rarr;
        </a>
      </div>
    `).join('');
  }

  openQuickStatusModal(reference, currentStatus) {
    const modal = document.getElementById('quickStatusModal');
    if (!modal) return;

    document.getElementById('quickStatusRef').textContent = reference;
    const select = document.getElementById('quickStatusSelect');
    if (select) select.value = currentStatus;

    modal.classList.add('open');

    const saveBtn = document.getElementById('saveQuickStatusBtn');
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';

      const newStatus = select.value;
      const notes = document.getElementById('quickStatusNotes').value;
      const officer = policeAuth.getOfficer();

      try {
        await policeApi.updateReportStatus(reference, newStatus, notes, officer);
        showPoliceToast(`Case ${reference} updated to ${newStatus}`, 'success');
        modal.classList.remove('open');
        await this.init();
      } catch (err) {
        showPoliceToast(`Update failed: ${err.message}`, 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Commit Status';
      }
    };

    document.getElementById('closeQuickStatusBtn').onclick = () => modal.classList.remove('open');
  }

  formatCategory(cat) {
    const map = {
      harassment: 'Harassment / Eve Teasing',
      stalking: 'Stalking / Following',
      physical_assault: 'Physical Assault',
      threats: 'Threats / Intimidation',
      cyber_harassment: 'Cyber Harassment / Blackmail',
      unsafe_location: 'Unsafe Public Location',
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
