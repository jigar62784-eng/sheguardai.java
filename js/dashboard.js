/**
 * SheGuard - User Dashboard Controller
 * Aggregates live user metrics, report summaries, family status, and emergency contacts.
 */
import { api } from './api.js';
import { authService } from './auth.js';
import { reportsService } from './reports.js';
import { formatDateTime, renderEmptyState, escapeHtml } from './ui.js';

export class DashboardController {
  async init() {
    const user = await authService.waitForAuth();
    if (!user) return;

    // Render user greeting
    const greetingEl = document.getElementById('userGreeting');
    if (greetingEl) {
      const name = (authService.userProfile && authService.userProfile.displayName) || user.displayName || user.email.split('@')[0];
      greetingEl.textContent = `Welcome back, ${name}`;
    }

    // Load Metrics & Data in parallel
    await Promise.allSettled([
      this.loadReportMetrics(),
      this.loadContactsCount(),
      this.loadFamilyCircleStatus(),
      this.loadRecentReports()
    ]);
  }

  async loadReportMetrics() {
    const totalReportsEl = document.getElementById('metricTotalReports');
    const pendingReportsEl = document.getElementById('metricPendingReports');
    const verifiedReportsEl = document.getElementById('metricVerifiedReports');

    try {
      const reports = await reportsService.getMyReports();
      const list = reports || [];

      if (totalReportsEl) totalReportsEl.textContent = list.length;
      
      const pendingCount = list.filter(r => (r.status || '').toLowerCase() === 'pending_review' || (r.status || '').toLowerCase() === 'submitted').length;
      if (pendingReportsEl) pendingReportsEl.textContent = pendingCount;

      const verifiedCount = list.filter(r => (r.status || '').toLowerCase() === 'verified').length;
      if (verifiedReportsEl) verifiedReportsEl.textContent = verifiedCount;
    } catch (err) {
      console.warn('[Dashboard] Error fetching report metrics:', err);
      if (totalReportsEl) totalReportsEl.textContent = '-';
      if (pendingReportsEl) pendingReportsEl.textContent = '-';
      if (verifiedReportsEl) verifiedReportsEl.textContent = '-';
    }
  }

  async loadContactsCount() {
    const contactsCountEl = document.getElementById('metricContactsCount');
    try {
      const contacts = await api.get('/contacts');
      if (contactsCountEl) contactsCountEl.textContent = (contacts || []).length;
    } catch (err) {
      if (contactsCountEl) contactsCountEl.textContent = '-';
    }
  }

  async loadFamilyCircleStatus() {
    const familyStatusEl = document.getElementById('metricFamilyStatus');
    try {
      const members = await api.get('/family/members');
      const count = (members || []).length;
      if (familyStatusEl) {
        familyStatusEl.textContent = count > 0 ? `${count} Active` : '0 Connected';
      }
    } catch (err) {
      if (familyStatusEl) familyStatusEl.textContent = 'Unavailable';
    }
  }

  async loadRecentReports() {
    const container = document.getElementById('dashboardRecentReports');
    if (!container) return;

    try {
      const reports = await reportsService.getMyReports();
      
      if (!reports || reports.length === 0) {
        renderEmptyState(
          container,
          'No Incident Reports Filed',
          'You have not submitted any incident reports yet. When you submit a report, you can track its review progress here.',
          '📝',
          '<a href="report-incident.html" class="btn btn-primary btn-sm">Report an Incident</a>'
        );
        return;
      }

      // Display up to 5 most recent
      const recent = reports.slice(0, 5);
      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Category</th>
                <th>Incident Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${recent.map(r => {
                const meta = reportsService.getStatusMeta(r.status);
                const category = reportsService.getCategoryLabel(r.category);
                return `
                  <tr>
                    <td><strong style="font-family: monospace; color: var(--accent-cyan);">${escapeHtml(r.reference)}</strong></td>
                    <td>${escapeHtml(category)}</td>
                    <td>${escapeHtml(r.incidentDate || 'N/A')}</td>
                    <td><span class="badge ${meta.badgeClass}">${escapeHtml(meta.label)}</span></td>
                    <td><a href="my-reports.html" class="btn btn-secondary btn-sm" style="font-size: 11px;">Track</a></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="alert alert-warning">
          Backend service is currently not accessible (${escapeHtml(err.message)}). Please verify Spring Boot server.
        </div>
      `;
    }
  }
}

export const dashboardController = new DashboardController();
