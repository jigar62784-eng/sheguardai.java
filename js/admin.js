/**
 * SheGuard - Protected Administration Controller
 * Backend-authorized incident review, moderation, metrics, and audit trail.
 */
import { api } from './api.js';
import { reportsService } from './reports.js';
import { showToast, openModal, closeModal, escapeHtml } from './ui.js';

export class AdminController {
  constructor() {
    this.analytics = null;
    this.reports = [];
    this.activeReport = null;
  }

  async init() {
    await Promise.allSettled([
      this.loadAnalytics(),
      this.loadReportsQueue(),
      this.loadAuditLogs()
    ]);
  }

  /**
   * Fetches real analytics from backend
   */
  async loadAnalytics() {
    try {
      this.analytics = await api.get('/admin/analytics');
      if (!this.analytics) return;

      document.getElementById('adminTotalReports').textContent = this.analytics.totalReports || 0;
      document.getElementById('adminPendingReports').textContent = this.analytics.pendingReview || 0;
      document.getElementById('adminVerifiedReports').textContent = this.analytics.verified || 0;
      document.getElementById('adminResolvedReports').textContent = this.analytics.resolved || 0;

      // Render Category Breakdown
      const categoryList = document.getElementById('adminCategoryMetrics');
      if (categoryList && this.analytics.byCategory) {
        categoryList.innerHTML = Object.entries(this.analytics.byCategory).map(([cat, count]) => {
          const label = reportsService.getCategoryLabel(cat);
          return `
            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px;">
              <span>${escapeHtml(label)}</span>
              <strong style="font-family: monospace; color: var(--accent-cyan);">${count}</strong>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('[Admin] Failed to load analytics:', err.message);
      showToast('Could not load administrative analytics: ' + err.message, 'warning');
    }
  }

  /**
   * Fetches queue of all incident reports for review
   */
  async loadReportsQueue() {
    const tableBody = document.getElementById('adminReportsTableBody');
    if (!tableBody) return;

    try {
      this.reports = await api.get('/admin/reports');

      if (!this.reports || this.reports.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94A3B8; padding: 24px;">No incident reports submitted in the system.</td></tr>`;
        return;
      }

      tableBody.innerHTML = this.reports.map(r => {
        const meta = reportsService.getStatusMeta(r.status);
        const cat = reportsService.getCategoryLabel(r.category);
        return `
          <tr>
            <td><strong style="font-family: monospace; color: var(--accent-cyan);">${escapeHtml(r.reference)}</strong></td>
            <td>${escapeHtml(cat)}</td>
            <td>${escapeHtml(r.incidentDate || 'N/A')}</td>
            <td>${escapeHtml(r.location?.address || `${r.location?.latitude?.toFixed(3)}, ${r.location?.longitude?.toFixed(3)}`)}</td>
            <td><span class="badge ${meta.badgeClass}">${escapeHtml(meta.label)}</span></td>
            <td>${escapeHtml(r.reporterEmail || 'Confidential')}</td>
            <td>
              <button class="btn btn-secondary btn-sm review-btn" data-ref="${escapeHtml(r.reference)}" style="font-size: 11px;">
                Review
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Attach review button listeners
      tableBody.querySelectorAll('.review-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.openReviewModal(btn.dataset.ref);
        });
      });
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7" style="color: #EF4444; padding: 24px;">Failed to load reports queue: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  /**
   * Opens detailed review modal for an incident
   */
  async openReviewModal(reference) {
    const report = this.reports.find(r => r.reference === reference);
    if (!report) return;
    this.activeReport = report;

    document.getElementById('modalRefTitle').textContent = `Review Report: ${report.reference}`;
    document.getElementById('modalCategory').textContent = reportsService.getCategoryLabel(report.category);
    document.getElementById('modalDate').textContent = `${report.incidentDate || 'N/A'} ${report.incidentTime || ''}`;
    document.getElementById('modalLocation').textContent = `${report.location?.address || 'N/A'} (Lat: ${report.location?.latitude}, Lon: ${report.location?.longitude})`;
    document.getElementById('modalDescription').textContent = report.description || 'No description provided';
    document.getElementById('modalCurrentStatus').textContent = report.status || 'SUBMITTED';

    // Evidence link
    const evidenceContainer = document.getElementById('modalEvidenceContainer');
    if (evidenceContainer) {
      if (report.evidenceUrl) {
        evidenceContainer.innerHTML = `
          <a href="${escapeHtml(report.evidenceUrl)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
            📎 View Attached Evidence
          </a>
        `;
      } else {
        evidenceContainer.innerHTML = `<span style="color: #94A3B8; font-size: 12px;">No evidence files attached to this report.</span>`;
      }
    }

    openModal('adminReviewModal');
  }

  /**
   * Updates verification status of active report
   */
  async updateReportStatus(newStatus, reviewNotes = '') {
    if (!this.activeReport) return;
    
    try {
      await api.patch(`/admin/reports/${encodeURIComponent(this.activeReport.reference)}/status`, {
        status: newStatus,
        reviewNotes: reviewNotes
      });
      showToast(`Report status updated to ${newStatus}.`, 'success');
      closeModal('adminReviewModal');
      await this.loadAnalytics();
      await this.loadReportsQueue();
      await this.loadAuditLogs();
    } catch (err) {
      showToast(`Failed to update status: ${err.message}`, 'danger');
    }
  }

  /**
   * Fetches audit logs from backend
   */
  async loadAuditLogs() {
    const logsContainer = document.getElementById('adminAuditLogs');
    if (!logsContainer) return;

    try {
      const logs = await api.get('/admin/audit-logs');
      if (!logs || logs.length === 0) {
        logsContainer.innerHTML = `<p style="font-size: 12px; color: #94A3B8; text-align: center;">No audit logs recorded yet.</p>`;
        return;
      }

      logsContainer.innerHTML = logs.map(l => `
        <div style="font-size: 12px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #CBD5E1;">
          <span style="color: var(--accent-cyan); font-family: monospace;">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
          <strong>${escapeHtml(l.adminEmail || 'System')}:</strong>
          ${escapeHtml(l.action)} - Ref: <span style="font-family: monospace;">${escapeHtml(l.targetReference || 'N/A')}</span>
        </div>
      `).join('');
    } catch (err) {
      logsContainer.innerHTML = `<p style="font-size: 12px; color: #EF4444;">Could not fetch audit logs: ${escapeHtml(err.message)}</p>`;
    }
  }

  /**
   * Exports permitted reports as CSV file
   */
  exportReportsCSV() {
    if (!this.reports || this.reports.length === 0) {
      showToast('No records available to export.', 'warning');
      return;
    }

    const headers = ['Reference', 'Category', 'Date', 'Time', 'Status', 'Address', 'Latitude', 'Longitude', 'Created'];
    const rows = this.reports.map(r => [
      `"${r.reference || ''}"`,
      `"${r.category || ''}"`,
      `"${r.incidentDate || ''}"`,
      `"${r.incidentTime || ''}"`,
      `"${r.status || ''}"`,
      `"${(r.location?.address || '').replace(/"/g, '""')}"`,
      r.location?.latitude || '',
      r.location?.longitude || '',
      `"${r.createdAt || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sheguard_reports_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export file downloaded.', 'success');
  }
}

export const adminController = new AdminController();
