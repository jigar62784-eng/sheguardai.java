/**
 * SheGuard - Incident Reporting & Report History Management
 */
import { api } from './api.js';
import { CONFIG } from './config.js';
import { showToast } from './ui.js';

export class ReportsService {
  /**
   * Submits a new incident report to the backend
   */
  async submitReport(reportData, evidenceFile = null, onProgress = null) {
    // 1. Submit core incident report payload
    const payload = {
      category: reportData.category,
      incidentDate: reportData.incidentDate,
      incidentTime: reportData.incidentTime,
      description: reportData.description,
      location: {
        latitude: parseFloat(reportData.latitude),
        longitude: parseFloat(reportData.longitude),
        address: reportData.address || ''
      },
      consentGiven: Boolean(reportData.consentGiven),
      isPublicSafeDisplayEligible: Boolean(reportData.isPublicSafeDisplayEligible)
    };

    const result = await api.post('/reports', payload);

    // 2. Upload optional evidence file privately if provided
    if (evidenceFile && result && result.reference) {
      if (onProgress) onProgress('Uploading encrypted evidence attachment...');
      try {
        await api.uploadEvidence(result.reference, evidenceFile);
      } catch (err) {
        console.warn('[SheGuard Reports] Evidence upload deferred or failed:', err);
        showToast('Report created, but evidence upload failed: ' + err.message, 'warning');
      }
    }

    return result;
  }

  /**
   * Fetches the current user's submitted reports
   */
  async getMyReports() {
    return api.get('/reports/mine');
  }

  /**
   * Fetches details of a specific report by reference
   */
  async getReportDetails(reference) {
    return api.get(`/reports/${encodeURIComponent(reference)}`);
  }

  /**
   * Fetches public safety map reports (privacy-fuzzed coordinates only)
   */
  async getPublicSafetyReports(category = null, daysAgo = 30) {
    let url = `/reports/public?daysAgo=${daysAgo}`;
    if (category && category !== 'all') {
      url += `&category=${encodeURIComponent(category)}`;
    }
    return api.get(url);
  }

  /**
   * Maps status key to human label and CSS badge class
   */
  getStatusMeta(statusKey) {
    const key = (statusKey || 'submitted').toLowerCase().replace(/\s+/g, '_');
    return CONFIG.INCIDENT_STATUSES[key] || {
      label: statusKey || 'Submitted',
      badgeClass: 'badge-submitted'
    };
  }

  /**
   * Maps category key to human readable label
   */
  getCategoryLabel(categoryId) {
    const found = CONFIG.INCIDENT_CATEGORIES.find(c => c.id === categoryId);
    return found ? found.label : (categoryId || 'Incident');
  }
}

export const reportsService = new ReportsService();
