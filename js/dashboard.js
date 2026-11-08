/**
 * SheGuard - User Dashboard Controller
 * Aggregates live user metrics, report summaries, family status, emergency contacts,
 * role-based access displays, and real-time nearest police stations & hospital tracking.
 */
import { api } from './api.js';
import { authService } from './auth.js';
import { reportsService } from './reports.js';
import { contactsService } from './contacts.js';
import { familyService } from './family.js';
import { emergencyServices } from './emergency-services.js';
import { locationService } from './location.js';
import { formatDateTime, renderEmptyState, escapeHtml } from './ui.js';

export class DashboardController {
  constructor() {
    this.currentPosition = null;
    this.nearbyServicesData = null;
    this.activeServiceTab = 'POLICE'; // 'POLICE' or 'HOSPITAL'
  }

  async init() {
    const user = await authService.waitForAuth();
    if (!user) return;

    // 1. Render user greeting & Role-Based Access Badge
    this.renderRoleAndGreeting(user);

    // 2. Setup Emergency Services Switcher Tabs
    this.setupEmergencyTrackerControls();

    // 3. Load Metrics, Data & Emergency Services in parallel
    await Promise.allSettled([
      this.loadReportMetrics(),
      this.loadContactsCount(),
      this.loadFamilyCircleStatus(),
      this.loadRecentReports(),
      this.trackNearestEmergencyServices()
    ]);
  }

  renderRoleAndGreeting(user) {
    const greetingEl = document.getElementById('userGreeting');
    if (greetingEl) {
      const name = (authService.userProfile && authService.userProfile.displayName) || user.displayName || user.email.split('@')[0];
      greetingEl.textContent = `Welcome back, ${name}`;
    }

    // Role-Based Access Badge & Navigation Updates
    const roleBadge = document.getElementById('userRoleBadge');
    const adminBanner = document.getElementById('adminAccessBanner');
    const adminSidebarTab = document.getElementById('adminSidebarTab');
    const isAdmin = authService.isAdmin();

    if (roleBadge) {
      if (isAdmin) {
        roleBadge.className = 'badge';
        roleBadge.style.background = 'rgba(124, 58, 237, 0.35)';
        roleBadge.style.color = '#E9D5FF';
        roleBadge.style.border = '1px solid #7C3AED';
        roleBadge.textContent = '👑 Administrator';
      } else {
        roleBadge.className = 'badge badge-verified';
        roleBadge.textContent = '🛡️ Verified Citizen';
      }
    }

    if (adminBanner) {
      adminBanner.style.display = isAdmin ? 'block' : 'none';
    }

    if (adminSidebarTab) {
      adminSidebarTab.style.display = isAdmin ? 'block' : 'none';
    }

    document.querySelectorAll('.nav-admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });
  }

  setupEmergencyTrackerControls() {
    const tabPolice = document.getElementById('tabShowPolice');
    const tabHospitals = document.getElementById('tabShowHospitals');
    const refreshBtn = document.getElementById('btnRefreshNearest');

    if (tabPolice && tabHospitals) {
      tabPolice.addEventListener('click', () => {
        this.activeServiceTab = 'POLICE';
        tabPolice.style.background = 'rgba(59, 130, 246, 0.25)';
        tabPolice.style.color = '#93C5FD';
        tabPolice.style.borderColor = '#3B82F6';

        tabHospitals.style.background = '';
        tabHospitals.style.color = 'var(--text-secondary)';
        tabHospitals.style.borderColor = '';

        this.renderServicesGrid();
      });

      tabHospitals.addEventListener('click', () => {
        this.activeServiceTab = 'HOSPITAL';
        tabHospitals.style.background = 'rgba(16, 185, 129, 0.25)';
        tabHospitals.style.color = '#6EE7B7';
        tabHospitals.style.borderColor = '#10B981';

        tabPolice.style.background = '';
        tabPolice.style.color = 'var(--text-secondary)';
        tabPolice.style.borderColor = '';

        this.renderServicesGrid();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.trackNearestEmergencyServices(true);
      });
    }
  }

  async trackNearestEmergencyServices(forceRefresh = false) {
    const locText = document.getElementById('currentLocationText');
    const grid = document.getElementById('nearestServicesGrid');
    const gpsStatus = document.getElementById('trackerGpsStatus');

    try {
      if (locText) {
        locText.innerHTML = `<span class="spinner" style="width: 13px; height: 13px;"></span> Locating high-precision GPS coordinates...`;
      }

      const pos = await locationService.getCurrentPosition();
      this.currentPosition = pos;

      if (locText) {
        locText.innerHTML = `
          <span>📍 Lat: <strong>${pos.latitude.toFixed(4)}</strong>, Lon: <strong>${pos.longitude.toFixed(4)}</strong> &bull; GPS Precision: &plusmn;${Math.round(pos.accuracy)}m</span>
        `;
      }
      if (gpsStatus) {
        gpsStatus.textContent = 'GPS Active (Live)';
        gpsStatus.className = 'badge badge-live';
      }

      // Query emergency services
      const services = await emergencyServices.getNearbyServices(pos.latitude, pos.longitude, 7000);
      this.nearbyServicesData = services;

      const policeCount = document.getElementById('countPoliceStations');
      const hospitalCount = document.getElementById('countHospitals');
      if (policeCount) policeCount.textContent = (services.police || []).length;
      if (hospitalCount) hospitalCount.textContent = (services.hospitals || []).length;

      this.renderServicesGrid();
    } catch (err) {
      console.warn('[Dashboard Tracker] Geolocation notice:', err.message);
      if (locText) {
        locText.innerHTML = `<span style="color: #F87171;">⚠️ Location permission required to locate nearest stations (${escapeHtml(err.message)}).</span>`;
      }
      if (gpsStatus) {
        gpsStatus.textContent = 'GPS Unavailable';
        gpsStatus.className = 'badge badge-stale';
      }
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--text-secondary);">
            <p style="margin-bottom: 8px;">Please allow foreground location access in your browser to view and track nearest emergency police stations and hospitals.</p>
            <a href="safety-map.html" class="btn btn-secondary btn-sm">Open Public Safety Map</a>
          </div>
        `;
      }
    }
  }

  renderServicesGrid() {
    const grid = document.getElementById('nearestServicesGrid');
    if (!grid || !this.nearbyServicesData) return;

    const isPolice = this.activeServiceTab === 'POLICE';
    const items = isPolice ? this.nearbyServicesData.police : this.nearbyServicesData.hospitals;

    if (!items || items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: var(--text-muted);">
          No ${isPolice ? 'police stations' : 'hospitals'} detected within immediate 7km range.
        </div>
      `;
      return;
    }

    grid.innerHTML = items.slice(0, 6).map(item => {
      const icon = isPolice ? '👮' : '🏥';
      const badgeColor = isPolice ? '#3B82F6' : '#10B981';
      const userLat = this.currentPosition?.latitude;
      const userLon = this.currentPosition?.longitude;
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${item.latitude},${item.longitude}&travelmode=driving`;

      return `
        <div style="background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s, border-color 0.2s;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">${icon}</span>
                <strong style="color: #fff; font-size: 13.5px; line-height: 1.3;">${escapeHtml(item.name)}</strong>
              </div>
              <span class="badge" style="background: rgba(255,255,255,0.06); color: ${badgeColor}; border: 1px solid ${badgeColor}; font-size: 11px; white-space: nowrap; font-family: monospace;">
                ${escapeHtml(item.formattedDistance)}
              </span>
            </div>
            <div style="font-size: 12px; color: #94A3B8; margin-bottom: 8px; line-height: 1.4;">
              📍 ${escapeHtml(item.address || 'Verified Emergency Post')}
            </div>
            <div style="font-size: 11px; color: #10B981; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 5px;">
              <span>●</span> 24/7 Rapid Emergency Response Active
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: auto;">
            <a href="tel:${escapeHtml(item.phone || (isPolice ? '112' : '102'))}" class="btn btn-secondary btn-sm" style="flex: 1; justify-content: center; font-size: 11.5px; border-color: rgba(255,255,255,0.15);">
              📞 Call Now
            </a>
            <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="flex: 1; justify-content: center; font-size: 11.5px; color: var(--accent-cyan); border-color: rgba(56, 189, 248, 0.4);">
              🧭 Directions
            </a>
          </div>
        </div>
      `;
    }).join('');
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
      const contacts = await contactsService.getContacts();
      if (contactsCountEl) contactsCountEl.textContent = (contacts || []).length;
    } catch (err) {
      if (contactsCountEl) contactsCountEl.textContent = '0';
    }
  }

  async loadFamilyCircleStatus() {
    const familyStatusEl = document.getElementById('metricFamilyStatus');
    try {
      const members = await familyService.getFamilyMembers();
      const count = (members || []).length;
      if (familyStatusEl) {
        familyStatusEl.textContent = count > 0 ? `${count} Active` : '0 Connected';
      }
    } catch (err) {
      if (familyStatusEl) familyStatusEl.textContent = '0 Connected';
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
