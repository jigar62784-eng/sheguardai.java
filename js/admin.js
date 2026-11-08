/**
 * SheGuard - Protected Administration Controller
 * Backend-authorized incident review, moderation, metrics, and audit trail.
 * Hybrid: Spring Boot REST API with Cloud Firestore fallback for standalone cloud deployment.
 */
import { api } from './api.js';
import { reportsService } from './reports.js';
import { showToast, openModal, closeModal, escapeHtml } from './ui.js';
import { db, auth, doc, updateDoc, setDoc, getDocs, collection, onSnapshot } from './firebase.js';

export class AdminController {
  constructor() {
    this.analytics = null;
    this.reports = [];
    this.activeReport = null;
    this.hasSetupListeners = false;
  }

  async init() {
    if (!this.hasSetupListeners) {
      this.setupSyncListeners();
      this.hasSetupListeners = true;
    }
    await this.loadReportsQueue();
    await Promise.allSettled([
      this.loadAnalytics(),
      this.loadAuditLogs()
    ]);
  }

  setupSyncListeners() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('sheguard_sync');
        channel.onmessage = async (event) => {
          if (event.data?.type === 'REPORT_SUBMITTED' || event.data?.type === 'REPORT_UPDATED') {
            await this.loadReportsQueue();
          }
        };
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', async (e) => {
        if (e.key && (e.key.startsWith('sheguard_reports_') || e.key === 'sheguard_global_reports')) {
          await this.loadReportsQueue();
        }
      });

      window.addEventListener('sheguard:report-sync', async () => {
        await this.loadReportsQueue();
      });
    }

    if (db) {
      try {
        onSnapshot(collection(db, 'reports'), () => {
          this.loadReportsQueue();
        }, () => {});
      } catch (e) {}
    }
  }

  /**
   * Fetches real analytics from backend or aggregates from live records
   */
  async loadAnalytics() {
    try {
      this.analytics = await api.get('/admin/analytics');
    } catch (err) {
      // Calculate genuine live analytics directly from current reports array
      const reports = this.reports || [];
      const total = reports.length;
      const pending = reports.filter(r => {
        const s = (r.status || '').toUpperCase();
        return s === 'SUBMITTED' || s === 'PENDING_REVIEW' || s === 'PENDING_VERIFICATION';
      }).length;
      const verified = reports.filter(r => (r.status || '').toUpperCase() === 'VERIFIED').length;
      const resolved = reports.filter(r => (r.status || '').toUpperCase() === 'RESOLVED').length;

      const byCategory = {};
      reports.forEach(r => {
        const c = r.category || 'other';
        byCategory[c] = (byCategory[c] || 0) + 1;
      });

      this.analytics = {
        totalReports: total,
        pendingReview: pending,
        verified: verified,
        resolved: resolved,
        byCategory: byCategory
      };
    }

    if (!this.analytics) return;

    const totalEl = document.getElementById('adminTotalReports');
    const pendingEl = document.getElementById('adminPendingReports');
    const verifiedEl = document.getElementById('adminVerifiedReports');
    const resolvedEl = document.getElementById('adminResolvedReports');

    if (totalEl) totalEl.textContent = this.analytics.totalReports || 0;
    if (pendingEl) pendingEl.textContent = this.analytics.pendingReview || 0;
    if (verifiedEl) verifiedEl.textContent = this.analytics.verified || 0;
    if (resolvedEl) resolvedEl.textContent = this.analytics.resolved || 0;

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
  }

  /**
   * Fetches queue of all incident reports for review
   */
  async loadReportsQueue() {
    const tableBody = document.getElementById('adminReportsTableBody');
    if (!tableBody) return;

    try {
      this.reports = await reportsService.getAllReports();
    } catch (err) {
      console.warn('[Admin] Error retrieving reports queue:', err);
      this.reports = [];
    }

    // Instantly update analytics counters based on retrieved reports
    await this.loadAnalytics();

    if (!this.reports || this.reports.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94A3B8; padding: 24px;">No incident reports submitted in the system yet.</td></tr>`;
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
          <td>${escapeHtml(r.location?.address || (r.location?.latitude ? `${r.location.latitude.toFixed(3)}, ${r.location.longitude.toFixed(3)}` : 'N/A'))}</td>
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
  }

    tableBody.innerHTML = this.reports.map(r => {
      const meta = reportsService.getStatusMeta(r.status);
      const cat = reportsService.getCategoryLabel(r.category);
      return `
        <tr>
          <td><strong style="font-family: monospace; color: var(--accent-cyan);">${escapeHtml(r.reference)}</strong></td>
          <td>${escapeHtml(cat)}</td>
          <td>${escapeHtml(r.incidentDate || 'N/A')}</td>
          <td>${escapeHtml(r.location?.address || (r.location?.latitude ? `${r.location.latitude.toFixed(3)}, ${r.location.longitude.toFixed(3)}` : 'N/A'))}</td>
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
    document.getElementById('modalLocation').textContent = `${report.location?.address || 'N/A'} (Lat: ${report.location?.latitude || 'N/A'}, Lon: ${report.location?.longitude || 'N/A'})`;
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
    const ref = this.activeReport.reference;
    const adminEmail = (auth && auth.currentUser && auth.currentUser.email) || 'admin@sheguard.app';

    await reportsService.updateReportStatus(ref, newStatus, reviewNotes, adminEmail);

    // Update in local memory
    const report = this.reports.find(r => r.reference === ref);
    if (report) {
      report.status = newStatus;
      report.reviewNotes = reviewNotes;
      report.updatedAt = Date.now();
    }

    // Add audit log entry
    const auditEntry = {
      id: 'aud_' + Date.now(),
      adminEmail: adminEmail,
      action: `UPDATED_STATUS_TO_${newStatus}`,
      targetReference: ref,
      notes: reviewNotes,
      timestamp: Date.now()
    };
    if (db) {
      try {
        await setDoc(doc(db, 'audit_logs', auditEntry.id), auditEntry);
      } catch (e) {}
    }

    showToast(`Report ${ref} status updated to ${newStatus}.`, 'success');
    closeModal('adminReviewModal');
    await this.loadReportsQueue();
    await this.loadAnalytics();
    await this.loadAuditLogs();
  }

  /**
   * Fetches audit logs from backend or Firestore
   */
  async loadAuditLogs() {
    const logsContainer = document.getElementById('adminAuditLogs');
    if (!logsContainer) return;

    let logs = [];
    try {
      logs = await api.get('/admin/audit-logs');
    } catch (err) {
      if (db) {
        try {
          const snapshot = await getDocs(collection(db, 'audit_logs'));
          snapshot.forEach(docSnap => logs.push(docSnap.data()));
        } catch (e) {}
      }
    }

    if (!logs || logs.length === 0) {
      logsContainer.innerHTML = `<p style="font-size: 12px; color: #94A3B8; text-align: center;">No audit logs recorded yet.</p>`;
      return;
    }

    logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    logsContainer.innerHTML = logs.slice(0, 20).map(l => `
      <div style="font-size: 12px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #CBD5E1;">
        <span style="color: var(--accent-cyan); font-family: monospace;">[${new Date(l.timestamp).toLocaleTimeString()}]</span>
        <strong>${escapeHtml(l.adminEmail || 'System')}:</strong>
        ${escapeHtml(l.action)} - Ref: <span style="font-family: monospace;">${escapeHtml(l.targetReference || 'N/A')}</span>
      </div>
    `).join('');
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
