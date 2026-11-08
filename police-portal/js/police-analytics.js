/**
 * SheGuard Law Enforcement Portal - Crime & Safety Analytics Engine
 * Architecture: FRONTEND 2 (SVG Visualizations, Pipeline Funnel & Caseload Intelligence)
 */

import { policeApi } from './police-api.js';
import { showPoliceToast } from './police-guards.js';

export class PoliceAnalyticsController {
  constructor() {
    this.reports = [];
    this.timeframe = '30';
  }

  async init() {
    await this.loadData();
    this.bindEvents();
  }

  async loadData() {
    try {
      this.reports = await policeApi.getReports();
      this.renderMetrics();
      this.renderCategoryChart();
      this.renderStatusFunnel();
      this.renderHourlyDistribution();
    } catch (e) {
      showPoliceToast('Failed to aggregate analytical data: ' + e.message, 'danger');
    }
  }

  bindEvents() {
    const timeframeSelect = document.getElementById('analyticsTimeframe');
    if (timeframeSelect) {
      timeframeSelect.addEventListener('change', (e) => {
        this.timeframe = e.target.value;
        this.renderMetrics();
        this.renderCategoryChart();
        this.renderStatusFunnel();
        this.renderHourlyDistribution();
      });
    }

    const exportBtn = document.getElementById('exportAnalyticsReportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }

  getFilteredReports() {
    const days = parseInt(this.timeframe, 10) || 30;
    const cutoff = Date.now() - (days * 86400000);
    return this.reports.filter(r => (r.createdAt || 0) >= cutoff);
  }

  renderMetrics() {
    const filtered = this.getFilteredReports();
    const total = filtered.length;
    const verified = filtered.filter(r => (r.status || '').toUpperCase() === 'VERIFIED').length;
    const resolved = filtered.filter(r => (r.status || '').toUpperCase() === 'RESOLVED').length;
    const investigating = filtered.filter(r => (r.status || '').toUpperCase() === 'UNDER_INVESTIGATION' || (r.status || '').toUpperCase() === 'ASSIGNED').length;

    const verificationRate = total > 0 ? Math.round(((verified + resolved) / total) * 100) : 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    document.getElementById('analyticsTotalVolume').textContent = total;
    document.getElementById('analyticsVerificationRate').textContent = `${verificationRate}%`;
    document.getElementById('analyticsResolutionRate').textContent = `${resolutionRate}%`;
    document.getElementById('analyticsActiveCases').textContent = investigating;
  }

  renderCategoryChart() {
    const container = document.getElementById('analyticsCategoryChart');
    if (!container) return;

    const filtered = this.getFilteredReports();
    const counts = {};
    filtered.forEach(r => {
      const cat = r.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = filtered.length || 1;

    container.innerHTML = entries.map(([cat, count]) => {
      const pct = Math.round((count / total) * 100);
      const label = this.formatCategory(cat);
      const color = this.getCategoryColor(cat);

      return `
        <div style="margin-bottom: 0.85rem;">
          <div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-bottom: 4px;">
            <span style="color: #fff; font-weight: 500;">${label}</span>
            <span style="color: var(--police-cyan); font-family: var(--font-mono); font-weight: 600;">${count} (${pct}%)</span>
          </div>
          <div style="height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 4px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderStatusFunnel() {
    const container = document.getElementById('analyticsStatusFunnel');
    if (!container) return;

    const filtered = this.getFilteredReports();
    const submitted = filtered.length;
    const verified = filtered.filter(r => ['VERIFIED', 'UNDER_INVESTIGATION', 'RESOLVED'].includes((r.status || '').toUpperCase())).length;
    const assigned = filtered.filter(r => ['ASSIGNED', 'UNDER_INVESTIGATION', 'RESOLVED'].includes((r.status || '').toUpperCase())).length;
    const resolved = filtered.filter(r => (r.status || '').toUpperCase() === 'RESOLVED').length;

    const stages = [
      { name: '1. Submitted Incidents', count: submitted, color: '#38BDF8' },
      { name: '2. Legally Verified', count: verified, color: '#10B981' },
      { name: '3. Assigned & Investigating', count: assigned, color: '#8B5CF6' },
      { name: '4. Formally Closed / Resolved', count: resolved, color: '#F59E0B' }
    ];

    container.innerHTML = stages.map(st => {
      const pct = submitted > 0 ? Math.round((st.count / submitted) * 100) : 0;
      return `
        <div style="margin-bottom: 1rem; background: rgba(22, 34, 56, 0.4); border: 1px solid var(--police-border); border-radius: var(--radius-sm); padding: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #fff; font-size: 13px;">${st.name}</strong>
            <span style="font-family: var(--font-mono); font-weight: 700; color: ${st.color}; font-size: 14px;">${st.count} cases (${pct}%)</span>
          </div>
          <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${st.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderHourlyDistribution() {
    const container = document.getElementById('analyticsHourlyChart');
    if (!container) return;

    // Aggregate by time blocks
    const buckets = {
      '00:00 - 06:00 (Late Night)': 0,
      '06:00 - 12:00 (Morning)': 0,
      '12:00 - 18:00 (Afternoon)': 0,
      '18:00 - 24:00 (Evening / High Risk)': 0
    };

    this.getFilteredReports().forEach(r => {
      const timeStr = r.incidentTime || '18:00';
      const hour = parseInt(timeStr.split(':')[0], 10) || 18;
      if (hour < 6) buckets['00:00 - 06:00 (Late Night)']++;
      else if (hour < 12) buckets['06:00 - 12:00 (Morning)']++;
      else if (hour < 18) buckets['12:00 - 18:00 (Afternoon)']++;
      else buckets['18:00 - 24:00 (Evening / High Risk)']++;
    });

    const maxVal = Math.max(...Object.values(buckets), 1);

    container.innerHTML = Object.entries(buckets).map(([slot, count]) => {
      const pct = Math.round((count / maxVal) * 100);
      const isHighRisk = slot.includes('Evening');
      return `
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span style="color: ${isHighRisk ? '#F87171' : 'var(--police-text-secondary)'}; font-weight: 600;">${slot}</span>
            <span style="font-family: var(--font-mono); color: #fff;">${count} reports</span>
          </div>
          <div style="height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; height: 100%; background: ${isHighRisk ? '#EF4444' : '#38BDF8'}; border-radius: 4px;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  getCategoryColor(category) {
    switch ((category || '').toLowerCase()) {
      case 'physical_assault': return '#EF4444';
      case 'harassment': return '#F97316';
      case 'stalking': return '#8B5CF6';
      case 'threats': return '#EC4899';
      case 'cyber_harassment': return '#06B6D4';
      case 'unsafe_location': return '#3B82F6';
      default: return '#10B981';
    }
  }

  formatCategory(cat) {
    const map = {
      harassment: 'Harassment / Eve Teasing',
      stalking: 'Stalking / Following',
      physical_assault: 'Physical Assault',
      threats: 'Threats / Intimidation',
      cyber_harassment: 'Cyber Harassment',
      unsafe_location: 'Unsafe Location',
      other: 'Other Safety Incident'
    };
    return map[cat] || (cat ? cat.replace(/_/g, ' ') : 'General Safety');
  }
}
